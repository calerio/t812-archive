#!/usr/bin/env python3
"""Moderate the T812 memory wall from the command line.

Uses your Supabase SECRET (service_role) key, which bypasses Row-Level Security,
so it can see pending memories and approve/delete them. The secret is read from
the environment or an untracked local file — it must NEVER be committed.

Provide the key one of two ways:
  • export SUPABASE_SERVICE_KEY="sb_secret_…"      (preferred, per-session)
  • or put it in a file  .supabase-service-key      (gitignored)

Usage:
  python3 scripts/moderate.py list                 # show pending memories
  python3 scripts/moderate.py list --all           # show everything
  python3 scripts/moderate.py approve 3 7 9         # approve by id
  python3 scripts/moderate.py approve --all         # approve every pending one
  python3 scripts/moderate.py delete 5             # delete by id (spam)
"""
from __future__ import annotations
import json, os, sys, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
URL = os.environ.get("SUPABASE_URL", "https://zrvebgtkhzosfybejnpv.supabase.co").rstrip("/")


def secret() -> str:
    k = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
    if not k:
        f = ROOT / ".supabase-service-key"
        if f.exists():
            k = f.read_text(encoding="utf-8").strip()
    if not k:
        sys.exit("No secret key. Set SUPABASE_SERVICE_KEY or create .supabase-service-key "
                 "(get it from Supabase → Project Settings → API → service_role / secret).")
    return k


def api(method: str, q: str = "", body=None):
    h = {"apikey": secret(), "Authorization": "Bearer " + secret(),
         "Content-Type": "application/json", "Prefer": "return=representation"}
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{URL}/rest/v1/memories{q}", data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            txt = r.read().decode()
            return r.status, (json.loads(txt) if txt else [])
    except urllib.error.HTTPError as e:
        sys.exit(f"API error {e.code}: {e.read().decode()[:300]}")


def show(rows):
    if not rows:
        print("  (none)"); return
    for m in rows:
        flag = "✓" if m["approved"] else "·"
        who = m.get("name") or "anonymous"
        where = f"  [on {m['photo']}]" if m.get("photo") else ""
        print(f"  {flag} #{m['id']:>3}  {who}: {m['message'][:70]}{where}")


def main():
    args = sys.argv[1:]
    cmd = args[0] if args else "list"

    if cmd == "list":
        q = "?select=*&order=created_at.desc"
        if "--all" not in args:
            q += "&approved=eq.false"
        _, rows = api("GET", q)
        print(f"{'All' if '--all' in args else 'Pending'} memories:")
        show(rows)

    elif cmd == "approve":
        if "--all" in args:
            _, rows = api("PATCH", "?approved=eq.false", {"approved": True})
            print(f"Approved {len(rows)} pending memory(ies)."); show(rows)
        else:
            ids = [a for a in args[1:] if a.isdigit()]
            for i in ids:
                _, rows = api("PATCH", f"?id=eq.{i}", {"approved": True})
                print(f"Approved #{i}."); show(rows)

    elif cmd == "delete":
        ids = [a for a in args[1:] if a.isdigit()]
        for i in ids:
            api("DELETE", f"?id=eq.{i}")
            print(f"Deleted #{i}.")

    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
