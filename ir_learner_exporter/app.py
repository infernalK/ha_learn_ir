from flask import Flask, jsonify, request, send_from_directory
import os
import json
import re
import urllib.error
import urllib.request
from pathlib import Path
from datetime import datetime, timezone
from itertools import product

app = Flask(__name__, static_folder="web", static_url_path="")

PUBLIC_DIR = Path(os.environ.get("PUBLIC_DIR", "/config"))
if not PUBLIC_DIR.exists():
    PUBLIC_DIR = Path("/config")

# By convention Home Assistant mounts `type: data` at `/data`.
DATA_DIR = Path(os.environ.get("DATA_DIR", "/data"))

EXPORT_FILENAME = os.environ.get("EXPORT_FILENAME", "learned_codes.json")
DEFAULT_MANUFACTURER = os.environ.get("DEFAULT_MANUFACTURER", "")
DEFAULT_SUPPORTED_CONTROLLER = os.environ.get("DEFAULT_SUPPORTED_CONTROLLER", "Broadlink")

HA_API_BASE = os.environ.get("HA_SUPERVISOR_API", "http://supervisor/core/api").rstrip("/")
SUPERVISOR_TOKEN = (os.environ.get("SUPERVISOR_TOKEN") or "").strip()
HOMEASSISTANT_DIR = Path(os.environ.get("HOMEASSISTANT_CONFIG", "/homeassistant"))

PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)


def _learn_timeout_seconds() -> int:
    raw = (os.environ.get("LEARN_TIMEOUT_SECONDS") or "").strip()
    try:
        v = int(raw)
    except ValueError:
        v = 40
    return max(10, min(v, 120))


def ha_api_post(services_path: str, body: dict, *, timeout: float) -> tuple[int, object]:
    """POST vers l’API Home Assistant (proxy Supervisor). Retourne (status, json|str|list)."""
    if not SUPERVISOR_TOKEN:
        return 0, "SUPERVISOR_TOKEN manquant"
    url = f"{HA_API_BASE}/{services_path.lstrip('/')}"
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {SUPERVISOR_TOKEN}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            status = resp.status
    except urllib.error.HTTPError as e:
        status = e.code
        raw = e.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as e:
        return 0, str(e.reason or e)

    if not raw.strip():
        return status, {}
    try:
        return status, json.loads(raw)
    except json.JSONDecodeError:
        return status, raw


def ha_api_get(path: str, *, timeout: float) -> tuple[int, object]:
    """GET vers l’API Home Assistant (proxy Supervisor). Retourne (status, json|str|list)."""
    if not SUPERVISOR_TOKEN:
        return 0, "SUPERVISOR_TOKEN manquant"
    url = f"{HA_API_BASE}/{path.lstrip('/')}"
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {SUPERVISOR_TOKEN}"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            status = resp.status
    except urllib.error.HTTPError as e:
        status = e.code
        raw = e.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as e:
        return 0, str(e.reason or e)

    if not raw.strip():
        return status, {}
    try:
        return status, json.loads(raw)
    except json.JSONDecodeError:
        return status, raw


def _ha_entity_registry_get(entity_id: str) -> dict | None:
    st, res = ha_api_post(
        "config/entity_registry/get",
        {"entity_id": entity_id},
        timeout=12.0,
    )
    if st != 200 or not isinstance(res, dict):
        return None
    return res


def _default_broadlink_device(entity_id: str) -> str:
    tail = entity_id.split(".", 1)[-1] if "." in entity_id else entity_id
    s = slugify(tail)
    if not s or s == "command":
        return "main"
    return s


def _format_ha_error(result: object, status: int) -> str:
    if isinstance(result, dict) and result.get("message"):
        return f"Home Assistant (HTTP {status}) : {result['message']}"
    if isinstance(result, str) and result.strip():
        return f"Home Assistant (HTTP {status}) : {result}"
    return f"Home Assistant a renvoyé une erreur HTTP {status}."


def _iter_broadlink_code_files() -> list[Path]:
    d = HOMEASSISTANT_DIR / ".storage"
    if not d.is_dir():
        return []
    return sorted(
        (p for p in d.glob("broadlink_remote_*_codes") if p.is_file()),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )


def _snapshot_broadlink_mtimes() -> dict[str, float]:
    return {str(p.resolve()): p.stat().st_mtime for p in _iter_broadlink_code_files()}


def _normalize_ir_code_value(raw) -> str | None:
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    if isinstance(raw, list) and raw:
        first = raw[0]
        if isinstance(first, str) and first.strip():
            return first.strip()
    return None


def _read_broadlink_code_from_file(path: Path, device: str, command: str) -> str | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeDecodeError, TypeError):
        return None
    data = payload.get("data")
    if not isinstance(data, dict):
        return None
    sub = data.get(device)
    if not isinstance(sub, dict):
        return None
    return _normalize_ir_code_value(sub.get(command))


def _extract_broadlink_learned_code(
    device: str,
    command: str,
    before: dict[str, float],
) -> str | None:
    updated: list[tuple[float, Path]] = []
    for p in _iter_broadlink_code_files():
        key = str(p.resolve())
        prev = before.get(key)
        mtime = p.stat().st_mtime
        if prev is None or mtime > prev + 0.05:
            updated.append((mtime, p))
    updated.sort(key=lambda x: x[0], reverse=True)
    for _, p in updated:
        got = _read_broadlink_code_from_file(p, device, command)
        if got:
            return got
    for p in _iter_broadlink_code_files():
        got = _read_broadlink_code_from_file(p, device, command)
        if got:
            return got
    return None


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


def build_combo_name(mode, temperature, fan, swing=None):
    parts = [slugify(mode), str(int(temperature)), slugify(fan)]
    if swing is not None and str(swing).strip() != "":
        parts.append(slugify(swing))
    return "_".join(parts)


def parse_combo_parts(name: str):
    """Décode les noms issus de build_combo_name.

    - Sans swing : ``mode_temp_fan`` (ex. ``heat_cool_24_low`` — le mode peut contenir des ``_``).
    - Avec swing : ``mode_temp_fan_swing``.

    La température est le premier segment entièrement numérique.
    """
    parts = name.split("_")
    temp_idx = next((i for i, p in enumerate(parts) if p.isdigit()), None)
    if temp_idx is None or temp_idx == 0:
        return None
    mode = "_".join(parts[:temp_idx])
    temp = parts[temp_idx]
    rest = parts[temp_idx + 1:]
    if len(rest) == 1:
        return mode, temp, rest[0], None
    if len(rest) == 2:
        return mode, temp, rest[0], rest[1]
    return None


def canonical_fan_swing(slug: str, candidates: list) -> str:
    """Rétablit la casse / libellé des listes fanModes / swingModes (ex. 1133.json)."""
    if candidates:
        s = slugify(slug)
        for c in candidates:
            if slugify(str(c)) == s:
                return str(c).strip()
    return slug


@app.get("/")
def index():
    resp = send_from_directory(app.static_folder, "ir-learner.html")
    # Empêche le navigateur iOS de garder une ancienne version du HTML.
    resp.headers["Cache-Control"] = "no-store, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    # Home Assistant / Ingress peut appliquer une CSP restrictive.
    # Comme cette UI utilise des scripts/labels inline, on autorise explicitement.
    # (Si une CSP externe est aussi injectée, ça peut être plus strict; dans ce cas, il faudra passer
    # par un script externe.)
    resp.headers["Content-Security-Policy"] = (
        "default-src 'self' data: blob:; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: blob:; "
        "connect-src 'self' https: http:; "
        "base-uri 'self'; "
        "object-src 'none'"
    )
    return resp


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


@app.get("/api/paths")
def paths():
    return jsonify({
        "public_dir": str(PUBLIC_DIR),
        "data_dir": str(DATA_DIR),
        "homeassistant_dir": str(HOMEASSISTANT_DIR),
        "homeassistant_accessible": HOMEASSISTANT_DIR.is_dir(),
        "ha_api_configured": bool(SUPERVISOR_TOKEN),
        "cwd": str(Path.cwd()),
        "exists_public_dir": PUBLIC_DIR.exists(),
        "exists_data_dir": DATA_DIR.exists(),
        "env_PUBLIC_DIR": os.environ.get("PUBLIC_DIR"),
        "env_DATA_DIR": os.environ.get("DATA_DIR"),
        "env_EXPORT_FILENAME": os.environ.get("EXPORT_FILENAME"),
    })


@app.get("/api/files")
def list_files():
    # Be tolerant: some setups may end up with files in either addon_config (/config)
    # or the internal persistent dir (/data).
    public_files = [p.name for p in PUBLIC_DIR.glob("*.json") if p.is_file()] if PUBLIC_DIR.exists() else []
    data_files = [p.name for p in DATA_DIR.glob("*.json") if p.is_file()] if DATA_DIR.exists() else []
    files = sorted(set(public_files) | set(data_files))
    return jsonify({
        "ok": True,
        "files": files,
        "public_dir": str(PUBLIC_DIR),
        "data_dir": str(DATA_DIR),
    })


@app.get("/api/remote_entities")
def remote_entities():
    status, result = ha_api_get("states", timeout=15.0)
    if status == 0:
        return jsonify({"ok": False, "error": f"Impossible de joindre Home Assistant: {result}"}), 502
    if status != 200 or not isinstance(result, list):
        return jsonify({"ok": False, "error": _format_ha_error(result, status)}), 502

    entities = []
    for item in result:
        if not isinstance(item, dict):
            continue
        entity_id = str(item.get("entity_id") or "")
        if not entity_id.startswith("remote."):
            continue
        attrs = item.get("attributes") if isinstance(item.get("attributes"), dict) else {}
        features = int(attrs.get("supported_features") or 0)
        state = str(item.get("state") or "")
        available = state not in ("unavailable", "unknown")
        # remote.RemoteEntityFeature.LEARN_COMMAND == 1
        supports_learn = bool(features & 1)
        entities.append({
            "entity_id": entity_id,
            "name": str(attrs.get("friendly_name") or entity_id),
            "supports_learn": supports_learn,
            "available": available,
            "state": state,
        })

    entities.sort(key=lambda e: (not e["available"], not e["supports_learn"], e["name"].lower(), e["entity_id"]))
    return jsonify({"ok": True, "entities": entities})


@app.get("/api/load")
def load_file():
    filename = str(request.args.get("filename", "")).strip()
    if not filename or any(c in filename for c in ['..', '/', '\\']):
        return jsonify({"ok": False, "error": "Nom de fichier invalide"}), 400

    path_public = PUBLIC_DIR / filename
    path_data = DATA_DIR / filename
    chosen_path = None
    chosen_dir = None

    if path_public.exists() and path_public.is_file():
        chosen_path = path_public
        chosen_dir = "public"
    elif path_data.exists() and path_data.is_file():
        chosen_path = path_data
        chosen_dir = "data"
    else:
        return jsonify({"ok": False, "error": "Fichier introuvable"}), 404

    try:
        raw = chosen_path.read_text(encoding="utf-8")
        data = json.loads(raw)
        return jsonify({
            "ok": True,
            "filename": filename,
            "source": chosen_dir,
            "data": data
        })
    except json.JSONDecodeError as e:
        return jsonify({"ok": False, "error": f"JSON invalide: {e}"}), 400
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.post("/api/generate_matrix")
def generate_matrix():
    payload = request.get_json(force=True)

    min_t = int(payload.get("minTemperature", 16))
    max_t = int(payload.get("maxTemperature", 31))
    precision = max(1, int(payload.get("precision", 1)))

    if max_t < min_t:
        return jsonify({
            "ok": False,
            "error": "La température max ne peut pas être inférieure à la température min."
        }), 400

    modes = normalize_lines(payload.get("operationModes"))
    fan_modes = normalize_lines(payload.get("fanModes"))
    swing_modes = normalize_lines(payload.get("swingModes"))

    include_off = bool(payload.get("includeOff", True))

    combos = []

    if include_off:
        combos.append({"name": "off", "code": ""})


    temps = list(range(min_t, max_t + 1, precision))

    if swing_modes:
        for mode, temp, fan, swing in product(modes, temps, fan_modes, swing_modes):
            combos.append({
                "name": build_combo_name(mode, temp, fan, swing),
                "code": ""
            })
    else:
        for mode, temp, fan in product(modes, temps, fan_modes):
            combos.append({
                "name": build_combo_name(mode, temp, fan),
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

    commands = []
    if "off" in commands_map:
        commands.append({"name": "off", "code": commands_map["off"]})

    for mode, mode_data in commands_map.items():
        if mode == "off":
            continue
        if isinstance(mode_data, dict):
            for fan, fan_data in mode_data.items():
                if isinstance(fan_data, dict):
                    for swing, swing_data in fan_data.items():
                        if isinstance(swing_data, dict):
                            for temp, code in swing_data.items():
                                name = f"{mode}_{temp}_{fan.lower()}_{swing.lower()}"
                                commands.append({"name": name, "code": code})
                        else:
                            # no swing, it's mode->fan->temp
                            temp = str(swing).strip()
                            commands.append({"name": f"{mode}_{temp}_{fan.lower()}", "code": swing_data})
                else:
                    # no swing, maybe mode->fan directly
                    commands.append({"name": f"{mode}_{fan.lower()}", "code": fan_data})
        else:
            commands.append({"name": mode, "code": mode_data})

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
    try:
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
            "commands": {},
        }
        if swing_modes:
            export["swingModes"] = swing_modes

        commands = export["commands"]

        for entry in commands_in:
            name = str(entry.get("name", "")).strip()
            code = str(entry.get("code", "")).strip()
            if not name or not code:
                continue
            if name == "off":
                commands["off"] = code
                continue
            parsed = parse_combo_parts(name)
            if parsed:
                mode, temp, fan_raw, swing_raw = parsed
                mode_key = mode.lower()
                fan_key = canonical_fan_swing(fan_raw, fan_modes)
                if swing_raw is not None:
                    swing_key = canonical_fan_swing(swing_raw, swing_modes)
                    if mode_key not in commands:
                        commands[mode_key] = {}
                    if fan_key not in commands[mode_key]:
                        commands[mode_key][fan_key] = {}
                    if swing_key not in commands[mode_key][fan_key]:
                        commands[mode_key][fan_key][swing_key] = {}
                    commands[mode_key][fan_key][swing_key][temp] = code
                else:
                    if mode_key not in commands:
                        commands[mode_key] = {}
                    if fan_key not in commands[mode_key]:
                        commands[mode_key][fan_key] = {}
                    commands[mode_key][fan_key][temp] = code
                continue
            commands[name] = code

        filename = str(payload.get("filename") or EXPORT_FILENAME).strip() or EXPORT_FILENAME
        if not filename.lower().endswith(".json"):
            filename += ".json"

        public_path = PUBLIC_DIR / filename
        data_path = DATA_DIR / filename

        text = json.dumps(export, ensure_ascii=False, indent=2)

        written = {}
        errors = []

        for path in [public_path, data_path]:
            try:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(text, encoding="utf-8")
                written[str(path)] = True
                print(f"[DEBUG] Wrote file: {path}")
            except Exception as exc:
                written[str(path)] = False
                errors.append(f"{path}: {exc}")
                print(f"[ERROR] Could not write file {path}: {exc}")

        return jsonify({
            "ok": True,
            "filename": filename,
            "command_count": len(export["commands"]),
            "public_path": str(public_path),
            "data_path": str(data_path),
            "written": written,
            "errors": errors,
        })
    except Exception as e:
        print(f"[ERROR] Export failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "ok": False,
            "error": str(e)
        }), 500


@app.post("/api/learn")
def learn_ir():
    payload = request.get_json(silent=True) or {}
    label = str(payload.get("label", "learned_command")).strip() or "learned_command"
    entity_id = str(payload.get("entity_id") or payload.get("entityId") or "").strip()

    if not entity_id:
        return jsonify({"ok": False, "message": "Renseigne l’entité remote.* ."}), 400
    if not entity_id.startswith("remote."):
        return jsonify({"ok": False, "message": "L’entité doit commencer par remote."}), 400

    # Garde-fou: ne pas lancer learn_command si l'entité est indisponible.
    state_status, state_result = ha_api_get(f"states/{entity_id}", timeout=10.0)
    if state_status == 200 and isinstance(state_result, dict):
        current_state = str(state_result.get("state") or "")
        if current_state in ("unavailable", "unknown"):
            return jsonify({
                "ok": False,
                "message": (
                    f"L’entité {entity_id} est '{current_state}'. "
                    "Apprentissage bloqué tant qu’elle n’est pas disponible."
                ),
                "entity_id": entity_id,
            }), 409

    if not SUPERVISOR_TOKEN:
        return jsonify({
            "ok": False,
            "message": (
                "Accès API Home Assistant indisponible. "
                "Ajoute homeassistant_api: true dans config.yaml de l’add-on, reconstruis et redémarre."
            ),
        }), 503

    timeout_sec = _learn_timeout_seconds()
    device_override = str((payload.get("device") or "")).strip()
    reg = _ha_entity_registry_get(entity_id)
    platform = str((reg or {}).get("platform") or "").lower()

    service_data: dict = {
        "entity_id": entity_id,
        "command": [label],
        "timeout": timeout_sec,
    }
    if device_override:
        service_data["device"] = device_override
    elif platform == "broadlink":
        # Broadlink exige « device » (slot) dans remote.learn_command.
        service_data["device"] = _default_broadlink_device(entity_id)

    http_timeout = float(timeout_sec) + 35.0

    def call_learn(data: dict) -> tuple[int, object]:
        return ha_api_post(
            "services/remote/learn_command",
            dict(data),
            timeout=http_timeout,
        )

    snap = _snapshot_broadlink_mtimes()
    status, result = call_learn(service_data)

    if status == 400 and "timeout" in service_data:
        sd = {k: v for k, v in service_data.items() if k != "timeout"}
        st2, res2 = call_learn(sd)
        if st2 == 200:
            status, result = st2, res2
            service_data = sd

    if status == 400 and "device" not in service_data:
        sd = dict(service_data)
        sd["device"] = _default_broadlink_device(entity_id)
        st3, res3 = call_learn(sd)
        if st3 == 200:
            status, result = st3, res3
            service_data = sd
        elif st3 == 400 and "timeout" in sd:
            sd4 = {k: v for k, v in sd.items() if k != "timeout"}
            st4, res4 = call_learn(sd4)
            if st4 == 200:
                status, result = st4, res4
                service_data = sd4

    if status == 0:
        return jsonify({
            "ok": False,
            "message": f"Impossible de joindre Home Assistant : {result}",
            "suggested_name": slugify(label),
            "entity_id": entity_id,
        }), 502

    if status != 200:
        hint = ""
        if status == 400:
            hint = (
                " Vérifie dans Outils de développement que la commande « learn » fonctionne "
                "avec les mêmes paramètres (certaines intégrations exigent un slot « device », ex. Broadlink)."
            )
        return jsonify({
            "ok": False,
            "message": _format_ha_error(result, status) + hint,
            "suggested_name": slugify(label),
            "entity_id": entity_id,
        }), 502

    code = None
    code_source = None
    slot = service_data.get("device")
    if isinstance(slot, str) and slot.strip():
        code = _extract_broadlink_learned_code(slot.strip(), label, snap)
        if code:
            code_source = "broadlink_storage"

    if code:
        msg = (
            "Apprentissage terminé. Code Base64 lu depuis le stockage Broadlink de Home Assistant."
        )
    else:
        msg = "Home Assistant a exécuté remote.learn_command. "
        msg += (
            "Le code peut nécessiter une récupération manuelle selon l’intégration (outils développeur / notification HA)."
        )

    out = {
        "ok": True,
        "message": msg,
        "code": code,
        "code_source": code_source,
        "suggested_name": slugify(label),
        "entity_id": entity_id,
    }
    dev_out = service_data.get("device")
    if isinstance(dev_out, str) and dev_out.strip():
        out["device"] = dev_out.strip()
    return jsonify(out)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8099)