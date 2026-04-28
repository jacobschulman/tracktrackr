---
deploy:
  working_dir: .
  staging_command: ./scripts/deploy-hetzner.sh staging
  staging_url: https://staging.festivalsets.info
  prod_command: ./scripts/deploy-hetzner.sh prod
  type: script
actions:
  staging_label: Deploy to staging
  ship_label: Ship to production
  merge_label: Merge PR
  setup_merge_label: Merge HBHQ.md
  send_back_label: Send back to agent
---

## Agent Instructions

- **No automated tests exist.** Note this in every PR.
- Run `npm run lint` before committing to catch lint errors.
- Run `npm run build` to verify the Next.js build succeeds before marking work done.
- Check `data/` structure and existing festival JSON files before touching data ingestion or indexing code.
- After data changes, run `./scripts/rebuild-all.sh` to regenerate indexes.
- Deploys use SSH to a Hetzner server (host alias `hetzner`). The deploy script is `./scripts/deploy-hetzner.sh`. Staging deploys the current branch to `/srv/festivalsets/staging` (PM2 `festivalsets-staging`, port 3201). Prod deploys `main` to `/srv/festivalsets/app` (PM2 `festivalsets`, port 3200).
- Production domain: `https://festivalsets.info`. Staging: `https://staging.festivalsets.info`. `tracktrackr.com` redirects to prod.
- `ADMIN_PASSWORD` env var protects admin API routes — default fallback is `'tracktrackr-admin'`. Do not commit secrets.
- Keep PRs focused on the assigned HBHQ item. Do not merge your own PR.
