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


def make_png(data: str, box_size: int, ec, fg: str, bg: str) -> bytes:
    qr = qrcode.QRCode(error_correction=ec, box_size=box_size, border=4)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color=fg, back_color=bg)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def make_svg(data: str, ec, fg: str, bg: str) -> str:
    qr = qrcode.QRCode(error_correction=ec, border=4)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(image_factory=qrcode.image.svg.SvgPathImage)
    buf = io.BytesIO()
    img.save(buf)
    svg = buf.getvalue().decode("utf-8")

    # Apply foreground color (replace first fill on the path)
    svg = re.sub(r'(<path\b[^>]*\bfill=")[^"]*(")', rf'\g<1>{fg}\g<2>', svg, count=1)
    if not re.search(r'<path\b[^>]*\bfill=', svg):
        # fill not inline — inject via style
        svg = svg.replace("<path ", f'<path fill="{fg}" ', 1)

    # Always add an explicit background rect so transparency is controlled
    svg = svg.replace("<path ", f'<rect width="100%" height="100%" fill="{bg}"/><path ', 1)

    return svg


@app.route("/")
def index():
    return app.send_static_file("index.html")


@app.route("/preview", methods=["POST"])
def preview():
    body = request.get_json(silent=True) or {}
    data = body.get("data", "").strip()
    fg = body.get("fg_color", "#000000")
    bg = body.get("bg_color", "#ffffff")
    ec = EC_LEVELS.get(body.get("error_correction", "H"), qrcode.constants.ERROR_CORRECT_H)

    if not data:
        return jsonify({"error": "No data"}), 400

    try:
        png = make_png(data, box_size=8, ec=ec, fg=fg, bg=bg)
        b64 = base64.b64encode(png).decode("utf-8")
        return jsonify({"image": f"data:image/png;base64,{b64}"})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/generate", methods=["POST"])
def generate():
    body = request.get_json(silent=True) or {}
    data = body.get("data", "").strip()
    fg = body.get("fg_color", "#000000")
    bg = body.get("bg_color", "#ffffff")
    filename = re.sub(r"[^\w\-]", "_", body.get("filename", "qrcode")) or "qrcode"
    ec = EC_LEVELS.get(body.get("error_correction", "H"), qrcode.constants.ERROR_CORRECT_H)

    if not data:
        return jsonify({"error": "No data provided"}), 400

    try:
        zip_buf = io.BytesIO()
        with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for label, box_size in [("web", 5), ("print", 10), ("hires", 20)]:
                png = make_png(data, box_size=box_size, ec=ec, fg=fg, bg=bg)
                zf.writestr(f"{filename}_{label}.png", png)
            svg = make_svg(data, ec=ec, fg=fg, bg=bg)
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
