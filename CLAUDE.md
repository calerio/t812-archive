# T812 Archive — project guide for Claude

A living, **unlisted** web archive of flat **T812**: scanned Polaroids, letters, and
trading cards, plus a moderated **memory wall** where visitors leave notes.

- **Live site:** https://calerio.github.io/t812-archive/ (GitHub Pages)
- **Repo:** https://github.com/calerio/t812-archive (public, but `noindex` + `robots.txt` — keep it unlisted, don't advertise)

## ⚠️ Hard rules
- **NEVER change the orientation of any Polaroid.** Some were deliberately set
  sideways by Valerio. The `--orient` flag on `split_scan.py` exists but stays
  **off**; do not rotate crops.
- **Never commit secrets.** The Supabase *publishable* key in `config.js` is
  public-safe and intentional. The *service_role/secret* key must never be
  committed (it goes in env `SUPABASE_SERVICE_KEY` or the gitignored
  `.supabase-service-key`).

## How the archive is built (the pipeline)
1. Scan sheets (A3, ~600 dpi, JPEG; Polaroids on the black backing sheet in
   `assets/`, cards on light bg). Masters are kept forever in `originals/`.
2. `python3 scripts/split_scan.py <scan> --into archive/<collection> [--bg light]`
   auto-detects each photo, de-skews, crops, and records provenance in
   `provenance.json`. Use `--debug` to preview detection first.
3. `python3 scripts/build_manifest.py` regenerates `manifest.json` (recurses
   nested `year/semester` folders; adds each item's `source` original + the
   `originals` list). **It needs no third-party packages.**
4. Commit + push → the GitHub Action (`.github/workflows/pages.yml`) rebuilds
   the manifest and redeploys Pages.

Use the project venv for the cv2-based splitter: `./.venv/bin/python …`.
`build_manifest.py` works with plain `python3`.

## Structure
- `archive/<collection>/…` — published photos; nested folders become
  sub-collections (e.g. `polaroids/2024-25/I`). `_collection.txt` sets title/emoji.
- `originals/` — full master scans (read-only; excluded from the gallery).
- Site: `index.html`+`app.js` (gallery + photo view), `wall.html`+`wall.js`
  (memory wall), `originals.html`+`originals.js`, shared `style.css`, `js/supa.js`.

## Memory wall (Supabase)
- Project ref: `zrvebgtkhzosfybejnpv` (table `memories`, RLS in `supabase/setup.sql`).
- Submissions arrive `approved = false` (hidden) and must be approved to show.
- **Moderation, two ways:**
  - **MCP (preferred):** the Supabase MCP server is configured in `.mcp.json`
    (gitignored). Once authenticated (`/mcp` → supabase → Authenticate), use the
    Supabase tools to list/approve/delete rows directly.
  - **CLI fallback:** `python3 scripts/moderate.py list | approve <id> | delete <id>`
    (reads the secret key from env/`.supabase-service-key`).
- Full guide: `docs/memory-wall-setup.md`.

## Supabase agent skills (installed globally)
Two Supabase Skills are installed user-level and auto-trigger for any Supabase work:
- `~/.claude/skills/supabase` — Supabase products, client libs, auth, RLS, CLI/MCP.
- `~/.claude/skills/supabase-postgres-best-practices` — Postgres query/schema tuning.
Lean on these when touching the wall's schema, RLS policies, or queries.
