#!/usr/bin/env python3
"""Build assets/world.svg — a stylised, paper-toned world map for the stats page.

Downloads public-domain Natural Earth country borders (110m) and projects them
with a simple cropped-equirectangular projection into an SVG. The stats page
overlays visitor pins using the SAME projection (keep these constants in sync
with stats.js): viewBox 0 0 1000 500, lon -180..180, lat 85..-57.

    python3 scripts/build_worldmap.py        # needs network, stdlib only
"""
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "world.svg"
SRC = ("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
       "master/geojson/ne_110m_admin_0_countries.geojson")

W, H = 1000.0, 500.0
LAT_TOP, LAT_BOT = 85.0, -57.0          # crop most of Antarctica


def project(lon, lat):
    x = (lon + 180.0) / 360.0 * W
    y = (LAT_TOP - lat) / (LAT_TOP - LAT_BOT) * H
    return round(x, 1), round(min(max(y, 0.0), H), 1)


def ring_to_path(ring):
    pts = [project(lon, lat) for lon, lat in ring]
    if len(pts) < 3:
        return ""
    d = "M" + " ".join(f"{x},{y}" for x, y in pts) + "Z"
    return d


def feature_path(geom):
    t, coords = geom["type"], geom["coordinates"]
    polys = coords if t == "MultiPolygon" else [coords]
    return "".join(ring_to_path(ring) for poly in polys for ring in poly)


def main():
    print("downloading Natural Earth 110m borders…")
    with urllib.request.urlopen(SRC, timeout=60) as r:
        gj = json.loads(r.read().decode("utf-8"))

    paths = []
    for feat in gj["features"]:
        geom = feat.get("geometry")
        if not geom:
            continue
        d = feature_path(geom)
        if d:
            paths.append(d)

    body = "\n".join(f'    <path d="{d}"/>' for d in paths)
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.0f} {H:.0f}"
     class="worldmap" role="img" aria-label="World map">
  <g class="land" fill="#e0d4bb" stroke="#b9a986" stroke-width="0.6"
     stroke-linejoin="round" vector-effect="non-scaling-stroke">
{body}
  </g>
</svg>
"""
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(svg, encoding="utf-8")
    kb = OUT.stat().st_size / 1024
    print(f"Wrote {OUT.relative_to(ROOT)} — {len(paths)} countries, {kb:.0f} KB")


if __name__ == "__main__":
    main()
