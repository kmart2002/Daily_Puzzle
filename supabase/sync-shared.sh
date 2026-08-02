#!/usr/bin/env bash
#
# Sync the pure engine/server modules from tabletop-trainer/src into
# supabase/functions/_shared, then rewrite their relative import/export
# specifiers to include an explicit .ts extension.
#
# Deno (which runs Supabase Edge Functions) requires extensions on relative
# specifiers; Vite's bundler resolution accepts either form, so the source
# in tabletop-trainer/src is left extension-free and this script adds them
# only to the generated copy. Safe to re-run any time the engine/server
# source changes — called by deploy.sh and by local dev before
# `supabase start`.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Syncing shared modules into functions/_shared"
rm -rf supabase/functions/_shared/engine supabase/functions/_shared/server
cp -r tabletop-trainer/src/engine supabase/functions/_shared/engine
cp -r tabletop-trainer/src/server supabase/functions/_shared/server
# Test files aren't needed at the edge and would only slow cold starts.
find supabase/functions/_shared -type d -name __tests__ -exec rm -rf {} + 2>/dev/null || true

echo "==> Adding explicit .ts extensions for Deno module resolution"
python3 - <<'PYEOF'
import re
import pathlib

HAS_EXT = re.compile(r"\.[a-zA-Z0-9]+$")
SPEC = re.compile(r"from '(\.\.?/[^']+)'")


def fix_path(path):
    return path if HAS_EXT.search(path) else f"{path}.ts"


for base in ("supabase/functions/_shared/engine", "supabase/functions/_shared/server"):
    for p in pathlib.Path(base).rglob("*.ts"):
        text = p.read_text()
        new = SPEC.sub(lambda m: f"from '{fix_path(m.group(1))}'", text)
        if new != text:
            p.write_text(new)
PYEOF
