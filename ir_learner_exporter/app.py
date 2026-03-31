from flask import Flask, jsonify, request, send_from_directory
import os
import json
import re
from pathlib import Path
from datetime import datetime
from itertools import product

app = Flask(__name__, static_folder="web", static_url_path="")

PUBLIC_DIR = Path(os.environ.get("PUBLIC_DIR", "/config"))
DATA_DIR = Path(os.environ.get("DATA_DIR", "/data"))
EXPORT_FILENAME = os.environ.get("EXPORT_FILENAME", "learned_codes.json")
DEFAULT_MANUFACTURER = os.environ.get("DEFAULT_MANUFACTURER", "")
DEFAULT_SUPPORTED_CONTROLLER = os.environ.get("DEFAULT_SUPPORTED_CONTROLLER", "Broadlink")

PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)


def slugify(value: str) -> str:
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9]+", "_", value)
    return value.strip("_") or "command"


def normalize_lines(value):
    if not value:
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    return [line.strip() for line in str(value).splitlines() if line.strip()]


def build_combo_name(mode, temperature, fan, swing):
    return "_".join([slugify(mode), str(int(temperature)), slugify(fan), slugify(swing)])


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "ir-learner.html")


@app.get("/api/template")
def template():
    return jsonify({
        "manufacturer": DEFAULT_MANUFACTURER,
        "supportedModels": [],
        "commandsEncoding": "Base64",
        "supportedController": DEFAULT_SUPPORTED_CONTROLLER,
        "minTemperature": 16,
        "maxTemperature": 31,
        "precision": 1,
        "operationModes": [],
        "fanModes": [],
        "swingModes": [],
        "commands": {},
    })


@app.post("/api/generate_matrix")
def generate_matrix():
    payload = request.get_json(force=True)

    min_t = int(payload.get("minTemperature", 16))
    max_t = int(payload.get("maxTemperature", 31))
    precision = max(1, int(payload.get("precision", 1)))

    modes = normalize_lines(payload.get("operationModes"))
    fan_modes = normalize_lines(payload.get("fanModes"))
    swing_modes = normalize_lines(payload.get("swingModes"))

    include_off = bool(payload.get("includeOff", True))
    include_ifeel = bool(payload.get("includeIFeelAutoAuto", True))

    combos = []

    if include_off:
        combos.append({"name": "off", "code": ""})

    if include_ifeel:
        combos.append({"name": "ifeel_auto_auto", "code": ""})

    temps = list(range(min_t, max_t + 1, precision))

    for mode, temp, fan, swing in product(modes, temps, fan_modes, swing_modes):
        combos.append({
            "name": build_combo_name(mode, temp, fan, swing),
            "code": ""
        })

    return jsonify({
        "ok": True,
        "count": len(combos),
        "commands": combos
    })


@app.post("/api/import")
def import_json():
    payload = request.get_json(force=True)
    raw = str(payload.get("json", "")).strip()

    data = json.loads(raw)
    commands_map = data.get("commands", {}) or {}

    commands = [{"name": k, "code": v} for k, v in commands_map.items()]

    response = {
        "manufacturer": data.get("manufacturer", ""),
        "supportedModels": data.get("supportedModels", []),
        "commandsEncoding": data.get("commandsEncoding", "Base64"),
        "supportedController": data.get("supportedController", DEFAULT_SUPPORTED_CONTROLLER),
        "minTemperature": data.get("minTemperature", 16),
        "maxTemperature": data.get("maxTemperature", 31),
        "precision": data.get("precision", 1),
        "operationModes": data.get("operationModes", []),
        "fanModes": data.get("fanModes", []),
        "swingModes": data.get("swingModes", []),
        "commands": commands,
    }
    return jsonify(response)


@app.post("/api/export")
def export_json():
    payload = request.get_json(force=True)

    manufacturer = str(payload.get("manufacturer", "")).strip()
    supported_models = normalize_lines(payload.get("supportedModels"))
    operation_modes = normalize_lines(payload.get("operationModes"))
    fan_modes = normalize_lines(payload.get("fanModes"))
    swing_modes = normalize_lines(payload.get("swingModes"))
    commands_in = payload.get("commands", [])

    export = {
        "manufacturer": manufacturer,
        "supportedModels": supported_models,
        "commandsEncoding": "Base64",
        "supportedController": DEFAULT_SUPPORTED_CONTROLLER,
        "minTemperature": int(payload.get("minTemperature", 16)),
        "maxTemperature": int(payload.get("maxTemperature", 31)),
        "precision": int(payload.get("precision", 1)),
        "operationModes": operation_modes,
        "fanModes": fan_modes,
        "swingModes": swing_modes,
        "commands": {},
    }

    for entry in commands_in:
        name = str(entry.get("name", "")).strip()
        code = str(entry.get("code", "")).strip()
        if not name:
            continue
        export["commands"][slugify(name)] = code

    filename = str(payload.get("filename") or EXPORT_FILENAME).strip() or EXPORT_FILENAME
    if not filename.lower().endswith(".json"):
        filename += ".json"

    public_path = PUBLIC_DIR / filename
    data_path = DATA_DIR / filename
    latest_path = PUBLIC_DIR / "latest.json"

    text = json.dumps(export, ensure_ascii=False, indent=2)

    public_path.write_text(text, encoding="utf-8")
    data_path.write_text(text, encoding="utf-8")
    latest_path.write_text(text, encoding="utf-8")

    manifest = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "filename": filename,
        "public_path": str(public_path),
        "data_path": str(data_path),
        "command_count": len(export["commands"]),
    }

    (DATA_DIR / "last_export.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    return jsonify({
        "ok": True,
        "filename": filename,
        "command_count": len(export["commands"]),
        "public_path": str(public_path)
    })


@app.post("/api/learn")
def learn_placeholder():
    payload = request.get_json(silent=True) or {}
    label = str(payload.get("label", "learned_command")).strip()

    return jsonify({
        "ok": False,
        "message": "Branche ici ton backend d’apprentissage IR réel (Broadlink, ESPHome, MQTT, script, etc.).",
        "suggested_name": slugify(label),
        "example_code": "JgBQAAABK5MUNhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSEwAFGQABK0kTAA0FAAAAAAAAAAA="
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8099)