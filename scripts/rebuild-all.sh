#!/bin/bash
# Regenerates all festival indexes and the track index
# Usage: ./scripts/rebuild-all.sh

set -e
cd "$(dirname "$0")/.."

echo "=== Rebuilding festival indexes ==="
for dir in data/*/; do
  slug=$(basename "$dir")
  if [ -d "$dir" ] && [ "$slug" != "track-search.json" ]; then
    if ls "$dir"*//*.json 1> /dev/null 2>&1; then
      node scripts/generate-index.js "$slug"
    fi
  fi
done

echo ""
echo "=== Building track index ==="
node scripts/build-track-index.js

echo ""
echo "Done!"
