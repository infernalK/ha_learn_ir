# IR Learner Exporter

This Home Assistant addon provides a web interface for learning and exporting IR codes.

## Installation

1. Add this repository to your Home Assistant add-on repositories
2. Install the "IR Learner Exporter" addon
3. Start the addon
4. Access via the sidebar or "Open Web UI"

## Usage

- Enter device manufacturer and model information
- Add IR commands manually or use the "Learn" button (requires backend integration)
- Export JSON files compatible with IR integrations

## API

- `POST /api/learn`: Stub for learning IR codes
- `POST /api/export`: Export learned codes to JSON format

## Configuration

No configuration required. The addon runs on port 8099 with ingress enabled.