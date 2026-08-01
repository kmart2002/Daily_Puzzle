#!/usr/bin/env bash
#
# Post-deploy smoke test. Verifies the deployed endpoints behave — including the
# security properties that are easy to regress.
#
#   ./supabase/smoke-test.sh https://<ref>.supabase.co/functions/v1 [test-email]
#
# Safe to run against production: it only sends mail if you pass an email you
# control, and never writes a score.
set -uo pipefail

BASE="${1:-}"
TEST_EMAIL="${2:-}"
[[ -z "$BASE" ]] && { echo "usage: $0 <functions-base-url> [test-email]" >&2; exit 1; }
BASE="${BASE%/}"

pass=0; fail=0
check() { # check <description> <expected> <actual>
  if [[ "$3" == "$2" ]]; then printf '  ✓ %s\n' "$1"; pass=$((pass+1));
  else printf '  ✗ %s (expected %s, got %s)\n' "$1" "$2" "$3"; fail=$((fail+1)); fi
}
status() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "Smoke testing $BASE"

echo "-- leaderboard is public and readable"
check "GET /leaderboard returns 200" 200 "$(status "$BASE/leaderboard?range=today")"
check "invalid range falls back, still 200" 200 "$(status "$BASE/leaderboard?range=bogus")"
if curl -s "$BASE/leaderboard?range=today" | grep -qi '"email"'; then
  echo "  ✗ leaderboard leaked an email field"; fail=$((fail+1))
else
  echo "  ✓ leaderboard exposes no email field"; pass=$((pass+1))
fi

echo "-- scoring rejects unauthenticated and forged callers"
check "POST /submit-score without a token is 401" 401 \
  "$(status -X POST -H 'Content-Type: application/json' -d '{}' "$BASE/submit-score")"
check "POST /submit-score with a garbage token is 401" 401 \
  "$(status -X POST -H 'Authorization: Bearer not.a.real.token' \
       -H 'Content-Type: application/json' -d '{}' "$BASE/submit-score")"

echo "-- the daily mailer is not publicly triggerable"
check "POST /send-daily without the cron secret is 403" 403 "$(status -X POST "$BASE/send-daily")"

echo "-- unsubscribe cannot be triggered by a link prefetch"
check "GET /unsubscribe renders a page, does not act" 200 \
  "$(status "$BASE/unsubscribe?token=00000000-0000-0000-0000-000000000000")"
if curl -s "$BASE/unsubscribe?token=00000000-0000-0000-0000-000000000000" | grep -q 'method="post"'; then
  echo "  ✓ unsubscribe GET requires a POST to confirm"; pass=$((pass+1))
else
  echo "  ✗ unsubscribe GET did not render a confirmation form"; fail=$((fail+1))
fi

echo "-- input validation"
check "subscribe rejects a malformed email" 400 \
  "$(status -X POST -H 'Content-Type: application/json' \
       -d '{"email":"nope","displayName":"X"}' "$BASE/subscribe")"
check "subscribe rejects an empty display name" 400 \
  "$(status -X POST -H 'Content-Type: application/json' \
       -d '{"email":"someone@example.com","displayName":"  "}' "$BASE/subscribe")"

echo "-- no email enumeration"
a=$(curl -s -X POST -H 'Content-Type: application/json' \
      -d '{"email":"definitely-not-registered-'"$RANDOM"'@example.com","displayName":"Probe"}' "$BASE/subscribe")
b=$(curl -s -X POST -H 'Content-Type: application/json' -d '{"email":"probe2-'"$RANDOM"'@example.com"}' "$BASE/login")
check "unknown address gets the generic subscribe reply" "true" \
  "$(grep -q '"ok":true' <<<"$a" && echo true || echo false)"
check "login never reveals whether an account exists" "true" \
  "$(grep -q '"ok":true' <<<"$b" && echo true || echo false)"

if [[ -n "$TEST_EMAIL" ]]; then
  echo "-- live signup for $TEST_EMAIL (check that inbox for a confirmation)"
  check "subscribe accepts a valid signup" 200 \
    "$(status -X POST -H 'Content-Type: application/json' \
         -d "{\"email\":\"$TEST_EMAIL\",\"displayName\":\"Smoke Test\"}" "$BASE/subscribe")"
fi

echo
echo "$pass passed, $fail failed"
[[ $fail -eq 0 ]]
