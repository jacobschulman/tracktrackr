# Deployment

TrackTrackr is hosted on **Vercel** with automatic deployments from GitHub.

## How it works

- **Production**: every push to `main` auto-deploys to production
- **Preview**: every push to any other branch gets its own preview URL
- Builds take ~1 minute (66 static pages + on-demand rendering for everything else)

## URLs

| Environment | URL |
|---|---|
| Production | `tracktrackr.hedgebreeze.com` |
| Vercel default | `tracktrackr-jacobschulmans-projects.vercel.app` |
| Preview branches | `tracktrackr-git-<branch>-jacobschulmans-projects.vercel.app` |

## Workflow

```bash
# Work on a feature
git checkout -b feature/whatever
# ... make changes ...
git push -u origin feature/whatever
# → Vercel deploys a preview URL automatically

# When ready, merge to main
git checkout main
git merge feature/whatever
git push origin main
# → Production updates automatically
```

## Architecture

### On-demand rendering

Most pages are **not** pre-built at deploy time. Instead:

- Static pages (home, DJs list, tracks list, stages, etc.) are pre-rendered at build time (~66 pages)
- Dynamic pages (`/set/[tlId]`, `/track/[id]`, `/dj/[slug]`, `/journeys/[id]`) render on first visit and are cached by Vercel automatically
- This means adding new festival data doesn't require rebuilding every page

### Data

- Festival data lives in `data/` as JSON files (index + individual set files)
- Data is read server-side at runtime, not bundled as static assets
- Search uses an API route (`/api/search`) that builds indexes on demand

### Analytics

- Vercel Analytics and Speed Insights are enabled in the root layout
- View in the Vercel dashboard under the Analytics tab

## DNS (GoDaddy)

The custom domain uses a CNAME record:

| Type | Name | Value |
|---|---|---|
| CNAME | `tracktrackr` | `cname.vercel-dns.com` |

SSL is provisioned automatically by Vercel.

## Previous hosting

The app was previously on GitHub Pages using `output: 'export'` (full static site). That workflow file is preserved in `.github/workflows-disabled/deploy.yml` but is no longer active.

## Scraper data pipeline

See [scraper-strategy.md](./scraper-strategy.md) for the full ingestion architecture.

To add new festival data:
1. Run the scraper to collect set data (see `scraper/` directory)
2. Process and place JSON files in `data/<festival>/`
3. Push to `main` — pages render on-demand, no rebuild needed

## Useful commands

```bash
# Local dev
npm run dev

# Production build (test locally)
npm run build && npm start

# Trigger a redeploy without code changes
git commit --allow-empty -m "Trigger redeploy" && git push

# Check deploy status
gh run list --limit 5
```
