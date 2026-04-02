#!/usr/bin/with-contenv bashio
set -euo pipefail

export EXPORT_FILENAME="$(bashio::config 'export_filename')"
export DEFAULT_MANUFACTURER="$(bashio::config 'default_manufacturer')"
export DEFAULT_SUPPORTED_CONTROLLER="$(bashio::config 'default_supported_controller')"
export LEARN_TIMEOUT_SECONDS="$(bashio::config 'learn_timeout_seconds')"
# Valeur vide si l’option n’est pas encore dans la config utilisateur (mise à jour) — le Python retombe sur 40.
export LEARN_TIMEOUT_SECONDS="${LEARN_TIMEOUT_SECONDS:-40}"

export PUBLIC_DIR="/config"
export DATA_DIR="/config"
export HOMEASSISTANT_CONFIG="/homeassistant"

mkdir -p "$PUBLIC_DIR" "$DATA_DIR"

exec python3 /app/app.py