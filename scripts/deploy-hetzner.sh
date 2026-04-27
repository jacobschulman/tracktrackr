#!/bin/bash
# Deploy to Hetzner VPS via SSH.
# Usage: ./scripts/deploy-hetzner.sh [branch]
# Requires SSH host alias "hetzner" configured in ~/.ssh/config with key access.

set -euo pipefail

BRANCH="${1:-main}"
REMOTE="hetzner"
DEPLOY_PATH="/srv/festivalsets/app"
PM2_NAME="festivalsets"

echo "Deploying branch '$BRANCH' to $REMOTE:$DEPLOY_PATH..."

ssh "$REMOTE" bash <<EOF
  set -euo pipefail
  cd "$DEPLOY_PATH"
  git fetch origin
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
  npm ci --production=false
  npm run build
  pm2 restart "$PM2_NAME"
  pm2 save
EOF

echo "Deploy complete. Production at https://tracktrackr.hedgebreeze.com"
