#!/usr/bin/env bash
# Deploy festivalsets to hetzner.
# Usage: ./scripts/deploy-hetzner.sh [branch]
# Defaults to current branch.
set -euo pipefail

BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"
HOST="hetzner"
APP_DIR="/srv/festivalsets/app"

echo ">>> deploying branch '$BRANCH' to $HOST"
ssh "$HOST" bash -s <<EOF
set -euo pipefail
cd $APP_DIR
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH
npm ci --prefer-offline
npm run build
pm2 restart festivalsets 2>/dev/null || pm2 start npm --name festivalsets -- start -- -p 3200
pm2 save
echo ">>> deploy complete"
EOF
