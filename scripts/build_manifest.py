#!/usr/bin/env python3
"""Scan the archive/ folder and (re)generate manifest.json for the gallery site.

This is the engine of the living archive. It needs no third-party packages.

How it works
------------
- Every subfolder of archive/ becomes a *collection* (e.g. archive/polaroids).
- Every image/PDF in a collection becomes an *item*.
- An item can have an optional sidecar text file with the SAME name but a .txt
  extension, holding `key: value` lines (title, date, by, caption, tags).
      archive/polaroids/rooftop.jpg
      archive/polaroids/rooftop.txt   <- optional metadata
- A collection can describe itself with an optional `_collection.txt`
  (keys: title, description, emoji).

Run it from anywhere:
    python3 scripts/build_manifest.py
"""

from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / "archive"
MANIFEST = ROOT / "manifest.json"

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif"}
DOC_EXTS = {".pdf"}
MEDIA_EXTS = IMAGE_EXTS | DOC_EXTS


def parse_sidecar(path: Path) -> dict:
    """Parse a simple `key: value` text file. Unknown keys are kept too."""
    data: dict[str, str] = {}
    if not path.exists():
        return data
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        key, _, value = line.partition(":")
        data[key.strip().lower()] = value.strip()
    return data


def title_from_filename(stem: str) -> str:
    return stem.replace("-", " ").replace("_", " ").strip().title()


def build_item(media: Path) -> dict:
    meta = parse_sidecar(media.with_suffix(".txt"))
    tags = [t.strip() for t in meta.get("tags", "").split(",") if t.strip()]
    return {
        "file": media.relative_to(ROOT).as_posix(),
        "kind": "doc" if media.suffix.lower() in DOC_EXTS else "image",
        "title": meta.get("title") or title_from_filename(media.stem),
        "date": meta.get("date", ""),
        "by": meta.get("by", ""),
        "caption": meta.get("caption", ""),
        "tags": tags,
    }


def build_collection(folder: Path) -> dict | None:
    items = [
        build_item(p)
        for p in sorted(folder.iterdir())
        if p.is_file() and p.suffix.lower() in MEDIA_EXTS
    ]
    meta = parse_sidecar(folder / "_collection.txt")
    return {
        "id": folder.name,
        "title": meta.get("title") or title_from_filename(folder.name),
        "description": meta.get("description", ""),
        "emoji": meta.get("emoji", ""),
        # newest first; undated items sink to the bottom
        "items": sorted(items, key=lambda i: (i["date"] or "0000"), reverse=True),
    }


def main() -> None:
    collections = []
    if ARCHIVE.exists():
        for folder in sorted(p for p in ARCHIVE.iterdir() if p.is_dir()):
            collections.append(build_collection(folder))

    manifest = {
        "generated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "collections": collections,
        "total_items": sum(len(c["items"]) for c in collections),
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
                        encoding="utf-8")
    print(f"Wrote {MANIFEST.relative_to(ROOT)} — "
          f"{len(collections)} collection(s), {manifest['total_items']} item(s).")


if __name__ == "__main__":
    main()
