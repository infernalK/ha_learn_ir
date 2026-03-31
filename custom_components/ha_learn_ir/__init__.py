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
    """Set up HA Learn IR component minimal template."""

    @staticmethod
    async def handle_dummy(call: ServiceCall) -> None:
        _LOGGER.info("HA Learn IR dummy service called")

    hass.services.async_register(DOMAIN, "dummy", handle_dummy)
    return True

