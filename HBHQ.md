---
deploy:
  type: none
actions:
  staging_label: Vercel preview
  ship_label: Merge to production
  merge_label: Merge PR
  setup_merge_label: Merge HBHQ.md
  send_back_label: Request changes
---

# Tracktrackr HBHQ Contract

Tracktrackr is a Next.js app for festival/social tracking. HBHQ dispatches feature and bug work into this repo, and GitHub/Vercel handle preview and production deploys automatically.

HBHQ should treat this as merge-only until a first-class Vercel deploy integration exists. Pushed feature branches get Vercel preview deployments, and merges to `main` deploy production.

## Build And Test

- No automated tests exist. Note this in every PR.
- Run `npm run lint` before committing to catch lint errors.
- Run `npm run build` to verify the Next.js build succeeds before marking work done.

## Deploy

- Production: pushes to `main` auto-deploy through Vercel.
- Preview: pushes to feature branches auto-create Vercel preview deployments.
- Production URL: `https://tracktrackr.hedgebreeze.com`.
- Vercel default URL: `https://tracktrackr-jacobschulmans-projects.vercel.app`.
- Branch preview URL pattern: `https://tracktrackr-git-<branch>-jacobschulmans-projects.vercel.app`, with Vercel's branch-name normalization.
- The legacy `scripts/deploy-hetzner.sh` script references an old FestivalSets self-hosted path. Do not use it for HBHQ deploys unless hosting is intentionally changed back.

## Agent Notes

- Check `data/` structure and existing festival JSON files before touching data ingestion or indexing code.
- After data changes, run `./scripts/rebuild-all.sh` to regenerate indexes.
- `ADMIN_PASSWORD` protects admin API routes. Do not commit secrets.
- Keep PRs focused on the assigned HBHQ item. Do not merge your own PR.
