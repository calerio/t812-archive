# Goal
- Build **T812 Archive**: a living, *unlisted* web archive of flat T812 — scanned
  Polaroids, letters, and trading cards — that flatmates/friends can browse online,
  plus a moderated **memory wall** where visitors leave notes (on a specific photo
  or in general).
- Success = an aesthetic, hosted site people can visit via a shared link; photos
  organised by chapter (content groups + academic year/semester); a working,
  spam-resistant memory wall; original scans preserved and viewable.

# Current State
**Working / done:**
- Site is LIVE on GitHub Pages: https://calerio.github.io/t812-archive/ (all pages 200).
- Repo: https://github.com/calerio/t812-archive (public; `noindex` + `robots.txt` keep it unlisted).
- 224 photos across 10 collections (Bengladino, Family, Roommates, Staff, Trading
  Cards, and Polaroids · 2024/25 & 2025/26 · Sem I/II). 17 master scans in `originals/`.
- Memory wall is fully wired to Supabase and verified end-to-end (post → pending →
  approve → visible; RLS blocks self-approve / queue-read / delete). One approved
  test note ("🔌 T812 wall test — safe to delete") is live on the wall — Valerio may
  want to delete it.
- Working tree is clean, everything committed and pushed.

**Incomplete / pending (NOT blockers):**
- **Aesthetic tweaks** — the agreed next task. Valerio will look at the live site
  and say what to change. Nothing started yet.
- **Supabase MCP not yet active for Claude.** `.mcp.json` is configured but Valerio
  must (a) restart Claude Code, (b) approve the project server, (c) `/mcp` →
  supabase → Authenticate. Until then, moderation = dashboard or `scripts/moderate.py`.

# Active Files
- `index.html` / `app.js` — gallery: chapter shelf → grid → photo lightbox with
  per-photo memories + "view original scan" link.
- `wall.html` / `wall.js` — aggregated memory wall + post form.
- `originals.html` / `originals.js` — browse master scans.
- `style.css` — scrapbook aesthetic (the file most likely to change in tweaks).
- `js/supa.js`, `config.js` — Supabase REST client + public config (publishable key).
- `scripts/split_scan.py`, `scripts/build_manifest.py`, `scripts/moderate.py`.
- `manifest.json`, `provenance.json` — generated; don't hand-edit.

# Changes Made
- Full scrapbook redesign across 3 pages; photo-view memories + Originals view.
- `split_scan.py`: OpenCV split/de-skew; multi-page TIFF; margin-based background
  auto-detect; optional `--orient` (OFF); records provenance to `provenance.json`.
- `build_manifest.py`: recurses nested folders; readable titles (2024-25→2024/25,
  I→Sem I); emoji inheritance; skips container/utility folders; adds `source` per
  item + an `originals` list.
- Supabase backend: `supabase/setup.sql` (table + RLS), `config.js` (publishable
  key), moderation via MCP (`.mcp.json`, gitignored) or `scripts/moderate.py`.
- Org: 224 Polaroids grouped into content + year/semester sub-collections.
- Global install of Supabase agent skills (see Notes). Docs: `docs/memory-wall-setup.md`.

# Failed Attempts
- **Auto-orientation of Polaroids** — built a "thick border = bottom" heuristic; it
  FAILED for landscape-*shot* Polaroids (border at bottom but scene sideways). Demoted
  to opt-in `--orient` (default off). **DO NOT pursue auto-rotation.**
- **Whole-image median for bg detection** — wrong for sheets densely packed with
  white-bordered photos (high median despite black backing). Fixed by sampling the
  scan margins instead.
- **Otsu threshold on white/light backgrounds** — cropped into white-bordered cards
  (found 8/16). Fixed by thresholding relative to measured page-white + saturation.
- **GitHub Pages deploy first run failed** — Pages wasn't enabled yet; expected.
  Enabling Pages (build_type=workflow) + re-running the workflow fixed it.
- `curl` was intermittently "not found" in some Bash subshells — used Python
  `urllib`/dedicated tools instead.

# Next Steps
1. **Aesthetic tweaks** (the task Valerio is returning for): wait for his specific
   notes / screenshots from the live site, then edit `style.css` (and markup as
   needed). Re-check locally before pushing.
2. If MCP is authenticated, use Supabase tools to delete the test note and moderate.
3. After any photo/collection change: `build_manifest.py` → commit → push (Action redeploys).

# Environment / Commands
- Splitter (needs cv2): `./.venv/bin/python scripts/split_scan.py <scan> --into archive/<coll> [--bg light] [--debug]`
- Manifest (stdlib only): `python3 scripts/build_manifest.py`
- Preview locally: `python3 -m http.server` → http://localhost:8000 (serve over http so manifest.json loads)
- Moderate (CLI): `python3 scripts/moderate.py list | approve <id> | delete <id>` (needs `SUPABASE_SERVICE_KEY`)
- Deploy: just `git push` to `main`; `.github/workflows/pages.yml` rebuilds + deploys.
- Quirks: `rm -rf`/`rm -f` flags sometimes rejected in this Bash sandbox — use
  `find … -delete`. macOS `du --exclude` unsupported. Originals filenames contain
  colons (e.g. `24:25 I (3).jpg`) — Finder shows the "/" the user typed.

# Notes
- **HARD RULE: never change any Polaroid's orientation.** Valerio deliberately set
  at least one sideways. Keep `--orient` off; do not rotate crops.
- **Never commit secrets.** `config.js` publishable key is public-safe & intentional;
  the service_role/secret key goes in env `SUPABASE_SERVICE_KEY` or gitignored
  `.supabase-service-key` — never the repo.
- Supabase project ref: `zrvebgtkhzosfybejnpv`, table `memories`.
- Supabase agent skills installed globally: `~/.claude/skills/supabase` and
  `~/.claude/skills/supabase-postgres-best-practices` (auto-trigger for Supabase work).
- `.mcp.json` and `.venv/` are gitignored (present locally, not in repo).
- Repo is ~230 MB (the `originals/` masters). Fine for now; Git LFS if it grows.
