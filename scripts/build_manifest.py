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
import re
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


def pretty_part(part: str) -> str:
    """Make one path segment readable for a collection title.

    Recognises academic-year folders (2024-25 -> 2024/25) and semester folders
    (I/II -> Sem I/Sem II); otherwise falls back to title-casing.
    """
    if re.fullmatch(r"\d{4}-\d{2}", part):
        return part.replace("-", "/")
    if re.fullmatch(r"I{1,3}|IV", part, re.IGNORECASE):
        return "Sem " + part.upper()
    return title_from_filename(part)


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


def build_collection(folder: Path) -> dict:
    rel = folder.relative_to(ARCHIVE)
    items = [
        build_item(p)
        for p in sorted(folder.iterdir())
        if p.is_file() and p.suffix.lower() in MEDIA_EXTS
    ]
    meta = parse_sidecar(folder / "_collection.txt")
    emoji = meta.get("emoji", "")
    if not emoji and len(rel.parts) > 1:   # sub-folders inherit the parent's emoji
        emoji = parse_sidecar(ARCHIVE / rel.parts[0] / "_collection.txt").get("emoji", "")
    return {
        "id": rel.as_posix(),
        "title": meta.get("title") or " · ".join(pretty_part(p) for p in rel.parts),
        "description": meta.get("description", ""),
        "emoji": emoji,
        # newest first; undated items sink to the bottom
        "items": sorted(items, key=lambda i: (i["date"] or "0000"), reverse=True),
    }


def main() -> None:
    collections = []
    if ARCHIVE.exists():
        # Recurse: any folder that holds media (or declares itself with a
        # _collection.txt) becomes a collection. Folders that only contain
        # subfolders (e.g. a year that groups semesters) are skipped.
        for folder in sorted(p for p in ARCHIVE.rglob("*") if p.is_dir()):
            rel = folder.relative_to(ARCHIVE)
            if any(part.startswith((".", "_")) for part in rel.parts):
                continue
            coll = build_collection(folder)
            if coll["items"] or (folder / "_collection.txt").exists():
                collections.append(coll)

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
