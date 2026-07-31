-- Tabletop Trainer — multi-user schema (Phase 1)
-- Email is the primary key, per product decision. See docs/MULTIPLAYER.md for
-- the tradeoff vs. a surrogate uuid key if users ever need to change email.

create extension if not exists pgcrypto;

-- Subscribers. A user only receives mail once confirmed (double opt-in).
create table if not exists users (
  email             text primary key check (position('@' in email) > 1),
  display_name      text not null check (char_length(display_name) between 1 and 40),
  subscribed        boolean not null default true,
  confirmed_at      timestamptz,
  confirm_token     uuid not null default gen_random_uuid(),
  unsubscribe_token uuid not null default gen_random_uuid(),
  created_at        timestamptz not null default now()
);

-- The day's five seeds. Derived from the date, stored for history/integrity.
create table if not exists daily_sets (
  puzzle_date date primary key,
  seeds       text[] not null check (array_length(seeds, 1) = 5)
);

-- One row per user per puzzle. First submission wins (no retry farming).
-- `points`/`grade`/`breakdown` are written ONLY by the server after replaying
-- `moves` through the engine — never accepted from the client.
create table if not exists scores (
  email        text     not null references users(email) on delete cascade,
  puzzle_date  date     not null,
  puzzle_index smallint not null check (puzzle_index between 1 and 5),
  seed         text     not null,
  moves        jsonb    not null,
  points       integer  not null check (points >= 0),
  grade        text     not null check (grade in ('S','A','B','C','D')),
  breakdown    jsonb    not null,
  submitted_at timestamptz not null default now(),
  primary key (email, puzzle_date, puzzle_index)
);

create index if not exists scores_leaderboard_idx on scores (puzzle_date, points desc);

-- Public leaderboard: display names only — emails are never exposed.
create or replace view daily_leaderboard as
select
  s.puzzle_date,
  u.display_name,
  sum(s.points)::int  as total_points,
  count(*)::int       as puzzles_played,
  max(s.submitted_at) as last_submission
from scores s
join users u on u.email = s.email
group by s.puzzle_date, u.email, u.display_name
order by s.puzzle_date desc, total_points desc;

-- Row-level security: clients get no direct write path. All writes happen in
-- Edge Functions using the service role, which bypasses RLS by design.
alter table users  enable row level security;
alter table scores enable row level security;

-- Anonymous/browser clients may read the leaderboard view only.
grant select on daily_leaderboard to anon, authenticated;
