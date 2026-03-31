from __future__ import annotations

import json
import logging
from typing import Any

import aiofiles

from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers.typing import ConfigType
from homeassistant.config_entries import ConfigEntry

from .const import DOMAIN, PLATFORMS

_LOGGER = logging.getLogger(__name__)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up HA Learn IR component."""
    async def handle_create_ir_code(call: ServiceCall) -> None:
        platform = call.data.get("platform")
        code = call.data.get("code")
        data = call.data.get("data")
        try:
            json_data = json.loads(data)
            file_path = hass.config.path(f"custom_components/ha_learn_ir/codes/{platform}/{code}.json")
            async with aiofiles.open(file_path, 'w') as f:
                await f.write(json.dumps(json_data, indent=2))
            _LOGGER.info(f"Created IR code file: {file_path}")
        except Exception as e:
            _LOGGER.error(f"Failed to create IR code file: {e}")

    hass.services.async_register(DOMAIN, "create_ir_code", handle_create_ir_code)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up AR Smart IR from a config entry."""

    platform: str | None = entry.data.get("platform")

    if platform not in PLATFORMS:
        _LOGGER.error("Unsupported AR Smart IR platform: %s", platform)
        return False

    entry.async_on_unload(entry.add_update_listener(_async_update_listener))
    await hass.config_entries.async_forward_entry_setups(entry, [platform])

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload AR Smart IR config entry."""

    platform: str | None = entry.data.get("platform")

    if platform not in PLATFORMS:
        return True

    return await hass.config_entries.async_unload_platforms(entry, [platform])


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)
