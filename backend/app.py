import os
import time
import uuid
import yaml  # For YAML manipulation
import subprocess
import tempfile
import json  # For parsing JSON from kubectl output and logs
from flask import Flask, jsonify, current_app, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configuration for paths
BACKEND_DIR = os.path.dirname(__file__)
DESTINATIONS_FILE_PATH = os.path.join(BACKEND_DIR, 'pre-selected-destinations.txt')
# Path to job template, assuming 'tester-agent' is a sibling directory to 'backend'
JOB_TEMPLATE_PATH = os.path.join(BACKEND_DIR, '..', 'tester-agent', 'tester-agent-job.yaml')

@app.route('/api/destinations', methods=['GET'])
def get_destinations():
    destinations = []
    try:
        if not os.path.exists(DESTINATIONS_FILE_PATH):
            current_app.logger.error(f"Destinations file not found: {DESTINATIONS_FILE_PATH}")
            return jsonify({"error": "Destinations file not found on server."}), 500
        with open(DESTINATIONS_FILE_PATH, 'r') as f:
            lines = f.readlines()
        for line in lines:
            line = line.strip()
            if not line or line.startswith('#'):  # Skip empty lines or comments
                continue
            parts = line.split(',', 1)  # Split only on the first comma
            if len(parts) == 2:
                name = parts[0].strip()
                address = parts[1].strip()
                if name and address:
                    destinations.append({"name": name, "address": address})
                else:
                    current_app.logger.warning(f"Skipping malformed line (empty name or address): {line}")
            else:
                current_app.logger.warning(f"Skipping malformed line (not enough parts): {line}")
        return jsonify(destinations)
    except Exception as e:
        current_app.logger.error(f"Error reading or parsing destinations file: {e}")
        return jsonify({"error": "An error occurred while processing destinations on the server."}), 500

def run_kubectl_command(command_args, check=True):
    """Helper function to run kubectl commands."""
    try:
        current_app.logger.info(f"Running kubectl command: {' '.join(command_args)}")
        command_args_str = [str(arg) for arg in command_args] # Ensure all args are strings
        process = subprocess.run(command_args_str, capture_output=True, text=True, check=check)
        if process.stderr.strip():
            current_app.logger.warning(f"kubectl stderr: {process.stderr.strip()}")
        return process
    except subprocess.CalledProcessError as e:
        current_app.logger.error(f"kubectl command failed for command: {' '.join(e.cmd)}")
        current_app.logger.error(f"kubectl return code: {e.returncode}")
        current_app.logger.error(f"kubectl stdout (on error): {e.stdout}")
        current_app.logger.error(f"kubectl stderr (on error): {e.stderr}")
        raise
    except FileNotFoundError:
        current_app.logger.error(f"kubectl command not found. Ensure kubectl is installed and in PATH for command: {' '.join(command_args)}")
        raise

def fetch_job_logs(job_name, namespace):
    """Helper function to fetch logs for a given job."""
    current_app.logger.info(f"Fetching logs for job '{job_name}' in namespace '{namespace}'.")
    get_pods_process = run_kubectl_command([
        "kubectl", "get", "pods",
        "--namespace", namespace,
        "-l", f"job-name={job_name}",
        "-o", "json"
    ])

    pods_data = json.loads(get_pods_process.stdout)
    if not pods_data.get("items"):
        current_app.logger.error(f"No pods found for job '{job_name}'. Cannot retrieve logs.")
        raise Exception(f"No pods found for job '{job_name}' to retrieve logs.")

    pod_name = pods_data["items"][0]["metadata"]["name"]
    container_name = pods_data["items"][0]["spec"]["containers"][0]["name"]

    current_app.logger.info(f"Retrieving logs from pod '{pod_name}', container '{container_name}' for job '{job_name}'")
    logs_process = run_kubectl_command([
        "kubectl", "logs", pod_name,
        "-c", container_name,
        "--namespace", namespace,
        "--tail=-1"
    ])
    return logs_process.stdout

@app.route('/api/test-connectivity', methods=['POST'])
def test_connectivity():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No input data provided"}), 400

    # source_cluster_context = data.get('source') # Removed
    destinations = data.get('destinations')
    namespace = "application"
    docker_image = "docker.branch.io/tester-agent:beta.0"

    # if not source_cluster_context: # Removed validation
    #     return jsonify({"error": "Missing 'source' (kubectl context) in request"}), 400
    if not destinations or not isinstance(destinations, list) or len(destinations) == 0:
        return jsonify({"error": "Missing or invalid 'destinations' list in request"}), 400

    current_app.logger.info(f"Received test request for destinations: {', '.join(destinations)} (using current kubectl context)")

    unique_job_id = str(uuid.uuid4())[:8]
    job_name = f"ping-patrol-tester-job-{unique_job_id}"
    destinations_str = ",".join(destinations)
    tmp_job_file_path = None

    try:
        if not os.path.exists(JOB_TEMPLATE_PATH):
            current_app.logger.error(f"Job template file not found: {JOB_TEMPLATE_PATH}")
            return jsonify({"error": "Server configuration error: Job template not found."}), 500

        with open(JOB_TEMPLATE_PATH, 'r') as f:
            job_yaml_template = yaml.safe_load(f)

        job_yaml_template['metadata']['name'] = job_name
        job_yaml_template['metadata']['namespace'] = namespace
        if 'labels' not in job_yaml_template['metadata']:
            job_yaml_template['metadata']['labels'] = {}
        job_yaml_template['metadata']['labels']['job-id'] = unique_job_id

        if 'metadata' not in job_yaml_template['spec']['template']:
            job_yaml_template['spec']['template']['metadata'] = {}
        if 'labels' not in job_yaml_template['spec']['template']['metadata']:
            job_yaml_template['spec']['template']['metadata']['labels'] = {}
        job_yaml_template['spec']['template']['metadata']['labels']['job-id'] = unique_job_id
        job_yaml_template['spec']['template']['spec']['containers'][0]['image'] = docker_image
        job_yaml_template['spec']['template']['spec']['containers'][0]['args'] = ["--destinations", destinations_str]

        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix=".yaml", dir=BACKEND_DIR) as tmp_job_file:
            yaml.dump(job_yaml_template, tmp_job_file)
            tmp_job_file_path = tmp_job_file.name

        current_app.logger.info(f"Applying Job '{job_name}' from temporary file: {tmp_job_file_path} in namespace '{namespace}' (using current kubectl context)")
        run_kubectl_command(["kubectl", "apply", "-f", tmp_job_file_path]) # Removed context

        job_succeeded = False
        max_retries = 30
        poll_interval = 10
        for attempt in range(max_retries):
            current_app.logger.info(f"Polling Job '{job_name}' status (attempt {attempt + 1}/{max_retries}), waiting {poll_interval}s...")
            time.sleep(poll_interval)

            get_job_process = run_kubectl_command([
                "kubectl", "get", "job", job_name,
                "--namespace", namespace,
                # "--context", source_cluster_context, # Removed context
                "-o", "json"
            ], check=False)

            if get_job_process.returncode == 0:
                job_status_data = json.loads(get_job_process.stdout)
                if job_status_data.get("status", {}).get("succeeded", 0) > 0:
                    job_succeeded = True
                    current_app.logger.info(f"Job '{job_name}' succeeded.")
                    break
                if job_status_data.get("status", {}).get("failed", 0) > 0:
                    current_app.logger.error(f"Job '{job_name}' failed. Conditions: {job_status_data.get('status', {}).get('conditions')}")
                    try:
                        failed_logs = fetch_job_logs(job_name, namespace) # Removed context
                        return jsonify({"error": f"Tester agent job '{job_name}' failed.", "logs": failed_logs}), 500
                    except Exception as log_err:
                        current_app.logger.error(f"Additionally, failed to fetch logs for failed job '{job_name}': {log_err}")
                        return jsonify({"error": f"Tester agent job '{job_name}' failed. Log retrieval also failed."}), 500
            else:
                current_app.logger.warning(f"Failed to get status for job '{job_name}' on attempt {attempt + 1}. Kubectl exit code: {get_job_process.returncode}. Stderr: {get_job_process.stderr}")

        if not job_succeeded:
            current_app.logger.error(f"Job '{job_name}' did not succeed within the timeout period ({max_retries * poll_interval}s).")
            return jsonify({"error": f"Tester agent job '{job_name}' timed out."}), 500

        results_json_str = fetch_job_logs(job_name, namespace) # Removed context
        results = json.loads(results_json_str)
        return jsonify(results), 200

    except FileNotFoundError as e:
        if hasattr(e, 'filename') and e.filename == JOB_TEMPLATE_PATH :
             current_app.logger.error(f"Job template file not found: {JOB_TEMPLATE_PATH} - {e.strerror}")
             return jsonify({"error": f"Server configuration error: Job template not found."}), 500
        else:
            current_app.logger.error(f"A file not found error occurred (possibly kubectl): {e.strerror}")
            return jsonify({"error": "Server execution error: A required command or file was not found."}), 500
    except subprocess.CalledProcessError as e:
        return jsonify({"error": f"kubectl command execution failed: {e.stderr}"}), 500
    except Exception as e:
        current_app.logger.error(f"An unexpected error occurred in /api/test-connectivity: {e}", exc_info=True)
        return jsonify({"error": "An unexpected error occurred on the server."}), 500
    finally:
        if tmp_job_file_path and os.path.exists(tmp_job_file_path):
            try:
                os.remove(tmp_job_file_path)
                current_app.logger.info(f"Deleted temporary job file: {tmp_job_file_path}")
            except Exception as e_del_tmp:
                current_app.logger.error(f"Error deleting temporary job file {tmp_job_file_path}: {e_del_tmp}")

if __name__ == '__main__':
    if not os.path.exists(JOB_TEMPLATE_PATH):
        app.logger.warning(f"CRITICAL: Job template file not found at startup: {JOB_TEMPLATE_PATH}. The /api/test-connectivity endpoint will fail.")
    app.run(debug=True, port=5000)
