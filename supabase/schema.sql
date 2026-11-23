-- RBA Scoring schema. Paste into the Supabase SQL editor of your existing project and run once.
-- Everything lives in its own "rba" schema so it stays separate from your other projects' tables.

create schema if not exists rba;

create table if not exists rba.matches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  match_date date,
  num_cards int not null default 5 check (num_cards between 1 and 30),
  created_at timestamptz not null default now()
);

create table if not exists rba.entries (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references rba.matches(id) on delete cascade,
  entry_number int not null,
  name text not null,
  class text,
  created_at timestamptz not null default now(),
  unique (match_id, entry_number)
);

create table if not exists rba.card_scores (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references rba.entries(id) on delete cascade,
  card_number int not null check (card_number >= 1),
  score int not null check (score between 0 and 25),
  first_miss int check (first_miss between 1 and 25),
  notes text,
  updated_at timestamptz not null default now(),
  unique (entry_id, card_number)
);

create index if not exists entries_match_idx on rba.entries(match_id);
create index if not exists card_scores_entry_idx on rba.card_scores(entry_id);

-- Row level security: anyone can read (public scoreboard).
-- There are no insert/update/delete policies, so only the server (service role key) can write.
alter table rba.matches enable row level security;
alter table rba.entries enable row level security;
alter table rba.card_scores enable row level security;

drop policy if exists "public read matches" on rba.matches;
drop policy if exists "public read entries" on rba.entries;
drop policy if exists "public read card_scores" on rba.card_scores;

create policy "public read matches" on rba.matches for select using (true);
create policy "public read entries" on rba.entries for select using (true);
create policy "public read card_scores" on rba.card_scores for select using (true);

-- Permissions for the API roles on the custom schema.
grant usage on schema rba to anon, authenticated, service_role;
grant select on all tables in schema rba to anon, authenticated;
grant all on all tables in schema rba to service_role;

alter default privileges in schema rba grant select on tables to anon, authenticated;
alter default privileges in schema rba grant all on tables to service_role;

-- AFTER running this: Supabase dashboard -> Project Settings -> API (Data API settings)
-- -> add "rba" to "Exposed schemas" and save. Without that the API returns "schema must be one of ...".
