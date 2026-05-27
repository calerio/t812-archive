-- T812 memory wall — run this once in your Supabase project
-- (Supabase dashboard → SQL Editor → New query → paste → Run).
--
-- It creates the table that holds visitors' memories and locks it down so the
-- public anon key shipped in the website can ONLY:
--   • insert a new message (which starts unapproved / hidden), and
--   • read messages you've approved.
-- It can't read the pending queue, edit, or delete anything.

create table if not exists public.memories (
    id          bigint generated always as identity primary key,
    created_at  timestamptz not null default now(),
    name        text,
    message     text not null,
    photo       text,                       -- optional: relative path of the photo it's about
    chapter     text,                       -- optional: which era/collection it's about
    approved    boolean not null default false,
    constraint message_len check (char_length(message) between 1 and 1000),
    constraint name_len    check (char_length(coalesce(name, '')) <= 80),
    constraint photo_len   check (char_length(coalesce(photo, '')) <= 200),
    constraint chapter_len check (char_length(coalesce(chapter, '')) <= 80)
);

alter table public.memories enable row level security;

-- Anyone (anon key) may read ONLY approved memories.
drop policy if exists "public reads approved" on public.memories;
create policy "public reads approved"
    on public.memories for select
    using (approved = true);

-- Anyone (anon key) may post, but only as unapproved — they can't self-approve.
drop policy if exists "anyone can post pending" on public.memories;
create policy "anyone can post pending"
    on public.memories for insert
    with check (approved = false);

-- No update/delete policies => the public key cannot change or remove rows.
-- You moderate from the dashboard: Table editor → memories → flip `approved`
-- to true to publish a message (the dashboard uses the privileged key, so it
-- bypasses these rules).
