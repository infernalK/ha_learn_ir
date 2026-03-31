#!/usr/bin/with-contenv bashio
set -euo pipefail

export EXPORT_FILENAME="$(bashio::config 'export_filename')"
export DEFAULT_MANUFACTURER="$(bashio::config 'default_manufacturer')"
export DEFAULT_SUPPORTED_CONTROLLER="$(bashio::config 'default_supported_controller')"

export PUBLIC_DIR="/homeassistant/.storage"
export DATA_DIR="/homeassistant"

mkdir -p "$PUBLIC_DIR" "$DATA_DIR"

exec python3 /app/app.py