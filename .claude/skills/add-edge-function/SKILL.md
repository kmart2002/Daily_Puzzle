---
name: add-edge-function
description: Add or change a Supabase Edge Function in Tabletop Trainer (subscribe, confirm, unsubscribe, send-daily, submit-score). Use for any server endpoint, email sending, or work involving service-role keys or signed tokens.
---

# Add a Supabase Edge Function

The server exists to do what the browser must not be trusted to do. Keep that
line sharp: **the client sends intent, the server decides outcomes.**

## 1. Decide what's pure and what's IO — before writing the function

Pure logic (tokens, validation, email templates, scoring) goes in
`tabletop-trainer/src/server/` (or `src/engine/`) with Vitest tests. The Edge
Function itself should be thin: parse → authenticate → call pure code → write DB
→ respond. Deno functions aren't covered by the web test suite, so **any logic
worth testing must live outside them**.

Copy shared code in at deploy time (see `supabase/README.md`):

```bash
rm -rf supabase/functions/_shared/engine supabase/functions/_shared/server
cp -r tabletop-trainer/src/engine supabase/functions/_shared/engine
cp -r tabletop-trainer/src/server supabase/functions/_shared/server
```

## 2. Write the function

Start from an existing one — they share a house style:

- `// @ts-nocheck` at the top (Deno globals aren't in the web app's tsconfig).
- Import `json` / `html` / `preflight` / `sendMail` from `../_shared/http.ts`.
- Handle `OPTIONS` first (the static site calls these cross-origin).
- Never read identity from the request body — derive it from the auth token or a
  signed/DB token. A body field saying who you are is a forgery waiting to happen.
- Never accept a score, grade, or entitlement from the client; recompute it.
- `console.error` the real failure, return a short generic message to the caller.

## 3. Apply the security checklist

- [ ] **No enumeration.** Endpoints keyed by email return an identical response
      whether or not the address exists (see `subscribe`). Shape/validation
      errors are fine to report; existence is not.
- [ ] **Tokens.** Rare + revocable (confirm) → opaque UUID in Postgres, rotated
      on use. High-volume + expiring (daily play links) → HMAC via
      `signPlayToken`. Verify with `crypto.subtle.verify`, never a manual
      string compare (timing leak).
- [ ] **Idempotency.** Anything that sends mail or grants something claims a row
      first (`daily_sends` pattern: insert, then act only on rows you inserted)
      so a retry can't double-send.
- [ ] **Secrets** come from `Deno.env.get` only. Never `VITE_`-prefixed, never
      logged, never returned in a response.
- [ ] **Service-role key** stays server-side; the browser only ever holds the
      anon key.

## 4. Migrations

Schema changes get a new numbered file in `supabase/migrations/` — never edit an
applied one. Add indexes for every column you look a row up by (tokens!), and
`enable row level security` on every new table.

## 5. Verify and document

```bash
cd tabletop-trainer && npm test && npm run build   # pure logic + app still green
supabase functions serve <name>                    # exercise it locally
```

Add the new endpoint and any new env var to `supabase/README.md` and
`tabletop-trainer/.env.example` (placeholders only — never a real value).
