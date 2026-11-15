#!/usr/bin/env bash
# Builds the desktop edition (static export) and checks it: the pages the Go
# service serves exist, and no Supabase/auth code shipped.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf out
NEXT_PUBLIC_EDITION=desktop npx next build
fail=0
for f in out/index.html out/plan/day.html out/plan/week.html out/plan/month.html out/inbox.html out/goals.html out/goals/_.html out/goals/_.txt out/settings.html; do
  [ -f "$f" ] || { echo "missing: $f"; fail=1; }
done
for f in out/login.html out/signup.html out/invite.html; do
  [ ! -f "$f" ] || { echo "hosted-only page in the desktop export: $f"; fail=1; }
done
if hits=$(grep -rlE "supabase\.co|@supabase|/auth/v1|createBrowserClient" out); then
  echo "Supabase/auth code in the desktop export:"; echo "$hits"; fail=1
fi
[ "$fail" = 0 ] && echo "desktop export OK"
exit "$fail"
