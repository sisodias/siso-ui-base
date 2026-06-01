#!/usr/bin/env bash
# SISO UI Base — vendor every prior-art repo for code study.
# Reads registry/repos.json and shallow-clones each GitHub repo into vendor/<id>/.
# Idempotent: skips repos already cloned (git pull --ff-only to refresh).
# Usage:
#   ./clone.sh            # clone all
#   ./clone.sh A-taste-gate   # clone only one family (A-taste-gate|B-visual-judge|C-registry|D-flow-dashboard|E-forge-mcp)
set -euo pipefail
cd "$(dirname "$0")"

FILTER="${1:-}"
VENDOR="vendor"
mkdir -p "$VENDOR"

# Pull id|url|family triples out of repos.json with node (no jq dependency).
node -e '
  const r = require("./registry/repos.json");
  const f = process.argv[1] || "";
  for (const x of r.repos) {
    if (f && x.family !== f) continue;
    if (!x.url || !x.url.includes("github.com")) { console.error("skip (no github url): " + x.id); continue; }
    console.log([x.id, x.url, x.family].join("\t"));
  }
' "$FILTER" | while IFS=$'\t' read -r id url family; do
  dest="$VENDOR/$id"
  if [ -d "$dest/.git" ]; then
    echo "↻ $id  (refresh)"
    git -C "$dest" pull --ff-only --quiet || echo "  (pull skipped)"
  else
    echo "⬇ $id  <- $url  [$family]"
    git clone --depth 1 "$url" "$dest" --quiet || echo "  ✗ clone failed: $url"
  fi
done

echo ""
echo "Done. Vendored repos in $VENDOR/ (gitignored — code study only, not committed)."
echo "Manifest: registry/repos.json · Architecture: docs/ARCHITECTURE.html"
