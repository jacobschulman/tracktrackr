---
deploy:
  type: script
  working_dir: /srv/tracktrackr
  staging_command: ./scripts/deploy-hetzner.sh staging {branch}
  staging_url: https://staging.festivalsets.info
  prod_command: ./scripts/deploy-hetzner.sh prod
actions:
  staging_label: Deploy to staging
  ship_label: Ship to production
  merge_label: Merge PR
  setup_merge_label: Merge HBHQ.md
  send_back_label: Send back to agent
---

# Tracktrackr HBHQ Contract

Tracktrackr is a Next.js app for festival/social tracking. HBHQ dispatches feature and bug work into this repo, deploys feature branches to the staging Festivalsets instance, and ships merged work to production through the repo deploy script.

## Build And Test

- No automated tests exist. Note this in every PR.
- Run `npm run lint` before committing to catch lint errors.
- Run `npm run build` to verify the Next.js build succeeds before marking work done.

## Deploy

- Deploy script: `./scripts/deploy-hetzner.sh`.
- Staging: `./scripts/deploy-hetzner.sh staging {branch}` deploys to `/srv/festivalsets/staging`, PM2 `festivalsets-staging`, port `3201`.
- Production: `./scripts/deploy-hetzner.sh prod` deploys `main` to `/srv/festivalsets/app`, PM2 `festivalsets`, port `3200`.
- Production domain: `https://festivalsets.info`. Staging: `https://staging.festivalsets.info`. `tracktrackr.com` redirects to production.

## Agent Notes

- Check `data/` structure and existing festival JSON files before touching data ingestion or indexing code.
- After data changes, run `./scripts/rebuild-all.sh` to regenerate indexes.
- `ADMIN_PASSWORD` protects admin API routes. Do not commit secrets.
- Keep PRs focused on the assigned HBHQ item. Do not merge your own PR.
