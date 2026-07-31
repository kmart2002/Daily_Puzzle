-- Phase 2: subscription flow (double opt-in, unsubscribe, idempotent daily send).

-- Tokens are looked up on every confirm/unsubscribe click, and each must
-- identify exactly one subscriber.
create unique index if not exists users_confirm_token_idx     on users (confirm_token);
create unique index if not exists users_unsubscribe_token_idx on users (unsubscribe_token);

-- Only confirmed, still-subscribed users are mailed; this is the mailer's
-- hot path, so index it directly.
create index if not exists users_mailable_idx
  on users (email)
  where subscribed and confirmed_at is not null;

-- Claim table making the daily send idempotent. The mailer INSERTs a claim
-- first and mails only the rows it actually inserted, so a retried or
-- double-fired cron can never send the same person two copies.
create table if not exists daily_sends (
  puzzle_date date        not null,
  email       text        not null references users(email) on delete cascade,
  sent_at     timestamptz not null default now(),
  primary key (puzzle_date, email)
);

alter table daily_sends enable row level security;

-- Signup abuse guard: one row per address per day of signup attempts.
create table if not exists subscribe_attempts (
  email        text        not null,
  attempted_on date        not null default (now() at time zone 'utc')::date,
  attempts     integer     not null default 1,
  primary key (email, attempted_on)
);

alter table subscribe_attempts enable row level security;

-- Atomic increment for the signup guard. Doing this in one statement avoids the
-- read-then-write race two concurrent signups would otherwise hit.
create or replace function bump_subscribe_attempt(p_email text)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into subscribe_attempts (email, attempted_on, attempts)
  values (p_email, (now() at time zone 'utc')::date, 1)
  on conflict (email, attempted_on)
    do update set attempts = subscribe_attempts.attempts + 1
  returning attempts;
$$;
