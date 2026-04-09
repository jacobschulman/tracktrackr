#!/bin/bash
# ============================================================
# rebuild-all.sh — Regenerates all data indexes for TrackTrackr
# ============================================================
#
# Run this whenever you:
#   - Add a new festival (new directory under data/)
#   - Add new set files to an existing festival
#   - Update the blocklist
#
# What it does:
#   1. Generates index.json for each festival (from individual set JSON files)
#   2. Builds per-DJ index files (pre-computed stats, signature tracks, etc.)
#      - Stored in data/djs/{slug}.json (~1-20KB each)
#   3. Builds file-index.json (tlId -> file path mapping, ~600KB)
#   4. Builds recordings.json (tlId -> YouTube/SoundCloud URLs, ~300KB)
#
# Usage:
#   ./scripts/rebuild-all.sh
#
# To add a new festival:
#   1. Create data/{festival-slug}/ with year subdirectories containing set JSONs
#   2. Add festival config to lib/festivals.ts (name, accent color)
#   3. Add festival name to scripts/generate-index.js FESTIVAL_NAMES
#   4. Run this script
#
# ============================================================

set -e
cd "$(dirname "$0")/.."

echo "=== Rebuilding festival indexes ==="
for dir in data/*/; do
  slug=$(basename "$dir")
  [ "$slug" = "djs" ] && continue
  if [ -d "$dir" ]; then
    # Check if this dir has year subdirectories with JSON files
    if ls "$dir"*//*.json 1> /dev/null 2>&1; then
      node scripts/generate-index.js "$slug"
    fi
  fi
done

echo ""
echo "=== Building DJ indexes ==="
node scripts/build-dj-indexes.js

echo ""
echo "Done! Restart dev server or redeploy for changes to take effect."
