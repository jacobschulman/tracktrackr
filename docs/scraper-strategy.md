# TrackTrackr Scraper / Ingestion Strategy

## Recommendation

Do not do a full rewrite yet.

Instead, split the current one-off scraper pipeline into four explicit layers:

1. discovery
2. fetch / capture
3. normalize
4. publish

That gives us a safer and more resilient architecture for EDC Las Vegas and Tomorrowland without throwing away the useful heuristics we already built for IDs, mashups, blends, aliases, and recordings.

## Why this is the right next step

The current project already contains valuable logic worth preserving:

- stage normalization
- DJ alias enrichment
- mashup expansion and inference
- blend grouping
- recording extraction

But it is coupled to a single festival and a single raw-source shape, which will get painful fast as we add EDC and Tomorrowland.

## What is brittle today

### 1. Festival-specific assumptions are baked into the pipeline

- `scripts/prepare-data.mjs` is hard-coded to `data/ultra-miami` and `Ultra Music Festival Miami`.
- `js/config.js` points the whole app at `data/ultra-miami`.
- `js/data.js` uses singleton caches, so multi-festival loading will collide unless we separate cache state per festival.

### 2. Data quality is being corrected too late and too heuristically

We already have evidence of bad entity parsing in produced data:

- `Sixth Annual` became `Si` + `th Annual`
- some yearmix entries appear split into a fake second DJ with an empty name
- there are still many `Unknown Stage` entries

This means we need normalization as a first-class stage with issue tracking, not just a final cleanup script.

### 3. The schema is missing provenance

Right now a set mostly stores the final normalized fields and raw URL, but not enough audit trail about:

- where each field came from
- how confident we are
- whether a value was scraped, inferred, or manually corrected
- whether a set was fetched from HTML, API/XHR, or a saved snapshot

That makes debugging and backfills harder.

### 4. “Fully autonomous anti-bot bypass” is the wrong dependency

Trying to build a laptop workflow around defeating Cloudflare interstitials or CAPTCHAs is fragile and will keep breaking. It is also not something we should make central to the design.

The resilient path is:

- prefer stable data sources when available
- support browser-assisted/session-assisted capture
- store raw artifacts locally so normalization can be replayed without refetching

## Proposed architecture

### Layer 1: Discovery

Input:

- festival metadata
- year/date range
- search queries
- known stage names
- known artist roster

Output:

- candidate set records with source URLs and discovery evidence

Example record:

```json
{
  "festivalSlug": "edc-las-vegas",
  "year": 2026,
  "candidateUrl": "https://www.1001tracklists.com/tracklist/...",
  "source": "1001tracklists",
  "discoveredVia": "festival-search",
  "discoveryQuery": "site:1001tracklists.com EDC Las Vegas 2026",
  "status": "candidate"
}
```

### Layer 2: Fetch / Capture

This should support multiple fetch modes:

- `http`: plain fetch for pages that work normally
- `browser-session`: human logs in / clears challenge once, tool reuses local browser session
- `saved-html`: manually saved page or archive dropped into an inbox folder
- `saved-json`: captured XHR/API payloads from devtools

Important principle:

The system should normalize from captured artifacts, not require a live request every time.

That is what makes a second laptop viable.

### Layer 3: Normalize

Turn raw artifacts into a canonical internal schema with:

- provenance
- confidence
- normalization warnings
- manual override support

### Layer 4: Publish

Compile canonical records into the lightweight app format used by the frontend.

That lets the app stay fast while the ingest schema becomes richer.

## Schema v2 proposal

Keep the current app-facing shape, but introduce a richer canonical source schema upstream.

### Set

```json
{
  "id": "1001tl:29vcbht9",
  "source": {
    "system": "1001tracklists",
    "sourceId": "29vcbht9",
    "url": "https://www.1001tracklists.com/tracklist/...",
    "fetchMode": "browser-session"
  },
  "festival": {
    "slug": "edc-las-vegas",
    "name": "Electric Daisy Carnival Las Vegas",
    "editionYear": 2026
  },
  "set": {
    "displayName": "Artist at Kinetic Field",
    "date": "2026-05-15",
    "stage": {
      "raw": "kineticFIELD",
      "normalized": "Kinetic Field",
      "confidence": 0.98
    },
    "artists": [
      {
        "name": "Artist",
        "slug": "artist",
        "role": "primary",
        "source": "scraped"
      }
    ]
  },
  "stats": {
    "tracksIdentified": 18,
    "tracksTotal": 21,
    "durationText": "1h 02m",
    "views": 1234,
    "likes": 56
  },
  "media": {
    "recordings": [],
    "artifacts": []
  },
  "quality": {
    "warnings": [
      "artist-parse-low-confidence"
    ],
    "needsReview": true
  }
}
```

### Track appearance

```json
{
  "position": "14",
  "type": "normal",
  "raw": {
    "artist": "Artist A vs. Artist B",
    "title": "Track 1 vs. Track 2",
    "label": "Label 1 / Label 2"
  },
  "canonical": [
    {
      "artist": "Artist A",
      "title": "Track 1",
      "matchType": "direct",
      "confidence": 0.99
    },
    {
      "artist": "Artist B",
      "title": "Track 2",
      "matchType": "mashup-component",
      "confidence": 0.78
    }
  ],
  "blendGroupId": "blend:1001tl:29vcbht9:14"
}
```

This solves a big current problem: right now we preserve the final inference, but we do not preserve enough of the raw-to-canonical decision.

## Operational model for “another laptop”

Best option:

- run a small local ingest worker on the laptop
- keep a local artifact cache directory
- use a persistent browser profile for session-assisted capture
- schedule periodic discovery runs
- schedule normalization/publish runs separately

What not to depend on:

- bespoke Cloudflare bypass logic
- CAPTCHA solving as the core ingestion path
- brittle selectors without saved artifact fallback

Better fallback flow:

1. discovery finds candidate URLs
2. fetch tries normal HTTP
3. if blocked, it marks the record `needs_browser_capture`
4. browser-assisted capture saves the HTML/XHR payload
5. normalize/publish proceed from local artifacts

That keeps the system running mostly on its own while still surviving anti-bot gates.

## EDC Las Vegas pilot plan

Use EDC Las Vegas as the first full test of the new ingestion pipeline.

### Success criteria

- clean festival-level dataset
- artist parsing handles solo acts, duos, b2bs, and branded aliases
- stage normalization works for EDC-specific stages
- recordings are preserved
- IDs, mashups, and blends are represented with provenance
- reruns are idempotent

### Suggested order

1. define festival config for `edc-las-vegas`
2. create canonical schema and artifact folders
3. build discovery runner for candidate set URLs
4. build fetch modes with artifact cache
5. port current normalization heuristics into reusable modules
6. add review reports for low-confidence parses
7. publish app-ready JSON

## Tomorrowland after EDC

Tomorrowland should come second because it will pressure-test:

- stage aliases
- artist aliases
- year/edition naming
- branded back-to-back formats
- more complex recording coverage

If the architecture survives both EDC and Tomorrowland, it is probably the right one.

## Concrete next build step

Build the new ingestion pipeline beside the existing Ultra data, not on top of it.

Start with:

- `data-sources/1001tracklists/`
- `ingest/config/festivals/edc-las-vegas.json`
- `ingest/artifacts/`
- `ingest/canonical/`
- `ingest/publish/`

Then port the current heuristics out of `scripts/prepare-data.mjs` and `js/data.js` into shared normalization modules.

## Bottom line

Do not rearchitect the entire product.

Do rearchitect the ingestion pipeline into a source-aware, artifact-first, multi-festival system.

That gets us the resilience we want, improves JSON quality, keeps the good heuristics, and avoids making anti-bot circumvention the foundation of the project.
