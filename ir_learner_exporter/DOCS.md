# IR Learner Exporter

This add-on provides a web interface for learning and exporting IR codes for Home Assistant.

## Features

- Web-based interface accessible via Home Assistant sidebar
- Learn IR codes from devices
- Export codes in JSON format compatible with IR integrations
- Support for Broadlink and other IR controllers

## Configuration

No configuration required. The add-on runs on port 8099 with ingress enabled.

## Usage

1. Install and start the add-on
2. Access via Home Assistant sidebar or "Open Web UI"
3. Enter device information and learn IR codes
4. Export the JSON file

## API

- `POST /api/learn`: Learn an IR code (currently stub)
- `POST /api/export`: Export learned codes to JSON

## Files

Exported JSON files are saved to `/config/` and `/data/` directories.