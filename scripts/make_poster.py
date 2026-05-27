#!/usr/bin/env python3
"""Generate an A4, T812-themed memory-wall poster with an embedded QR code.

The QR points at the memory wall; the URL text is deliberately NOT printed.
Outputs poster.html (editable source). Render to PDF/PNG separately.

    ./.venv/bin/python scripts/make_poster.py
"""
import base64
import io
from pathlib import Path
import segno

ROOT = Path(__file__).resolve().parent.parent
URL = "https://calerio.github.io/t812-archive/wall.html"
OUT = ROOT / "poster.html"

# High error-correction so the code stays robust even printed small / on grain.
qr = segno.make(URL, error="h")
buf = io.BytesIO()
# high-res PNG so it stays crisp at print size; ink on white for reliable scans
qr.save(buf, kind="png", scale=20, border=3, dark="#2c2620", light="#ffffff")
qr_b64 = base64.b64encode(buf.getvalue()).decode("ascii")
qr_img = f'<img src="data:image/png;base64,{qr_b64}" alt="">'

HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>T812 · Memory Wall poster</title>
<style>
  :root {
    --paper: #efe7d6; --paper2: #f6f0e3; --ink: #2c2620;
    --muted: #8a7d68; --accent: #c0603f; --card: #fffdf8;
    --tape: rgba(206, 188, 140, 0.62);
    --hand: "Bradley Hand", "Segoe Print", "Comic Sans MS", cursive;
    --serif: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  }
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  .sheet {
    position: relative; width: 210mm; height: 297mm; overflow: hidden;
    color: var(--ink); font-family: var(--serif);
    background-color: var(--paper);
    background-image:
      radial-gradient(circle at 50% -8%, #faf5ea, transparent 55%),
      radial-gradient(circle at 0% 100%, rgba(192,96,63,0.07), transparent 42%),
      radial-gradient(circle at 100% 0%, rgba(138,125,104,0.10), transparent 38%),
      repeating-linear-gradient(0deg, rgba(0,0,0,0.012) 0 2px, transparent 2px 4px);
    display: flex; flex-direction: column; align-items: center;
    padding: 24mm 18mm 18mm;
  }
  /* thin inner frame */
  .sheet::after {
    content: ""; position: absolute; inset: 9mm;
    border: 1px solid rgba(44,38,32,0.18); border-radius: 2mm; pointer-events: none;
  }
  .kicker {
    font-family: var(--serif); letter-spacing: .42em; text-transform: uppercase;
    font-size: 11pt; color: var(--muted); margin: 0 0 6mm;
  }
  .brand {
    font-family: var(--serif); font-weight: 800; letter-spacing: .14em;
    font-size: 58pt; line-height: 1; margin: 0; color: var(--ink);
  }
  .rule { width: 28mm; height: 2px; background: var(--accent); margin: 6mm 0 5mm; border-radius: 2px; }
  .lead {
    font-family: var(--hand); font-size: 23pt; color: var(--accent);
    margin: 0 0 2mm; text-align: center;
  }
  .sub {
    font-size: 12.5pt; color: var(--ink); max-width: 120mm; text-align: center;
    margin: 0 0 11mm; line-height: 1.5;
  }
  /* polaroid that frames the QR */
  .polaroid {
    position: relative; background: var(--card); padding: 7mm 7mm 14mm;
    box-shadow: 0 10px 26px rgba(44,38,32,0.22);
    transform: rotate(-1.6deg); border-radius: 1.5mm;
  }
  .polaroid::before, .polaroid::after {
    content: ""; position: absolute; width: 34mm; height: 11mm;
    background: var(--tape); top: -5mm;
    box-shadow: 0 1px 2px rgba(0,0,0,0.08);
  }
  .polaroid::before { left: 8mm; transform: rotate(-6deg); }
  .polaroid::after  { right: 8mm; transform: rotate(5deg); }
  .qr { width: 92mm; height: 92mm; display: block; }
  .qr img { width: 100%; height: 100%; display: block; image-rendering: pixelated; }
  .caption {
    font-family: var(--hand); font-size: 19pt; color: var(--ink);
    text-align: center; margin-top: 9mm;
  }
  .howto {
    margin-top: auto; text-align: center; color: var(--muted);
    font-size: 11pt; letter-spacing: .04em;
  }
  .howto .step { font-family: var(--hand); color: var(--ink); font-size: 14pt; }
  .signoff { font-family: var(--hand); color: var(--accent); font-size: 14pt; margin-top: 4mm; }
</style>
</head>
<body>
  <div class="sheet">
    <p class="kicker">flat &middot; the archive</p>
    <h1 class="brand">T812</h1>
    <div class="rule"></div>
    <p class="lead">leave a little note for T812</p>
    <p class="sub">A scan, a memory, a moment from the flat &mdash;
       point your camera at the photo below and add yours to the Memory Wall.</p>

    <div class="polaroid">
      <div class="qr">__QR__</div>
      <div class="caption">scan me &#10038; leave a memory</div>
    </div>

    <div class="howto">
      <p class="step">open camera &middot; point &middot; tap the link &middot; write</p>
      <p class="signoff">with love, from everyone who passed through &#9829;</p>
    </div>
  </div>
</body>
</html>
"""

OUT.write_text(HTML.replace("__QR__", qr_img), encoding="utf-8")
print(f"Wrote {OUT.relative_to(ROOT)}")
