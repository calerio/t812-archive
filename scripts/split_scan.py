#!/usr/bin/env python3
"""Split one scanned A4 sheet of several Polaroids into individual, de-skewed images.

Workflow it expects (see CONTRIBUTING.md):
  - Lay several Polaroids on the scanner glass with gaps between them.
  - Use a DARK background (drape assets/black-a4-scan-backing.pdf over them), so
    each photo stands out brightly against black.
  - Scan to JPEG at ~600 dpi.

Then:
  python3 scripts/split_scan.py ~/Downloads/scan.jpg
  python3 scripts/split_scan.py scan1.jpg scan2.jpg --into archive/polaroids
  python3 scripts/split_scan.py scan.jpg --debug      # writes a detection preview

For each detected photo it finds the rotated rectangle, straightens it, crops it,
and saves <prefix>-NN.jpg into the output folder (default archive/polaroids).
Numbering continues past any files already there, so re-running never overwrites.

Requires: opencv-python (or opencv-python-headless) and numpy — see requirements.txt.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    import cv2
    import numpy as np
except ImportError:
    sys.exit("Missing dependencies. Run:  python3 -m pip install -r requirements.txt")

ROOT = Path(__file__).resolve().parent.parent


def order_corners(pts: "np.ndarray") -> "np.ndarray":
    """Return the 4 corners as [top-left, top-right, bottom-right, bottom-left]."""
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1).ravel()
    return np.array([
        pts[np.argmin(s)],   # top-left   (smallest x+y)
        pts[np.argmin(d)],   # top-right  (smallest y-x)
        pts[np.argmax(s)],   # bottom-right
        pts[np.argmax(d)],   # bottom-left
    ], dtype="float32")


def auto_orient(crop: "np.ndarray") -> "np.ndarray":
    """Rotate a Polaroid crop so its thick white border sits at the bottom.

    A Polaroid always has one wide white margin (the bottom). We measure how many
    full-width / full-height bands of (near-)white pixels sit against each of the
    four edges; the thickest band is the bottom, and we rotate to put it there.
    Only does 90-degree turns, so it can't make things worse than a clean rotation.
    """
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    white = gray > 200
    h, w = white.shape

    def band(axis_white, n):
        # count leading lines (rows or cols) that are mostly white across the middle
        run = 0
        for i in range(n):
            line = axis_white[i]
            mid = line[int(len(line) * 0.2):int(len(line) * 0.8)]
            if mid.mean() > 0.9:
                run += 1
            else:
                break
        return run

    top = band(white, h)
    bottom = band(white[::-1], h)
    left = band(white.T, w)
    right = band(white.T[::-1], w)

    thickest = max(("bottom", bottom), ("top", top), ("left", left),
                   ("right", right), key=lambda kv: kv[1])[0]
    if thickest == "top":
        return cv2.rotate(crop, cv2.ROTATE_180)
    if thickest == "left":
        return cv2.rotate(crop, cv2.ROTATE_90_COUNTERCLOCKWISE)
    if thickest == "right":
        return cv2.rotate(crop, cv2.ROTATE_90_CLOCKWISE)
    return crop  # already bottom


def deskew_crop(img: "np.ndarray", box: "np.ndarray") -> "np.ndarray":
    """Perspective-warp the rotated box to an upright rectangle."""
    src = order_corners(box.astype("float32"))
    (tl, tr, br, bl) = src
    w = int(round(max(np.linalg.norm(tr - tl), np.linalg.norm(br - bl))))
    h = int(round(max(np.linalg.norm(bl - tl), np.linalg.norm(br - tr))))
    if w < 2 or h < 2:
        return None
    dst = np.array([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]], dtype="float32")
    m = cv2.getPerspectiveTransform(src, dst)
    return cv2.warpPerspective(img, m, (w, h))


def detect_photos(img, bg, min_area_frac, debug_path=None):
    """Return a list of rotated-rect corner arrays, one per detected photo."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)

    # Auto-pick background polarity from the *margins*, not the whole image:
    # a sheet packed with white-bordered photos has a bright overall median even
    # on a black backing, but its outer frame is still the background colour.
    if bg == "auto":
        h, w = gray.shape
        b = max(8, int(min(h, w) * 0.04))
        frame = np.concatenate([gray[:b].ravel(), gray[-b:].ravel(),
                                gray[:, :b].ravel(), gray[:, -b:].ravel()])
        bg = "dark" if np.median(frame) < 110 else "light"

    # Foreground (the photos) should end up white in `mask`.
    if bg == "dark":
        # Photos are brighter than a dark/black backing — Otsu separates cleanly.
        _, mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    else:
        # Light/white backing: Otsu tends to crop into the photos and lose any
        # white-bordered ones. Instead, treat as foreground anything darker than
        # the page white (measured, not hard-coded) OR clearly colourful. Morphology
        # then fills white borders back in.
        page_white = np.percentile(gray, 97)
        sat = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)[:, :, 1]
        mask = (((gray < page_white - 15) | (sat > 30)).astype("uint8")) * 255

    # Close small gaps (e.g. a dark photo on dark bg) and detach touching edges.
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k, iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, k, iterations=1)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    page_area = img.shape[0] * img.shape[1]
    boxes = []
    for c in contours:
        area = cv2.contourArea(c)
        if area < min_area_frac * page_area:
            continue
        if area > 0.95 * page_area:   # the whole sheet — skip
            continue
        box = cv2.boxPoints(cv2.minAreaRect(c))
        boxes.append(box)

    # Stable order: top-to-bottom in rough rows, then left-to-right.
    def key(b):
        cx, cy = b[:, 0].mean(), b[:, 1].mean()
        return (round(cy / (img.shape[0] / 6)), cx)
    boxes.sort(key=key)

    if debug_path is not None:
        prev = img.copy()
        for i, b in enumerate(boxes, 1):
            cv2.drawContours(prev, [b.astype(int)], -1, (0, 0, 255), 6)
            c = b.mean(axis=0).astype(int)
            cv2.putText(prev, str(i), tuple(c), cv2.FONT_HERSHEY_SIMPLEX,
                        3, (0, 255, 0), 8)
        cv2.imwrite(str(debug_path), prev)
        print(f"  debug preview → {debug_path}")
    return boxes


def next_index(out_dir: Path, prefix: str) -> int:
    existing = list(out_dir.glob(f"{prefix}-*.jpg"))
    nums = []
    for p in existing:
        tail = p.stem[len(prefix) + 1:]
        if tail.isdigit():
            nums.append(int(tail))
    return (max(nums) + 1) if nums else 1


def read_pages(path: Path):
    """Read all pages of a scan. Handles multi-page TIFF as well as plain JPG/PNG."""
    ok, pages = cv2.imreadmulti(str(path), flags=cv2.IMREAD_COLOR)
    if ok and pages:
        return list(pages)
    img = cv2.imread(str(path))           # fallback for formats imreadmulti skips
    return [img] if img is not None else []


def process_page(img, out_dir: Path, pfx: str, bg: str, min_area_frac: float,
                 pad: int, orient: bool, debug_path, quality: int) -> int:
    boxes = detect_photos(img, bg, min_area_frac, debug_path)
    if not boxes:
        print(f"  no photos detected (try --bg light, or lower --min-area)")
        return 0
    idx = next_index(out_dir, pfx)
    saved = 0
    for box in boxes:
        crop = deskew_crop(img, box)
        if crop is None:
            continue
        if orient:
            crop = auto_orient(crop)
        if pad:
            crop = crop[pad:-pad or None, pad:-pad or None]
            if crop.size == 0:
                continue
        out = out_dir / f"{pfx}-{idx:02d}.jpg"
        cv2.imwrite(str(out), crop, [cv2.IMWRITE_JPEG_QUALITY, quality])
        print(f"  → {out.relative_to(ROOT) if ROOT in out.parents else out}")
        idx += 1
        saved += 1
    return saved


def process(path: Path, out_dir: Path, prefix: str | None, bg: str,
            min_area_frac: float, pad: int, orient: bool, debug: bool,
            quality: int) -> int:
    pages = read_pages(path)
    if not pages:
        print(f"!! could not read {path}", file=sys.stderr)
        return 0
    base = prefix or path.stem
    out_dir.mkdir(parents=True, exist_ok=True)
    multi = len(pages) > 1
    if multi:
        print(f"  {len(pages)} pages in this scan")
    saved = 0
    for n, img in enumerate(pages, 1):
        # keep numbering separate per page so sheets don't collide
        pfx = f"{base}-p{n}" if multi else base
        debug_path = (out_dir / f"{pfx}-debug.jpg") if debug else None
        saved += process_page(img, out_dir, pfx, bg, min_area_frac, pad,
                              orient, debug_path, quality)
    return saved


def main() -> None:
    ap = argparse.ArgumentParser(description="Split a scanned sheet of Polaroids into separate images.")
    ap.add_argument("scans", nargs="+",
                    help="scan file(s): jpg/png/tiff, including multi-page tiff")
    ap.add_argument("--into", default=str(ROOT / "archive" / "polaroids"),
                    help="output folder (default: archive/polaroids)")
    ap.add_argument("--prefix", default=None,
                    help="output filename prefix (default: the scan's filename)")
    ap.add_argument("--bg", choices=["auto", "dark", "light"], default="auto",
                    help="background colour behind the photos (default: auto)")
    ap.add_argument("--min-area", type=float, default=0.02,
                    help="ignore blobs smaller than this fraction of the page (default 0.02)")
    ap.add_argument("--pad", type=int, default=0,
                    help="pixels to trim off each edge after cropping (default 0)")
    ap.add_argument("--orient", action="store_true",
                    help="try to auto-rotate so the thick Polaroid border is at the "
                         "bottom (unreliable for landscape-shot Polaroids; off by default)")
    ap.add_argument("--quality", type=int, default=95, help="JPEG quality (default 95)")
    ap.add_argument("--debug", action="store_true",
                    help="also write a *-debug.jpg showing what was detected")
    args = ap.parse_args()

    out_dir = Path(args.into).expanduser().resolve()
    total = 0
    for s in args.scans:
        p = Path(s).expanduser()
        print(f"{p.name}:")
        total += process(p, out_dir, args.prefix, args.bg, args.min_area,
                         args.pad, args.orient, args.debug, args.quality)

    print(f"\nDone — {total} photo(s) written to {out_dir}.")
    if total:
        print("Next: add a .txt sidecar for any you want to caption, then run "
              "`python3 scripts/build_manifest.py` and commit.")


if __name__ == "__main__":
    main()
