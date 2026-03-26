# QR Code Web Generator

A self-hosted web application that generates high-resolution QR codes and packages them into a downloadable ZIP file — no data logged, no requests stored, fully anonymous.

## Features

- **9 QR code types** — URL, Contact (vCard), Wi-Fi, Payment, App Download, Location, Calendar Event, TOTP Authentication, Plain Text
- **3 PNG resolutions** — web (~300 px), print (~600 px), hi-res (~1200 px)
- **Scalable SVG** — vector output for unlimited scaling
- **Logo overlay** — embed an image in the center of the QR code (PNG/JPG/WebP/SVG)
- **Custom colors** — choose foreground and background colors
- **Error correction** — L / M / Q / H (High recommended for logo overlays)
- **Live preview** — see the QR code update as you type
- **Privacy-first** — zero storage, zero logging, runs entirely in Docker

## Running with Docker

### Option 1 — docker compose (recommended)

```bash
git clone git@github.com:juancasa/qr-webgen.git
cd qr-webgen
docker compose up --build
```

### Option 2 — build and run manually

```bash
docker build -t jcasanas/qr-webgen .
docker run -p 5000:5000 jcasanas/qr-webgen
```

Open [http://localhost:5000](http://localhost:5000).

**Useful run flags:**

```bash
# Run in the background
docker run -d -p 5000:5000 --name qr-webgen jcasanas/qr-webgen

# View logs
docker logs qr-webgen

# Stop and remove
docker stop qr-webgen && docker rm qr-webgen
```

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

## Logo Overlay

Upload any PNG, JPG, GIF, WebP, or SVG image to embed it centered on the QR code. The logo is applied to all three PNG sizes and embedded as a `<image>` element in the SVG.

- Use a **transparent PNG** for best results
- Keep the logo under **35%** of the QR area to preserve scannability
- **High error correction** is recommended — it allows up to 30% of the code to be obscured

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

Both endpoints accept `multipart/form-data`.

### `POST /preview`

Returns a base64-encoded PNG for live UI preview.

| Field | Type | Description |
|-------|------|-------------|
| `data` | string | Formatted QR content |
| `fg_color` | string | Foreground hex color (default `#000000`) |
| `bg_color` | string | Background hex color (default `#ffffff`) |
| `error_correction` | string | `L` / `M` / `Q` / `H` (default `H`) |
| `logo` | file | Optional image to overlay |
| `logo_size_pct` | float | Logo size as fraction of QR side (default `0.25`) |

Response: `{ "image": "data:image/png;base64,..." }`

### `POST /generate`

Returns a ZIP file containing the three PNG sizes and the SVG.

| Field | Type | Description |
|-------|------|-------------|
| `data` | string | Formatted QR content |
| `fg_color` | string | Foreground hex color |
| `bg_color` | string | Background hex color |
| `error_correction` | string | `L` / `M` / `Q` / `H` |
| `filename` | string | Base name for output files (default `qrcode`) |
| `logo` | file | Optional image to overlay |
| `logo_size_pct` | float | Logo size as fraction of QR side |

Response: `application/zip`

## Privacy

- No database, no session storage, no request logging
- The Docker container runs with a read-only filesystem (`read_only: true`) and a tmpfs `/tmp`
- All QR data formatting happens client-side in the browser; the server only generates images
