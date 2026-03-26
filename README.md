# QR Code Web Generator

A self-hosted web application that generates high-resolution QR codes and packages them into a downloadable ZIP file — no data logged, no requests stored, fully anonymous.

## Features

- **9 QR code types** — URL, Contact (vCard), Wi-Fi, Payment, App Download, Location, Calendar Event, TOTP Authentication, Plain Text
- **3 PNG resolutions** — web (~300 px), print (~600 px), hi-res (~1200 px)
- **Scalable SVG** — vector output for unlimited scaling
- **Custom colors** — choose foreground and background colors
- **Error correction** — L / M / Q / H (High recommended for logo overlays)
- **Live preview** — see the QR code update as you type
- **Privacy-first** — zero storage, zero logging, runs entirely in Docker

## Quick Start

```bash
docker compose up --build
```

Open [http://localhost:5000](http://localhost:5000).

## Supported QR Code Types

| Type | Description |
|------|-------------|
| **Link / URL** | Website, YouTube, social media, digital menu |
| **Contact (vCard)** | Name, phone, email, org, address — scans straight into contacts |
| **Wi-Fi** | SSID + password for WPA/WPA2, WEP, or open networks |
| **Payment** | PayPal.me, CashApp, Bitcoin, Ethereum |
| **App Download** | App Store or Google Play Store direct link |
| **Location** | `geo:` URI — opens in Google Maps / Apple Maps |
| **Calendar Event** | VEVENT — adds directly to calendar on scan |
| **TOTP Auth** | `otpauth://` — imports into Authenticator apps |
| **Plain Text** | Up to ~4 000 characters of raw text |

## Output ZIP Contents

Each download is named after the filename you set and contains:

```
qrcode_web.png    — optimised for screens / digital use
qrcode_print.png  — standard print quality
qrcode_hires.png  — large-format / high-DPI print
qrcode.svg        — infinitely scalable vector
```

## Tech Stack

| Layer | Tool |
|-------|------|
| Backend | Python 3.12 + Flask 3 |
| QR generation | [qrcode](https://github.com/lincolnloop/python-qrcode) + Pillow |
| Server | Gunicorn |
| Frontend | Vanilla HTML / CSS / JS — no framework, no CDN |
| Container | Docker (python:3.12-slim) |
| Dependency management | pipenv |

## Development

```bash
cd app
pipenv install
pipenv shell
python main.py       # Flask dev server on :5000
```

### Project Layout

```
qr-webgen/
├── Dockerfile
├── docker-compose.yml
└── app/
    ├── main.py          # Flask app — /preview and /generate endpoints
    ├── Pipfile
    ├── Pipfile.lock
    └── static/
        ├── index.html
        ├── style.css
        └── app.js       # QR type definitions, formatters, live preview
```

## API Endpoints

### `POST /preview`

Returns a base64-encoded PNG for live UI preview.

```json
{
  "data": "<formatted QR string>",
  "fg_color": "#000000",
  "bg_color": "#ffffff",
  "error_correction": "H"
}
```

Response: `{ "image": "data:image/png;base64,..." }`

### `POST /generate`

Returns a ZIP file containing the three PNG sizes and the SVG.

```json
{
  "data": "<formatted QR string>",
  "fg_color": "#000000",
  "bg_color": "#ffffff",
  "error_correction": "H",
  "filename": "qrcode"
}
```

Response: `application/zip`

## Privacy

- No database, no session storage, no request logging
- The Docker container runs with a read-only filesystem (`read_only: true`) and a tmpfs `/tmp`
- All QR data formatting happens client-side in the browser; the server only generates images
