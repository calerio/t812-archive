# Original scans (masters)

These are the **full, un-split scanner files** — usually a whole A3 sheet holding
several Polaroids each. They are kept here permanently so we never lose the
source: if `scripts/split_scan.py` ever crops or rotates something wrong, we can
always re-run it against the master here instead of re-scanning.

- Don't edit these — treat them as read-only masters.
- They're large (≈20 MB each). If this folder ever gets too heavy for the repo,
  the fix is Git LFS (`git lfs track "originals/*.jpg"`), not deleting them.
- This folder is **not** part of the gallery — `build_manifest.py` ignores any
  folder outside `archive/` (and any `archive/` subfolder whose name starts with
  `_` or `.`).
