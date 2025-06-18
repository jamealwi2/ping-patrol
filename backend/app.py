import os
import random # Added import
from flask import Flask, jsonify, current_app, request # Added request
from flask_cors import CORS

app = Flask(__name__)
CORS(app) # This will enable CORS for all routes and origins by default

# Configuration for the destinations file path
# Assumes pre-selected-destinations.txt is in the same directory as app.py
DESTINATIONS_FILE_PATH = os.path.join(os.path.dirname(__file__), 'pre-selected-destinations.txt')

@app.route('/api/destinations', methods=['GET'])
def get_destinations():
    """
    API endpoint to get the list of prepopulated destinations.
    Reads from pre-selected-destinations.txt, parses it, and returns JSON.
    """
    destinations = []
    try:
        # Use current_app.open_resource for better Flask integration if file is bundled
        # However, for simplicity with dev server and direct path:
        if not os.path.exists(DESTINATIONS_FILE_PATH):
            current_app.logger.error(f"Destinations file not found: {DESTINATIONS_FILE_PATH}")
            return jsonify({"error": "Destinations file not found on server."}), 500

        with open(DESTINATIONS_FILE_PATH, 'r') as f:
            lines = f.readlines()

        for line in lines:
            line = line.strip()
            if not line or line.startswith('#'): # Skip empty lines or comments
                continue

            parts = line.split(',', 1) # Split only on the first comma
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

@app.route('/api/test-connectivity', methods=['POST'])
def test_connectivity():
    """
    API endpoint to simulate network connectivity tests.
    Expects JSON: { "source": "cluster-name", "destinations": ["dest1", "dest2"] }
    Returns JSON results.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No input data provided"}), 400

        source = data.get('source')
        destinations = data.get('destinations')

        if not source:
            return jsonify({"error": "Missing 'source' in request"}), 400
        if not destinations or not isinstance(destinations, list) or len(destinations) == 0:
            return jsonify({"error": "Missing or invalid 'destinations' list in request"}), 400

        current_app.logger.info(f"Received test request from source: {source} for destinations: {', '.join(destinations)}")

        # Simulate test results
        mock_results = []
        for dest in destinations:
            # Simulate some processing time per destination
            # import time # Add this if you uncomment the sleep
            # time.sleep(random.uniform(0.1, 0.5))

            is_success = random.choice([True, False, True]) # Skew towards success for mock
            status = "SUCCESS" if is_success else "FAILED"
            details = "Connection successful." if is_success else "Connection timed out (simulated)."

            mock_results.append({
                "destination": dest,
                "status": status,
                "details": details
            })

        current_app.logger.info(f"Simulated results: {mock_results}")
        return jsonify(mock_results), 200

    except Exception as e:
        current_app.logger.error(f"Error in /api/test-connectivity: {e}")
        return jsonify({"error": "An error occurred on the server during test execution."}), 500

if __name__ == '__main__':
    # Note: For development only. Use a proper WSGI server for production.
    app.run(debug=True, port=5000) # Runs on http://localhost:5000
