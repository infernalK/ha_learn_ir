# IR Learner Exporter

[![GitHub release](https://img.shields.io/github/v/release/user/ha_learn_ir.svg)](https://github.com/user/ha_learn_ir/releases)

Addon Home Assistant pour apprendre et exporter des codes IR.

---

# ✨ Fonctionnalités

- 🌡️ Interface web pour saisir les métadonnées des appareils IR
- 📺 Ajouter des commandes IR encodées en Base64
- 🌀 Exporter des fichiers JSON compatibles avec les intégrations IR
- 💡 Point d'intégration pour backends d'apprentissage IR réels
- ⚙️ Accès via la barre latérale Home Assistant (Ingress)
- 🖥️ Interface moderne et responsive

---

# 🚀 Installation

1. Ajouter ce dépôt à votre installation Home Assistant Add-ons
2. Installer l'addon "IR Learner Exporter"
3. Démarrer l'addon
4. Ouvrir l'interface via "OPEN WEB UI" ou la barre latérale

---

# 📋 Utilisation

1. Saisir les informations du fabricant et des modèles
2. Ajouter des commandes IR (manuellement ou via apprentissage)
3. Générer le fichier JSON exporté dans `/config/`

---

# 🔧 Configuration Backend

Le bouton "Apprendre" appelle `/api/learn` - reliez-le à votre backend IR réel :

- Broadlink Python
- ESPHome IR receiver
- MQTT bridge
- Commande shell

---

# 📁 Structure des fichiers exportés

```json
{
  "manufacturer": "Mitsubishi Electric",
  "supportedModels": ["MSXY-FN10VE"],
  "commandsEncoding": "Base64",
  "supportedController": "Broadlink",
  "minTemperature": 16,
  "maxTemperature": 31,
  "precision": 1,
  "operationModes": ["cool", "dry", "fanonly"],
  "fanModes": ["Auto", "Low", "Mid", "High"],
  "swingModes": ["Auto", "Top", "Mid", "Bottom"],
  "commands": {
    "off": "JgBQAAABK5MUNhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSEwAFGQABK0kTAA0FAAAAAAAAAAA=",
    "cool_24_auto_auto": "JgBQAAABKpQTEhQRFBIUEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhMSExITEhQRFQAFGQABKUkUAA0FAAAAAAAAAAA="
  }
}
```

---

# 🆕 Différences avec les intégrations classiques

- ✅ Interface web moderne via Ingress
- ✅ Pas de configuration YAML
- ✅ Export direct de fichiers JSON
- ✅ Intégration facile avec backends IR personnalisés
- ✅ Better compatibility with newer Home Assistant versions
- ✅ Faster async processing
- ✅ Easier installation for users and installers

---

# 📦 Installation

## Install via HACS (Recommended)

Click the button below to open the repository in HACS:

[![Open your Home Assistant instance and open this repository in HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?repository=marsh4200/ar_smart_ir&category=integration)

---

##### Manual Installation

Copy the integration into your Home Assistant `custom_components` directory:

```text
config/
└── custom_components/
    └── ar_smart_ir/
        ├── __init__.py
        ├── manifest.json
        ├── config_flow.py
        ├── climate.py
        ├── fan.py
        ├── light.py
        ├── media_player.py
        ├── controller.py
        ├── services.yaml
        ├── strings.json
        ├── translations/
        │   └── en.json
        ├── codes/
        │   └── climate/
        │       └── 1000.json
        │   └── media_player/
        │       └── 1000.json
        │   └── light/
        │       └── 1000.json
        │   └── fan/
        │       └── 1000.json
        └── icons.png

---

# 🔧 Setup

After installation:

1. Restart **Home Assistant**
2. Go to **Settings → Devices & Services**
3. Click **Add Integration**
4. Search for **AR Smart IR**
5. Follow the setup wizard

---

# 📡 IR Codes Database

AR Smart IR uses a **local IR code database** stored in the integration.

Location:


custom_components/ar_smart_ir/codes/


Each supported device type has its own folder.

Example:


codes/climate
codes/media_player
codes/fan
codes/light


Each device is defined using a **JSON command file**.

Example structure:

```json
{
  "manufacturer": "ExampleBrand",
  "supportedModels": ["Model123"],
  "commands": {
    "power_on": "2600 0000 006D 0022 ...",
    "power_off": "2600 0000 006D 0022 ..."
  }
}

This system allows new devices to be easily added to the database.

🏠 Supported Device Types

AR Smart IR currently supports:

Climate devices

Media players

Fans

Lights

Device control is achieved by sending infrared commands through supported controller platforms.


🙌 Credits

AR Smart IR is inspired by earlier infrared integration concepts developed by the Home Assistant community.

This project focuses on improving usability, modern compatibility, and UI-based setup for infrared device control.

📌 Notes

AR Smart IR provides a cleaner and more modern IR integration experience for Home Assistant.

By removing YAML configuration and enabling full UI setup, it simplifies infrared device management for both users and installers.
