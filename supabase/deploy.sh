#!/usr/bin/env bash
#
# One-command backend deploy.
#
#   ./supabase/deploy.sh <project-ref>
#
# Idempotent: safe to re-run after any code change. It syncs the shared pure
# modules into the functions, applies migrations, and deploys every function.
#
# Prerequisites (one-time, done by a human — see README):
#   • supabase CLI installed and `supabase login` completed
#   • the project's secrets set via `supabase secrets set ...`
set -euo pipefail

PROJECT_REF="${1:-}"
if [[ -z "$PROJECT_REF" ]]; then
  echo "usage: $0 <project-ref>   (find it in your Supabase project URL)" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

command -v supabase >/dev/null || {
  echo "supabase CLI not found. Install: https://supabase.com/docs/guides/cli" >&2
  exit 1
}

echo "==> Verifying the pure modules still pass their tests"
(cd tabletop-trainer && npm test --silent)

# The engine and server helpers are the single source of truth. Copy rather than
# duplicate, so grading and token logic can never drift between web and server.
echo "==> Syncing shared modules into functions/_shared"
rm -rf supabase/functions/_shared/engine supabase/functions/_shared/server
cp -r tabletop-trainer/src/engine supabase/functions/_shared/engine
cp -r tabletop-trainer/src/server supabase/functions/_shared/server
# Test files aren't needed at the edge and would only slow cold starts.
find supabase/functions/_shared -type d -name __tests__ -exec rm -rf {} + 2>/dev/null || true

echo "==> Linking project $PROJECT_REF"
supabase link --project-ref "$PROJECT_REF"

echo "==> Applying migrations"
supabase db push

echo "==> Deploying functions"
# subscribe/confirm/unsubscribe/login/leaderboard are called by browsers and
# mail clients with no Supabase JWT, so they must skip JWT verification —
# each one does its own auth (signed token, opaque UUID, or none by design).
for fn in subscribe confirm unsubscribe login leaderboard; do
  supabase functions deploy "$fn" --no-verify-jwt
done
# submit-score authenticates with our own signed token, not a Supabase JWT.
supabase functions deploy submit-score --no-verify-jwt
supabase functions deploy send-daily --no-verify-jwt

cat <<EOF

Deployed. Functions base URL:
  https://$PROJECT_REF.supabase.co/functions/v1

Next:
  1. Build the frontend with VITE_API_URL set to that URL.
  2. Schedule send-daily (SQL in supabase/README.md).
  3. Smoke test:  ./supabase/smoke-test.sh https://$PROJECT_REF.supabase.co/functions/v1
EOF
