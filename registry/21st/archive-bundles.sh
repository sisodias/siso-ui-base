#!/usr/bin/env bash
# Pack harvested bundles into one zstd archive and drop the loose copies.
#
# Bundles are ~280KB each but all embed the same React runtime, so they are
# ~90% redundant across the corpus. Long-range zstd exploits that:
# measured 6.9MB -> 538KB on a 22-component sample (12.9x).
#
# Full catalogue: ~1.58 GB loose -> ~0.14 GB archived.
#
#   ./archive-bundles.sh          # pack, keep originals
#   ./archive-bundles.sh --prune  # pack, then delete loose bundle.html
#
# Extract one component later:
#   zstd -dc bundles.tar.zst | tar -xf - harvest/<author>__<slug>/bundle.html
set -euo pipefail
cd "$(dirname "$0")"

command -v zstd >/dev/null || { echo "zstd not installed: brew install zstd" >&2; exit 1; }
[ -d harvest ] || { echo "no harvest/ — run: node harvest.mjs --all" >&2; exit 1; }

n=$(ls harvest/*/bundle.html 2>/dev/null | wc -l | tr -d ' ')
[ "$n" -gt 0 ] || { echo "no bundles to archive" >&2; exit 1; }
before=$(du -sk harvest | cut -f1)

echo "packing $n bundles..."
tar -cf - harvest/*/bundle.html | zstd -19 --long=27 -T0 -q -o bundles.tar.zst -f

after=$(( $(wc -c < bundles.tar.zst) / 1024 ))
echo "bundles: ${before} KB loose -> ${after} KB archived"

if [ "${1:-}" = "--prune" ]; then
  rm -f harvest/*/bundle.html
  echo "pruned loose bundles; harvest/ now holds previews + metadata only"
fi
