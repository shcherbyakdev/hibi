#!/usr/bin/env bash
# Builds the desktop edition (static export) and checks it: the pages the Go
# service serves exist and the hosted site's auth pages don't. (supabase-js
# is in the export on purpose: signing in is optional, src/edition/desktop/account.tsx.)
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
[ "$fail" = 0 ] && echo "desktop export OK"
exit "$fail"
