import io
import re
import zipfile
import base64

from flask import Flask, request, send_file, jsonify
import qrcode
import qrcode.image.svg
from PIL import Image

app = Flask(__name__, static_folder="static", static_url_path="")

EC_LEVELS = {
    "L": qrcode.constants.ERROR_CORRECT_L,
    "M": qrcode.constants.ERROR_CORRECT_M,
    "Q": qrcode.constants.ERROR_CORRECT_Q,
    "H": qrcode.constants.ERROR_CORRECT_H,
}

ALLOWED_IMAGE_TYPES = {
    "image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"
}


def _overlay_logo(qr_img: Image.Image, logo_bytes: bytes, logo_pct: float) -> Image.Image:
    logo = Image.open(io.BytesIO(logo_bytes)).convert("RGBA")
    qr = qr_img.convert("RGBA")
    qr_w, qr_h = qr.size
    max_side = int(min(qr_w, qr_h) * logo_pct)
    logo.thumbnail((max_side, max_side), Image.LANCZOS)
    lw, lh = logo.size
    pos = ((qr_w - lw) // 2, (qr_h - lh) // 2)
    qr.paste(logo, pos, logo)
    return qr.convert("RGB")


def make_png(
    data: str,
    box_size: int,
    ec,
    fg: str,
    bg: str,
    logo: bytes = None,
    logo_pct: float = 0.25,
) -> bytes:
    qr = qrcode.QRCode(error_correction=ec, box_size=box_size, border=4)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color=fg, back_color=bg)
    if logo:
        img = _overlay_logo(img, logo, logo_pct)
    else:
        img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def make_svg(
    data: str,
    ec,
    fg: str,
    bg: str,
    logo: bytes = None,
    logo_mime: str = None,
    logo_pct: float = 0.25,
) -> str:
    qr = qrcode.QRCode(error_correction=ec, border=4)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(image_factory=qrcode.image.svg.SvgPathImage)
    buf = io.BytesIO()
    img.save(buf)
    svg = buf.getvalue().decode("utf-8")

    # Apply foreground color
    svg = re.sub(r'(<path\b[^>]*\bfill=")[^"]*(")', rf'\g<1>{fg}\g<2>', svg, count=1)
    if not re.search(r'<path\b[^>]*\bfill=', svg):
        svg = svg.replace("<path ", f'<path fill="{fg}" ', 1)

    # Always add explicit background
    svg = svg.replace("<path ", f'<rect width="100%" height="100%" fill="{bg}"/><path ', 1)

    # Embed logo as centered <image> element
    if logo:
        # Use viewBox dimensions (always unitless integers) rather than width/height (uses mm)
        m = re.search(r'viewBox="[\d.]+ [\d.]+ ([\d.]+) ([\d.]+)"', svg)
        if m:
            w, h = float(m.group(1)), float(m.group(2))
            side = min(w, h) * logo_pct
            x = (w - side) / 2
            y = (h - side) / 2
            b64 = base64.b64encode(logo).decode("utf-8")
            mime = logo_mime or "image/png"
            img_tag = (
                f'<image href="data:{mime};base64,{b64}" '
                f'x="{x:.2f}" y="{y:.2f}" '
                f'width="{side:.2f}" height="{side:.2f}" '
                f'preserveAspectRatio="xMidYMid meet"/>'
            )
            svg = svg.replace("</svg>", f"{img_tag}</svg>")

    return svg


def _parse_form():
    """Read shared parameters from multipart form data."""
    data = request.form.get("data", "").strip()
    fg = request.form.get("fg_color", "#000000")
    bg = request.form.get("bg_color", "#ffffff")
    ec = EC_LEVELS.get(request.form.get("error_correction", "H"), qrcode.constants.ERROR_CORRECT_H)
    logo_pct = max(0.10, min(0.35, float(request.form.get("logo_size_pct", "0.25"))))

    logo_bytes = None
    logo_mime = None
    logo_file = request.files.get("logo")
    if logo_file and logo_file.filename:
        mime = (logo_file.content_type or "").split(";")[0].strip()
        if mime in ALLOWED_IMAGE_TYPES:
            logo_bytes = logo_file.read()
            logo_mime = mime

    return data, fg, bg, ec, logo_bytes, logo_mime, logo_pct


@app.route("/")
def index():
    return app.send_static_file("index.html")


@app.route("/preview", methods=["POST"])
def preview():
    data, fg, bg, ec, logo, logo_mime, logo_pct = _parse_form()

    if not data:
        return jsonify({"error": "No data"}), 400

    try:
        png = make_png(data, box_size=8, ec=ec, fg=fg, bg=bg, logo=logo, logo_pct=logo_pct)
        b64 = base64.b64encode(png).decode("utf-8")
        return jsonify({"image": f"data:image/png;base64,{b64}"})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/generate", methods=["POST"])
def generate():
    data, fg, bg, ec, logo, logo_mime, logo_pct = _parse_form()
    filename = re.sub(r"[^\w\-]", "_", request.form.get("filename", "qrcode")) or "qrcode"

    if not data:
        return jsonify({"error": "No data provided"}), 400

    try:
        zip_buf = io.BytesIO()
        with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for label, box_size in [("web", 5), ("print", 10), ("hires", 20)]:
                png = make_png(
                    data, box_size=box_size, ec=ec, fg=fg, bg=bg,
                    logo=logo, logo_pct=logo_pct,
                )
                zf.writestr(f"{filename}_{label}.png", png)
            svg = make_svg(data, ec=ec, fg=fg, bg=bg, logo=logo, logo_mime=logo_mime, logo_pct=logo_pct)
            zf.writestr(f"{filename}.svg", svg.encode("utf-8"))

        zip_buf.seek(0)
        return send_file(
            zip_buf,
            mimetype="application/zip",
            as_attachment=True,
            download_name=f"{filename}.zip",
        )
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
