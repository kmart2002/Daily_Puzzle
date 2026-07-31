# Supabase backend (Phases 1-2)

Server side of the multi-user build. See `tabletop-trainer/docs/MULTIPLAYER.md`
for the full architecture.

```
migrations/0001_init.sql      users · daily_sets · scores · daily_leaderboard view
migrations/0002_subscriptions.sql  token indexes · daily_sends · signup guard
functions/subscribe/          POST: start double opt-in, mail a confirm link
functions/confirm/            GET:  complete opt-in (single-use token)
functions/unsubscribe/        GET+POST: stop mail (RFC 8058 one-click)
functions/send-daily/         POST: mail the day's 5 puzzles (cron, idempotent)
functions/submit-score/       POST: replay-grades an attempt, records it
functions/_shared/http.ts     CORS, JSON/HTML responses, Resend sending
functions/_shared/engine/     the shared engine (see "Sharing the engine" below)
functions/_shared/server/     shared pure logic (tokens, email templates)
```

## Trust model (the important part)

The client submits **the moves it made**, never a score. `submit-score` replays
them through the same deterministic engine and writes the points **it** computes.
Tampering with the request cannot inflate a score, because the score is never
read from the request. Three checks back this up:

1. **Identity** comes from the auth token, not the body — you can only score as yourself.
2. **The seed is pinned** to today's set by index, so nobody can submit an easier board.
3. **First attempt wins** — enforced atomically by the `scores` primary key.

## Sharing the engine

The engine is pure TypeScript with no DOM or I/O, so the same source runs in the
browser and in Deno. Populate `functions/_shared/engine/` from
`tabletop-trainer/src/engine/` at deploy time (a copy step, a git submodule, or
publishing it as a package — a copy step is simplest to start):

```bash
rm -rf supabase/functions/_shared/engine supabase/functions/_shared/server
cp -r tabletop-trainer/src/engine supabase/functions/_shared/engine
cp -r tabletop-trainer/src/server supabase/functions/_shared/server
```

Grading logic must exist in exactly one place — never re-implement it server-side.

## Local setup

```bash
supabase init && supabase start
supabase db push                      # apply migrations/0001_init.sql
supabase functions serve submit-score  # local function
```

## Deploy

```bash
supabase link --project-ref <ref>
supabase db push
supabase functions deploy submit-score
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform.
**Never** put the service-role key in the frontend — it bypasses row-level
security. The browser only ever uses the anon key, which can read the
leaderboard view and nothing else.

## Subscription flow (Phase 2)

```
POST /subscribe  {email, displayName}   → always the same response body
   └─ mails a confirm link (nothing is sent to an already-confirmed address)
GET  /confirm?token=<uuid>              → confirms, rotates the token (single use)
GET  /unsubscribe?token=<uuid>          → stops mail, idempotent
POST /unsubscribe?token=<uuid>          → same, for Gmail/Yahoo one-click
POST /send-daily  (x-cron-secret)       → mails all confirmed subscribers
```

Three properties worth preserving:

1. **No email enumeration.** `/subscribe` answers identically whether or not the
   address exists — otherwise it becomes an oracle for testing addresses.
2. **Idempotent sends.** `/send-daily` inserts a `daily_sends` claim per
   recipient and mails only rows it actually inserted, so a retried or
   double-fired cron cannot send anyone two copies. A failed send deletes its
   claim so the next run retries it.
3. **Consent is current.** Re-subscribing after an unsubscribe requires a fresh
   confirmation rather than silently reactivating.

### Secrets to set

```bash
supabase secrets set RESEND_API_KEY=... MAIL_FROM='Tabletop Trainer <puzzles@yourdomain.com>' \
  MAIL_SENDER_ADDRESS='Tabletop Trainer, 1 Example St' \
  PLAY_TOKEN_SECRET="$(openssl rand -base64 32)" \
  CRON_SECRET="$(openssl rand -base64 32)" \
  PUBLIC_APP_URL=https://kmart2002.github.io/Daily_Puzzle/tabletop-trainer/ \
  ALLOWED_ORIGIN=https://kmart2002.github.io
```

Frontend needs only `VITE_API_URL` (the public functions base URL). See
`tabletop-trainer/.env.example`.

### Scheduling the daily send

```sql
select cron.schedule('daily-puzzle-email', '0 13 * * *', $$
  select net.http_post(
    url     := 'https://<project-ref>.supabase.co/functions/v1/send-daily',
    headers := '{"x-cron-secret":"<CRON_SECRET>"}'::jsonb
  );
$$);
```

Retire the GitHub Action mailer once this is live — two schedulers sending the
same mail is exactly the double-send the claim table is designed to prevent, but
there's no reason to rely on it.

## Not built yet (later phases)

Magic-link login for visiting the site directly, the leaderboard UI, and wiring
the play-token into score submission. Phases 1-2 deliver the schema, the trust
model, the grading path, and the full subscription lifecycle.
