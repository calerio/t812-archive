# T812 · The Flat Archive

A living, digital archive of the flat — the Polaroid wall, letters written to
the flat, and whatever else is worth keeping. It's meant to be added to over
time by everyone who lives here.

It's a small static website backed by plain folders of files, so it will keep
working for years with no server, no database and no accounts.

## How it's organised

```
t812-archive/
├── archive/              ← the memories themselves
│   ├── polaroids/        ← one collection (the Polaroid wall)
│   │   ├── *.jpg/.png    ← scans
│   │   └── *.txt         ← optional metadata, one per scan
│   └── letters/          ← another collection
├── index.html            ← the gallery site
├── style.css / app.js
├── manifest.json         ← generated index of everything (don't hand-edit)
├── assets/               ← helpers (e.g. printable black scanning backing sheet)
└── scripts/
    ├── build_manifest.py ← regenerates manifest.json from archive/ (stdlib only)
    └── split_scan.py     ← cuts one scanned A4 of Polaroids into separate photos
```

Each subfolder of `archive/` is a **collection**; each image/PDF in it is an
**item**, optionally described by a same-named `.txt` sidecar. Add a new folder
and it becomes a new collection automatically.

## Adding a memory

See **[CONTRIBUTING.md](CONTRIBUTING.md)** — drop a scan in the right folder,
optionally add a one-line description, commit. That's the whole flow.

## Viewing it

- **Locally:**
  ```
  python3 scripts/build_manifest.py
  python3 -m http.server
  # open http://localhost:8000
  ```
- **On the web:** push to GitHub and enable Pages (Settings → Pages → deploy
  from the `main` branch, root). The included GitHub Action rebuilds the index
  on every push so the site always reflects what's in `archive/`.

## Notes

- `manifest.json` is generated — don't edit it by hand; run the script instead.
- Keep scans reasonably sized (a few MB each) so the repo stays light.
