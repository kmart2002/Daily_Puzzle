# Supabase backend (Phase 1 scaffold)

Server side of the multi-user build. See `tabletop-trainer/docs/MULTIPLAYER.md`
for the full architecture.

```
migrations/0001_init.sql      users · daily_sets · scores · daily_leaderboard view
functions/submit-score/       Edge Function: replay-grades an attempt, records it
functions/_shared/engine/     the shared engine (see "Sharing the engine" below)
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
rm -rf supabase/functions/_shared/engine
cp -r tabletop-trainer/src/engine supabase/functions/_shared/engine
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

## Not built yet (later phases)

Subscribe/confirm endpoints, the Resend mailer with per-user signed links and
unsubscribe, and the leaderboard UI. Phase 1 delivers the schema, the trust
model, and the grading path.
