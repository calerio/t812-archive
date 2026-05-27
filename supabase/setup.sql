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


-- =====================================================================
-- Site analytics (powers the public Stats page). Privacy-light: the anon
-- key may ONLY insert a visit; raw rows are never readable by the public.
-- The Stats page reads aggregate-only data via the SECURITY DEFINER
-- functions below. No raw IP is ever stored — only coarse geo.
-- =====================================================================

create table if not exists public.visits (
    id            bigint generated always as identity primary key,
    created_at    timestamptz not null default now(),
    visitor       text,        -- random client id (localStorage) for rough uniques
    path          text,
    referrer      text,
    browser       text,
    os            text,
    device        text,
    screen        text,
    lang          text,
    tz            text,
    country       text,
    country_code  text,
    city          text,
    region        text,
    lat           double precision,
    lon           double precision
);
create index if not exists visits_created_idx on public.visits (created_at);
create index if not exists visits_country_idx on public.visits (country);

alter table public.visits enable row level security;

-- Anyone may log a visit; no select/update/delete policies => raw rows stay private.
drop policy if exists "anyone can log a visit" on public.visits;
create policy "anyone can log a visit"
    on public.visits for insert with check (true);

-- Aggregate-only readers for the Stats page (return grouped counts, never a raw row).
create or replace function public.visit_summary()
returns table(total bigint, visitors bigint, countries bigint, cities bigint, since timestamptz)
language sql security definer set search_path = public stable as $$
  select count(*)::bigint, count(distinct visitor)::bigint,
         count(distinct country) filter (where country is not null)::bigint,
         count(distinct city) filter (where city is not null)::bigint, min(created_at)
  from public.visits; $$;

create or replace function public.visit_geo()
returns table(city text, region text, country text, country_code text,
              lat double precision, lon double precision, visits bigint, visitors bigint)
language sql security definer set search_path = public stable as $$
  select city, region, country, country_code, avg(lat)::double precision,
         avg(lon)::double precision, count(*)::bigint, count(distinct visitor)::bigint
  from public.visits where lat is not null and lon is not null
  group by city, region, country, country_code; $$;

create or replace function public.visit_countries()
returns table(country text, country_code text, visits bigint, visitors bigint)
language sql security definer set search_path = public stable as $$
  select country, country_code, count(*)::bigint, count(distinct visitor)::bigint
  from public.visits where country is not null
  group by country, country_code order by count(*) desc; $$;

create or replace function public.visit_daily()
returns table(day date, visits bigint, visitors bigint)
language sql security definer set search_path = public stable as $$
  select (created_at at time zone 'UTC')::date, count(*)::bigint, count(distinct visitor)::bigint
  from public.visits group by 1 order by 1; $$;

create or replace function public.visit_pages()
returns table(path text, visits bigint)
language sql security definer set search_path = public stable as $$
  select coalesce(path,'(unknown)'), count(*)::bigint
  from public.visits group by path order by count(*) desc; $$;

create or replace function public.visit_referrers()
returns table(referrer text, visits bigint)
language sql security definer set search_path = public stable as $$
  select coalesce(nullif(referrer,''),'(direct)'), count(*)::bigint
  from public.visits group by referrer order by count(*) desc; $$;

create or replace function public.visit_browsers()
returns table(browser text, visits bigint)
language sql security definer set search_path = public stable as $$
  select coalesce(browser,'(unknown)'), count(*)::bigint
  from public.visits group by browser order by count(*) desc; $$;

create or replace function public.visit_devices()
returns table(device text, visits bigint)
language sql security definer set search_path = public stable as $$
  select coalesce(device,'(unknown)'), count(*)::bigint
  from public.visits group by device order by count(*) desc; $$;

revoke all on function public.visit_summary, public.visit_geo, public.visit_countries,
  public.visit_daily, public.visit_pages, public.visit_referrers,
  public.visit_browsers, public.visit_devices from public;
grant execute on function public.visit_summary, public.visit_geo, public.visit_countries,
  public.visit_daily, public.visit_pages, public.visit_referrers,
  public.visit_browsers, public.visit_devices to anon, authenticated;
