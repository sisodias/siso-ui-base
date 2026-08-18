#!/usr/bin/env bash
# Wait for the in-flight harvest, then re-run against the widened urls-union.json.
# harvest.mjs is idempotent — it skips anything already holding a meta.json.
#
# The wait pattern matches "node harvest.mjs" specifically. A looser `pgrep -f
# harvest` would also match this script's own command line and spin forever.
set -uo pipefail
cd "$(dirname "$0")"
while pgrep -f 'node harvest.mjs' >/dev/null 2>&1; do sleep 30; done
echo "=== chained pass starting ===" >> harvest-full.log
CONC=8 node harvest.mjs --all >> harvest-full.log 2>&1
echo "CHAINED-PASS-COMPLETE" >> harvest-full.log
