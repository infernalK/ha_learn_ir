from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS
import json
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

# HTML template (the provided HTML)
HTML_TEMPLATE = """<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>IR Learner</title>
  <style>
    :root {
      --bg:#111827; --panel:#1f2937; --muted:#94a3b8; --text:#f8fafc; --accent:#14b8a6; --line:#334155; --danger:#ef4444;
    }
    *{box-sizing:border-box} body{margin:0;font-family:system-ui,sans-serif;background:var(--bg);color:var(--text)}
    .wrap{max-width:1100px;margin:0 auto;padding:24px} h1{margin:0 0 8px} p{color:var(--muted)}
    .grid{display:grid;grid-template-columns:1.1fr .9fr;gap:20px} @media (max-width:900px){.grid{grid-template-columns:1fr}}
    .card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:18px}
    label{display:block;font-size:14px;margin:0 0 6px;color:#cbd5e1}
    input,textarea,button{width:100%;border-radius:10px;border:1px solid var(--line);background:#0f172a;color:var(--text);padding:12px}
    textarea{min-height:96px;resize:vertical} .row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px} @media (max-width:700px){.row{grid-template-columns:1fr}}
    .btn{background:var(--accent);border:none;color:#06201e;font-weight:700;cursor:pointer} .btn.secondary{background:#1e293b;color:var(--text);border:1px solid var(--line)}
    .btn.danger{background:var(--danger);color:white} .stack{display:grid;gap:12px} .small{font-size:13px;color:var(--muted)}
    table{width:100%;border-collapse:collapse} th,td{padding:10px;border-bottom:1px solid var(--line);vertical-align:top} th{text-align:left;color:#cbd5e1}
    code{word-break:break-all;color:#99f6e4} .toolbar{display:flex;gap:10px;flex-wrap:wrap}.toolbar button{width:auto;padding:10px 14px}
    .notice{background:#082f49;border:1px solid #155e75;color:#bae6fd;padding:12px;border-radius:12px}.ok{color:#86efac}.warn{color:#fca5a5}
  </style>
</head>
<body>
  <div class="wrap stack">
    <div>
      <h1>IR Learner Exporter</h1>
      <p>Prépare un JSON proche du fichier 1133.json : métadonnées de l’appareil + commandes encodées Base64 pour Broadlink.</p>
    </div>

    <div class="notice">Le bouton <strong>Apprendre</strong> est un point d’intégration : il faudra le relier à ton backend réel d’apprentissage IR.</div>

    <div class="grid">
      <section class="card stack">
        <h2>Profil</h2>
        <div>
          <label>Nom du fichier JSON</label>
          <input id="filename" value="learned_codes.json">
        </div>
        <div>
          <label>Fabricant</label>
          <input id="manufacturer" placeholder="Mitsubishi Electric Starmex">
        </div>
        <div>
          <label>Modèles supportés, un par ligne</label>
          <textarea id="supportedModels" placeholder="MSXY-FN10VE&#10;MSXY-FN07VE"></textarea>
        </div>
        <div class="row">
          <div><label>Température min</label><input id="minTemperature" type="number" value="16"></div>
          <div><label>Température max</label><input id="maxTemperature" type="number" value="31"></div>
          <div><label>Précision</label><input id="precision" type="number" value="1"></div>
        </div>
        <div class="row">
          <div><label>Modes de fonctionnement</label><textarea id="operationModes" placeholder="cool&#10;dry&#10;fanonly"></textarea></div>
          <div><label>Modes ventilation</label><textarea id="fanModes" placeholder="Auto&#10;Low&#10;Mid&#10;High"></textarea></div>
          <div><label>Modes swing</label><textarea id="swingModes" placeholder="Auto&#10;Top&#10;Mid&#10;Bottom&#10;Swing"></textarea></div>
        </div>
      </section>

      <section class="card stack">
        <h2>Apprentissage</h2>
        <div>
          <label>Nom de commande</label>
          <input id="cmdName" placeholder="off ou cool_24_auto_swing">
        </div>
        <div>
          <label>Code IR Base64</label>
          <textarea id="cmdCode" placeholder="Colle ici le code appris, ou utilise le bouton Apprendre si tu branches un vrai backend"></textarea>
        </div>
        <div class="toolbar">
          <button class="btn secondary" id="learnBtn">Apprendre</button>
          <button class="btn" id="addBtn">Ajouter la commande</button>
        </div>
        <div id="learnResult" class="small"></div>
      </section>
    </div>

    <section class="card stack">
      <div class="toolbar">
        <button class="btn" id="exportBtn">Générer le JSON</button>
        <button class="btn secondary" id="exampleBtn">Charger un exemple</button>
        <button class="btn danger" id="clearBtn">Vider les commandes</button>
      </div>
      <div id="status" class="small"></div>
      <table>
        <thead><tr><th>Nom</th><th>Code</th><th></th></tr></thead>
        <tbody id="commandsBody"></tbody>
      </table>
    </section>
  </div>
<script>
const commands = [];
const $ = id => document.getElementById(id);
const lines = id => $(id).value.split(/\n/).map(v => v.trim()).filter(Boolean);
function esc(v){return String(v).replace(/[&<>\"]/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[s]))}
function render(){
  const body = $('commandsBody');
  body.innerHTML = commands.map((c,i)=>`<tr><td>${esc(c.name)}</td><td><code>${esc(c.code)}</code></td><td><button class="btn secondary" style="width:auto" onclick="removeCmd(${i})">Supprimer</button></td></tr>`).join('');
  $('status').innerHTML = `${commands.length} commande(s) prêtes.`;
}
window.removeCmd = i => { commands.splice(i,1); render(); };
$('addBtn').onclick = () => {
  const name = $('cmdName').value.trim();
  const code = $('cmdCode').value.trim();
  if(!name || !code) return $('learnResult').innerHTML = '<span class="warn">Nom et code requis.</span>';
  commands.push({name, code});
  $('cmdName').value=''; $('cmdCode').value=''; $('learnResult').innerHTML = '<span class="ok">Commande ajoutée.</span>';
  render();
};
$('clearBtn').onclick = () => { commands.length = 0; render(); };
$('exampleBtn').onclick = () => {
  $('manufacturer').value = 'Mitsubishi Electric Starmex';
  $('supportedModels').value = 'MSXY-FN10VE\nMSXY-FN07VE';
  $('operationModes').value = 'ifeel\ncool\ndry\nfanonly';
  $('fanModes').value = 'Auto\nQuiet\nLow\nMid\nHigh';
  $('swingModes').value = 'Auto\nTop\nMid\nBottom\nSwing';
  commands.length = 0;
  commands.push({name:'off', code:'JgBQAAABK5MUNhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSEwAFGQABK0kTAA0FAAAAAAAAAAA='});
  commands.push({name:'cool_24_auto_auto', code:'JgBQAAABKpQTEhQRFBIUEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhQRFQAFGQABKUkUAA0FAAAAAAAAAAA='});
  render();
};
$('learnBtn').onclick = async () => {
  const label = $('cmdName').value.trim() || 'learned_command';
  const r = await fetch('/api/learn',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({label})});
  const j = await r.json();
  $('learnResult').innerHTML = `<span class="warn">${esc(j.message)}</span><br>Exemple injecté dans le champ code.`;
  $('cmdCode').value = j.example_code || '';
  if (!$('cmdName').value.trim()) $('cmdName').value = j.suggested_name || 'learned_command';
};
$('exportBtn').onclick = async () => {
  const payload = {
    filename: $('filename').value.trim(),
    manufacturer: $('manufacturer').value.trim(),
    supportedModels: lines('supportedModels'),
    minTemperature: Number($('minTemperature').value || 16),
    maxTemperature: Number($('maxTemperature').value || 31),
    precision: Number($('precision').value || 1),
    operationModes: lines('operationModes'),
    fanModes: lines('fanModes'),
    swingModes: lines('swingModes'),
    commands
  };
  const r = await fetch('/api/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const j = await r.json();
  $('status').innerHTML = `<span class="ok">JSON généré : ${esc(j.filename)} — ${j.command_count} commande(s) — chemin : ${esc(j.public_path)}</span>`;
};
render();
</script>
</body>
</html>"""

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

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