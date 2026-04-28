#!/usr/bin/env bash
# Deploy festivalsets to Hetzner.
#
# Usage:
#   ./scripts/deploy-hetzner.sh                   # staging, current branch
#   ./scripts/deploy-hetzner.sh staging            # staging, current branch
#   ./scripts/deploy-hetzner.sh staging my-branch  # staging, specific branch
#   ./scripts/deploy-hetzner.sh prod               # prod, main branch
set -euo pipefail

ENV="${1:-staging}"
HOST="hetzner"

case "$ENV" in
  prod)
    BRANCH="main"
    APP_DIR="/srv/festivalsets/app"
    PM2_NAME="festivalsets"
    PORT=3200
    URL="https://festivalsets.info"
    ;;
  staging)
    BRANCH="${2:-$(git rev-parse --abbrev-ref HEAD)}"
    APP_DIR="/srv/festivalsets/staging"
    PM2_NAME="festivalsets-staging"
    PORT=3201
    URL="https://staging.festivalsets.info"
    ;;
  *)
    echo "usage: deploy-hetzner.sh [prod|staging] [branch]" >&2
    exit 1
    ;;
esac

echo ">>> deploying '$BRANCH' -> $ENV ($URL)"
ssh "$HOST" bash -s <<EOF
set -euo pipefail
cd $APP_DIR
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH
rm -rf .next
npm ci --prefer-offline
npm run build
pm2 restart $PM2_NAME 2>/dev/null || pm2 start npm --name $PM2_NAME -- start -- -p $PORT
pm2 save
echo ">>> done: $URL"
EOF
