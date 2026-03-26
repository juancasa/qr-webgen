# CLAUDE.md — QR Code Web Generator

## Project Overview

Self-hosted QR code generator running as a Docker container. Python/Flask backend, vanilla JS frontend, no external dependencies at runtime. Privacy-first: zero logging, zero storage.

## Architecture

```
Browser → Flask (/preview, /generate) → qrcode lib → PNG/SVG → ZIP
```

All QR data **formatting** (vCard, WiFi, VEVENT, otpauth, etc.) is done **client-side** in `app/static/app.js`. The Flask backend receives only the final encoded string and generates images. This keeps the backend simple and ensures no semantic data touches the server logs.

## Key Files

| File | Role |
|------|------|
| `app/main.py` | Flask app — two endpoints: `/preview` (PNG base64) and `/generate` (ZIP download) |
| `app/static/app.js` | All QR type definitions, field descriptors, data formatters, live preview logic |
| `app/static/style.css` | CSS custom properties, responsive two-column layout |
| `app/static/index.html` | Shell only — all DOM built dynamically by `app.js` |
| `app/Pipfile` | pipenv manifest (Flask, qrcode[pil], gunicorn, lxml) |
| `Dockerfile` | python:3.12-slim, pipenv install --system, gunicorn |
| `docker-compose.yml` | Port 5000, read-only FS, tmpfs /tmp |

## Development Workflow

```bash
# Start dev server
cd app
pipenv shell
python main.py          # :5000, Flask dev server

# Or with gunicorn (mirrors prod)
pipenv run gunicorn --bind 0.0.0.0:5000 --reload main:app

# Docker
docker compose up --build
```

**Always work inside the pipenv environment** for Python changes. Dependencies live in `app/Pipfile` and `app/Pipfile.lock`.

## Adding a New QR Type

1. Add an entry to the `TYPES` array in `app.js`
2. Add a `case` to `getFields()` returning the field descriptor array
3. Add a `case` to `formatQRData()` returning the encoded string
4. No backend changes needed

## Backend Endpoints

### POST /preview
- Input: `{ data, fg_color, bg_color, error_correction }`
- Output: `{ image: "data:image/png;base64,..." }`
- Uses `box_size=8` (preview quality)

### POST /generate
- Input: `{ data, fg_color, bg_color, error_correction, filename }`
- Output: `application/zip` with `{filename}_web.png`, `{filename}_print.png`, `{filename}_hires.png`, `{filename}.svg`
- PNG box sizes: web=5, print=10, hires=20

## SVG Color Handling

The `qrcode` library SVG output is post-processed with regex to apply custom fg/bg colors. A `<rect>` background element is always injected before the `<path>` to ensure the background color is explicit (SVG default is transparent).

## Constraints & Decisions

- **No JS framework** — keeps the container image small and avoids CDN dependency
- **No database / no logging** — privacy requirement; do not add request logging
- **`read_only: true`** in docker-compose — container FS is immutable; use `tmpfs` for any temp files
- **Pipenv in Docker** uses `--system` flag so packages install into system Python (no nested venv)
- Filename is sanitised server-side with `re.sub(r'[^\w\-]', '_', ...)` before use in ZIP
