# Ping Patrol

## Overview

Ping Patrol is a web-based tool designed to test network connectivity from a Kubernetes environment to specified destinations. It allows users to input a list of target hosts/URLs and initiates tests from within a Kubernetes cluster to determine reachability and response. This is particularly useful for diagnosing network policies, firewall rules, and service availability from the perspective of applications running in Kubernetes.

## Architecture

Ping Patrol consists of three main components:

1.  **Frontend (HTML/CSS/JS)**:
    *   A simple web interface served directly from the root of this project.
    *   Allows users to specify destinations for testing.
    *   Displays a prepopulated list of common destinations.
    *   Shows real-time results of the connectivity tests.
    *   Communicates with the Backend API.

2.  **Backend (Python Flask API - `backend/app.py`)**:
    *   Provides API endpoints for the frontend.
    *   `/api/destinations`: Serves a list of prepopulated destinations (read from `backend/pre-selected-destinations.txt`).
    *   `/api/test-connectivity`: Receives test requests from the frontend (list of destinations).
        *   It then orchestrates the network tests by dynamically creating a Kubernetes Job in the `application` namespace of the currently configured `kubectl` context.
        *   This Job runs the "Tester Agent".
        *   The backend monitors the Job, retrieves its logs (which contain test results in JSON format), and relays these results back to the frontend.

3.  **Tester Agent (Go - `tester-agent/`)**:
    *   A command-line application written in Go.
    *   Packaged as a Docker image: `docker.branch.io/tester-agent:beta.0`.
    *   Designed to be run as a Kubernetes Job.
    *   Receives a comma-separated list of destinations via the `--destinations` command-line argument.
    *   Performs the actual network checks:
        *   **TCP Port Checks:** For destinations like `host:port` (e.g., `google.com:443`).
        *   **HTTP/HTTPS GET Requests:** For destinations like `http://example.com` or `https://example.com`.
    *   Outputs test results as a JSON array to standard output. Each result object contains `destination`, `status` ("SUCCESS" or "FAILED"), and `details`.

## Features

*   Web-based UI for easy interaction.
*   Dynamic testing from within a Kubernetes cluster.
*   Supports TCP port connectivity checks.
*   Supports HTTP/HTTPS GET requests (checks for 2xx status codes).
*   Prepopulated list of common destinations, easily customizable.
*   Real-time display of test results, categorized into successes and failures.
*   Celebration banner when all tests pass!

## Prerequisites

*   **`kubectl`**: Configured to point to the Kubernetes cluster from which you want to run the tests. The backend relies on the current `kubectl` context.
*   **Python 3 & Pip**: For running the backend Flask server. (Python 3.7+ recommended)
*   **Go (Optional - for building Tester Agent locally)**: Go version 1.22 or higher if you intend to build the `tester-agent` Docker image yourself.
*   **Docker (Optional - for building Tester Agent locally)**: If you intend to build the `tester-agent` Docker image yourself.
*   **Access to deploy Jobs to the `application` namespace** in your target Kubernetes cluster.
*   **Network access from your Kubernetes cluster** to the destinations you intend to test.
*   The Docker image `docker.branch.io/tester-agent:beta.0` must be accessible to your Kubernetes cluster.

## Setup & Running the Application

1.  **Clone the Repository:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

2.  **Backend Setup:**
    *   Navigate to the backend directory:
        ```bash
        cd backend
        ```
    *   Create a Python virtual environment (recommended):
        ```bash
        python3 -m venv venv
        source venv/bin/activate  # On Windows: venv\Scripts\activate
        ```
    *   Install dependencies:
        ```bash
        pip install -r requirements.txt
        ```
    *   Run the Flask backend server (from the `backend` directory):
        ```bash
        python app.py
        ```
        The backend will typically run on `http://localhost:5000`. Keep this terminal open.

3.  **Tester Agent Docker Image:**
    *   The application is configured to use the pre-built image `docker.branch.io/tester-agent:beta.0`. Ensure your Kubernetes cluster can pull this image.
    *   **Optional: Building the Tester Agent image locally:**
        If you need to build the image yourself (e.g., after making changes to the agent code):
        ```bash
        cd tester-agent # From project root
        docker build -t your-custom-repo/ping-patrol-tester-agent:latest .
        ```
        If you build it locally with a different name, you'll need to update the `docker_image` variable in `backend/app.py`.

4.  **Frontend Setup:**
    *   Open a **new terminal window**.
    *   Navigate to the **project root directory** (the one containing `index.html`).
    *   Serve the frontend files using a simple HTTP server:
        ```bash
        python3 -m http.server 8000
        # Or any other simple HTTP server
        ```
        Keep this terminal open.

5.  **Access Ping Patrol:**
    *   Open your web browser and go to `http://localhost:8000` (or the port your frontend server is using).

## How it Works

1.  User accesses the frontend UI (e.g., `http://localhost:8000`).
2.  The frontend fetches a prepopulated list of destinations from the backend (`/api/destinations`).
3.  User inputs any additional destinations and clicks "Test Connectivity".
4.  The frontend sends the list of destinations to the backend (`/api/test-connectivity`).
5.  The backend:
    a.  Loads the `tester-agent/tester-agent-job.yaml` template.
    b.  Dynamically updates the Job manifest with a unique name, the specified Docker image (`docker.branch.io/tester-agent:beta.0`), and the destinations as command-line arguments.
    c.  Uses `kubectl apply -f <modified-job.yaml>` to deploy the Job to the `application` namespace of the currently active Kubernetes cluster context.
    d.  Polls the Job's status using `kubectl get job ...`.
    e.  Once the Job completes successfully, it retrieves the logs from the Job's pod using `kubectl logs ...`. These logs contain the JSON output from the Tester Agent.
    f.  Sends the parsed JSON results back to the frontend.
6.  The frontend displays the test results.

## Future Enhancements (Roadmap Ideas)

*   Allow user to specify the source Kubernetes cluster context and namespace directly in the UI.
*   More sophisticated test types (e.g., UDP, ICMP, gRPC).
*   Configuration for timeouts and retry logic for tests.
*   Authentication for the backend API.
*   Persistent storage for test history.
*   Use a Kubernetes Python client library in the backend instead of `subprocess` for more robust K8s API interaction.
*   CI/CD pipeline for building and pushing the Tester Agent Docker image.
```
