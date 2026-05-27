# Memory wall — setup & moderation

The wall is powered by a free [Supabase](https://supabase.com) project (a Postgres
table + auto API). The website talks to it with the **publishable/anon key** in
`config.js`, which is safe to ship: the database's Row-Level Security rules mean
that key can only *post a pending memory* and *read approved ones* — it can't read
the moderation queue, edit, or delete.

## One-time setup
1. Create a free project at supabase.com (already done: `zrvebgtkhzosfybejnpv`).
2. **SQL Editor → New query →** paste the contents of [`supabase/setup.sql`](../supabase/setup.sql) → **Run.**
   This creates the `memories` table and the security rules.
3. **Project Settings → API →** copy the **anon / publishable** key into
   `config.js` (`SUPABASE_ANON_KEY`). *(Never the `service_role`/secret key.)*

That's it — the gallery's per-photo notes and the Memory Wall page go live.

## How a memory flows
1. A visitor types a name + message (on a photo, or on the Wall) and submits.
2. It lands in the `memories` table as **`approved = false`** → hidden from everyone.
3. You **approve** it → it appears on the site.

## Moderating (approving / deleting)
Supabase dashboard → **Table Editor → `memories`**:
- **Approve:** flip the `approved` checkbox to `true` (the dashboard uses the
  privileged key, so it bypasses the public rules).
- **Delete spam:** select the row → delete.
- Tip: sort by `created_at` to see new submissions first. You can also make a
  filtered view (`approved = false`) to see just the pending queue.

## Notes
- Each submission may optionally carry a `photo` (the relative path of the photo
  it's about) and a `chapter` (the collection title). Photo-attached notes show up
  both under that photo and on the Wall.
- There's a hidden "honeypot" field in the forms to deter spam bots; real
  submissions leave it empty.
- Message length is capped (1000 chars) at the database level.
