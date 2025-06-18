import os
from flask import Flask, jsonify, current_app

app = Flask(__name__)

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

if __name__ == '__main__':
    # Note: For development only. Use a proper WSGI server for production.
    app.run(debug=True, port=5000) # Runs on http://localhost:5000
