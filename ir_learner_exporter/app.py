from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
from datetime import datetime

app = Flask(__name__, static_folder='web')
CORS(app)

# Remove HTML_TEMPLATE as it's now in web/ir-learner.html

@app.route('/')
def index():
    return send_from_directory('web', 'ir-learner.html')

@app.route('/api/learn', methods=['POST'])
def learn():
    data = request.get_json()
    label = data.get('label', 'learned_command')
    # Stub: return example data
    return jsonify({
        'message': 'Apprentissage simulé - remplace par ton vrai backend IR',
        'example_code': 'JgBQAAABK5MUNhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSEwAFGQABK0kTAA0FAAAAAAAAAAA=',
        'suggested_name': label
    })

@app.route('/api/export', methods=['POST'])
def export():
    data = request.get_json()
    filename = data.get('filename', 'learned_codes.json')
    
    # Build the JSON structure
    json_data = {
        'manufacturer': data.get('manufacturer', ''),
        'supportedModels': data.get('supportedModels', []),
        'commandsEncoding': 'Base64',
        'supportedController': 'Broadlink',
        'minTemperature': data.get('minTemperature', 16),
        'maxTemperature': data.get('maxTemperature', 31),
        'precision': data.get('precision', 1),
        'operationModes': data.get('operationModes', []),
        'fanModes': data.get('fanModes', []),
        'swingModes': data.get('swingModes', []),
        'commands': {cmd['name']: cmd['code'] for cmd in data.get('commands', [])}
    }
    
    # Write to /data (persistent)
    data_path = f'/data/{filename}'
    with open(data_path, 'w') as f:
        json.dump(json_data, f, indent=2)
    
    # Write to /config (public)
    config_path = f'/config/{filename}'
    with open(config_path, 'w') as f:
        json.dump(json_data, f, indent=2)
    
    # Update latest.json
    latest_path = '/config/latest.json'
    with open(latest_path, 'w') as f:
        json.dump(json_data, f, indent=2)
    
    return jsonify({
        'filename': filename,
        'command_count': len(json_data['commands']),
        'public_path': f'/config/{filename}',
        'data_path': f'/data/{filename}'
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8099, debug=True)