-- RBA Scoring schema. Paste into the Supabase SQL editor of your existing project and run once.
-- Everything lives in its own "rba" schema so it stays separate from your other projects' tables.
-- Already ran an older version? Run `drop schema rba cascade;` first (only if there is no data to keep).

create schema if not exists rba;

create table if not exists rba.matches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  match_date date,
  logo text, -- event logo as a small image data URL, set from the admin page
  created_at timestamptz not null default now()
);

-- for projects that already ran an older version of this file
alter table rba.matches add column if not exists logo text;

-- The classes shot at a match (Sporter, Light, Heavy). Each class has its own number of cards.
create table if not exists rba.classes (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references rba.matches(id) on delete cascade,
  name text not null,
  num_cards int not null default 2 check (num_cards between 1 and 30),
  sort_order int not null default 0,
  unique (match_id, name)
);

-- Aggregates such as "2 Gun Agg" or "3 Gun Agg": the sum of the listed classes.
-- A competitor appears on an aggregate once they have scores in every class it lists.
create table if not exists rba.aggregates (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references rba.matches(id) on delete cascade,
  name text not null,
  class_ids uuid[] not null,
  created_at timestamptz not null default now()
);

-- One entry per competitor per match (one entry number across all their classes).
create table if not exists rba.entries (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references rba.matches(id) on delete cascade,
  entry_number int not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (match_id, entry_number)
);

-- WASRA membership numbers live in their own table so they stay private:
-- no public read access, only the server (service role key) can read or write them.
create table if not exists rba.entry_members (
  entry_id uuid primary key references rba.entries(id) on delete cascade,
  membership_number text not null
);
alter table rba.entry_members enable row level security;

-- Wrong-PIN attempts, used to lock out guessing. Server only.
create table if not exists rba.pin_attempts (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  created_at timestamptz not null default now()
);
create index if not exists pin_attempts_ip_idx on rba.pin_attempts (ip, created_at);
alter table rba.pin_attempts enable row level security;

create table if not exists rba.card_scores (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references rba.entries(id) on delete cascade,
  class_id uuid not null references rba.classes(id) on delete cascade,
  card_number int not null check (card_number >= 1),
  -- up to 25 shots, each 0 to 10, or 10.01 for an X (so the decimals are the X count)
  shots numeric(4,2)[] not null default '{}' check (cardinality(shots) <= 25),
  -- card total (max 25 x 10.01 = 250.25), computed by the API from the shots
  score numeric(5,2) not null check (score between 0 and 250.25),
  first_miss int check (first_miss between 1 and 25),
  notes text,
  updated_at timestamptz not null default now(),
  unique (entry_id, class_id, card_number)
);

create index if not exists classes_match_idx on rba.classes(match_id);
create index if not exists aggregates_match_idx on rba.aggregates(match_id);
create index if not exists entries_match_idx on rba.entries(match_id);
create index if not exists card_scores_entry_idx on rba.card_scores(entry_id);

-- Row level security: anyone can read (public scoreboard).
-- There are no insert/update/delete policies, so only the server (service role key) can write.
alter table rba.matches enable row level security;
alter table rba.classes enable row level security;
alter table rba.aggregates enable row level security;
alter table rba.entries enable row level security;
alter table rba.card_scores enable row level security;

drop policy if exists "public read matches" on rba.matches;
drop policy if exists "public read classes" on rba.classes;
drop policy if exists "public read aggregates" on rba.aggregates;
drop policy if exists "public read entries" on rba.entries;
drop policy if exists "public read card_scores" on rba.card_scores;

create policy "public read matches" on rba.matches for select using (true);
create policy "public read classes" on rba.classes for select using (true);
create policy "public read aggregates" on rba.aggregates for select using (true);
create policy "public read entries" on rba.entries for select using (true);
create policy "public read card_scores" on rba.card_scores for select using (true);

-- Permissions for the API roles on the custom schema.
grant usage on schema rba to anon, authenticated, service_role;
grant select on all tables in schema rba to anon, authenticated;
grant all on all tables in schema rba to service_role;

alter default privileges in schema rba grant select on tables to anon, authenticated;
alter default privileges in schema rba grant all on tables to service_role;

-- Keep membership numbers private (must stay after the grants above).
revoke all on rba.entry_members from anon, authenticated;
grant all on rba.entry_members to service_role;
revoke all on rba.pin_attempts from anon, authenticated;
grant all on rba.pin_attempts to service_role;

-- AFTER running this: Supabase dashboard -> Project Settings -> API (Data API settings)
-- -> add "rba" to "Exposed schemas" and save. Without that the API returns "schema must be one of ...".
