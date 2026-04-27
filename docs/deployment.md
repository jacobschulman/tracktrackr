# Deployment

TrackTrackr runs on a self-hosted **Hetzner VPS** in production. Vercel is used for preview deployments (branch previews) via the GitHub integration.

## Production (Hetzner)

| Property | Value |
|---|---|
| Host alias | `hetzner` (configure in `~/.ssh/config`) |
| Deploy path | `/srv/festivalsets/app` |
| Process manager | PM2 (process name: `festivalsets`) |
| Port | 3200 |
| URL | `https://tracktrackr.hedgebreeze.com` |

### How to deploy

```bash
./scripts/deploy-hetzner.sh main
```

The script SSHes to the `hetzner` host, pulls the branch, runs `npm ci && npm run build`, then restarts PM2. Requires SSH key access to the server.

### PM2 quick reference

```bash
# On the server
pm2 status              # check process state
pm2 logs festivalsets   # tail logs
pm2 restart festivalsets
pm2 save                # persist process list across reboots
```

### Environment variables

Set these in `/srv/festivalsets/app/.env.local` on the server (never commit secrets):

| Variable | Purpose | Default |
|---|---|---|
| `ADMIN_PASSWORD` | Protects `/admin` routes | `tracktrackr-admin` |

## Previews (Vercel)

Every branch pushed to GitHub gets an auto-deployed preview URL from Vercel:

| Environment | URL |
|---|---|
| Preview branch | `tracktrackr-git-<branch>-jacobschulmans-projects.vercel.app` |

Preview deployments do **not** replace the Hetzner production server. They are read-only previews for reviewing PRs.

> The previous setup hosted production on Vercel too. That was migrated to Hetzner to avoid ISR billing. The Vercel project still exists for previews.

## DNS (GoDaddy)

| Type | Name | Value |
|---|---|---|
| A / CNAME | `tracktrackr` | Hetzner server IP |

SSL is provisioned via Let's Encrypt on the server (or reverse proxy).

## Architecture

### Rendering

- Static pages (home, DJs list, tracks list, stages, etc.) are pre-rendered at build time (~66 pages)
- Dynamic pages (`/set/[tlId]`, `/track/[id]`, `/dj/[slug]`, `/journeys/[id]`) render on first request and are cached by Next.js

### Data

- Festival data lives in `data/` as JSON files (index + individual set files)
- Data is read server-side at runtime, not bundled as static assets
- Search uses an API route (`/api/search`)

### Analytics

- Google Analytics (G-7CSFLQ7T60) with structured GA4 events

## Data pipeline

See [scraper-strategy.md](./scraper-strategy.md) for the full scraping architecture.

### Adding a new festival

1. **Scrape set data** into `data/<festival-slug>/` with year subdirectories (e.g. `data/tomorrowland/2024/`)
2. **Add festival config** to `lib/festivals.ts` — slug, display name, accent color
3. **Add festival name** to `scripts/generate-index.js` `FESTIVAL_NAMES` map
4. **Run the rebuild script**:
   ```bash
   ./scripts/rebuild-all.sh
   ```
5. **Commit and push**, then run `./scripts/deploy-hetzner.sh main`

### Adding new sets to an existing festival

1. Drop set JSON files into the appropriate year directory
2. Run `./scripts/rebuild-all.sh`
3. Commit, push, and deploy

### Data architecture

| File | Size | Purpose |
|---|---|---|
| `data/<festival>/index.json` | ~50-500KB each | All set metadata for a festival |
| `data/djs/<slug>.json` | ~1-20KB each | Pre-computed DJ stats, timeline, signature tracks |
| `data/file-index.json` | ~580KB | Maps set tlId → file path for fast lookups |
| `data/recordings.json` | ~295KB | Maps set tlId → YouTube/SoundCloud URLs |

### Build scripts

| Script | Purpose |
|---|---|
| `scripts/rebuild-all.sh` | Runs everything below in order |
| `scripts/generate-index.js <slug>` | Builds `index.json` for one festival |
| `scripts/build-dj-indexes.js` | Builds per-DJ indexes, file index, and recordings index |

Run `rebuild-all.sh` whenever you add or change festival data. It takes ~30 seconds.

### Admin panel

Visit `/admin` to manage data visibility without editing files:
- **Hide/show festivals** — e.g. hide a festival that hasn't happened yet
- **Block sets** — search by DJ name and block bad data (aftermovies, duplicates)
- Changes write to `data/blocklist.json`. Requires server restart / redeploy.
- Password is set via `ADMIN_PASSWORD` env var (default: `tracktrackr-admin`)

## Useful commands

```bash
# Local dev
npm run dev

# Rebuild all data indexes after adding new festival data
./scripts/rebuild-all.sh

# Production build (test locally)
npm run build && npm start

# Deploy to production
./scripts/deploy-hetzner.sh main
```

## Previous hosting

The app was previously on GitHub Pages using `output: 'export'` (full static site). That workflow file is preserved in `.github/workflows-disabled/deploy.yml` but is no longer active. Production then moved to Vercel, and later migrated to Hetzner to avoid ISR billing.
