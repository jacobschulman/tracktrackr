---
deploy:
  working_dir: .
  staging_command: # TODO: No staging environment currently configured. Add one and update this field.
  staging_url: # TODO: No staging URL currently configured. Update when a staging environment exists.
  prod_command: ./scripts/deploy-hetzner.sh main
  type: script
actions:
  staging_label: Deploy tracktrackr to staging
  ship_label: Ship tracktrackr to production
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
- The production deploy uses SSH to a Hetzner server (host alias `hetzner`) and requires SSH key access configured on the runner. The deploy script lives at `./scripts/deploy-hetzner.sh` and deploys to `/srv/festivalsets/app` (PM2 process `festivalsets`, port 3200).
- Production domain: `tracktrackr.hedgebreeze.com` (Hetzner VPS). Vercel previews are active for all branches but do not serve production traffic.
- `ADMIN_PASSWORD` env var protects admin API routes — default fallback is `'tracktrackr-admin'`. Do not commit secrets.
- Keep PRs focused on the assigned HBHQ item. Do not merge your own PR.
