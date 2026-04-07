#!/usr/bin/env node
/**
 * TrackTrackr — Scraper CLI
 * ─────────────────────────────────────────────────────────────────
 * Unified scraper for 1001tracklists.com. Festival-agnostic.
 *
 * Usage:
 *   node cli.js <command> --festival=<name> [options]
 *
 * Commands:
 *   scrape     Puppeteer-based set scraping (Phase 1)
 *   discover   Find new sets via 1001TL AJAX API
 *   resolve    Resolve internal IDs → Spotify/YT/Apple/SC (Phase 2)
 *   audit      Cross-reference index vs scraped files
 *
 * Examples:
 *   node cli.js scrape   --festival=ultra-miami
 *   node cli.js scrape   --festival=ultra-miami --year=2026
 *   node cli.js scrape   --festival=ultra-miami --retry-failed
 *   node cli.js discover --festival=ultra-miami --year=2026
 *   node cli.js resolve  --festival=ultra-miami --concurrency=5
 *   node cli.js audit    --festival=ultra-miami
 * ─────────────────────────────────────────────────────────────────
 */

const { loadFestival } = require('./lib/config');

const COMMANDS = {
  scrape:   () => require('./commands/scrape'),
  discover: () => require('./commands/discover'),
  resolve:  () => require('./commands/resolve'),
  audit:    () => require('./commands/audit'),
};

function printHelp() {
  console.log(`
TrackTrackr Scraper CLI

Usage: node cli.js <command> --festival=<name> [options]

Commands:
  scrape      Scrape set pages with Puppeteer (Phase 1)
              --delay=<ms>        Base delay between requests (default: 5000)
              --year=<YYYY>       Only scrape sets from this year
              --filter=<ids>      Comma-separated tlIds to scrape
              --retry-failed      Only retry previously failed sets
              --index=<path>      Override index file path

  discover    Find new sets via 1001TL AJAX API
              --year=<YYYY>       Only discover sets from this year
              --dry-run           Show what would be added

  resolve     Resolve track IDs to platform IDs (Phase 2, HTTP only)
              --concurrency=<N>   Parallel HTTP requests (default: 5)
              --delay=<ms>        Delay between requests (default: 200)
              --year=<YYYY>       Only resolve tracks from this year
              --force             Re-resolve already resolved sets

  audit       Cross-reference index vs scraped files
              --fix               Show counts only

Global options:
  --festival=<name>   Required. Maps to festivals/<name>.json
  --index=<path>      Override index file path
`);
}

async function main() {
  const command = process.argv[2];
  const args = Object.fromEntries(
    process.argv.slice(3)
      .filter(a => a.startsWith('--'))
      .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
  );

  if (!command || command === 'help' || command === '--help') {
    printHelp();
    process.exit(0);
  }

  if (!COMMANDS[command]) {
    console.error(`Unknown command: ${command}`);
    console.error(`Available: ${Object.keys(COMMANDS).join(', ')}`);
    process.exit(1);
  }

  if (!args.festival) {
    console.error('Missing required option: --festival=<name>');
    console.error('Example: node cli.js scrape --festival=ultra-miami');
    process.exit(1);
  }

  const config = loadFestival(args.festival);
  const cmd = COMMANDS[command]();

  try {
    await cmd.run(config, args);
  } catch (e) {
    console.error(`\n❌ Fatal: ${e.message}`);
    if (process.env.DEBUG) console.error(e.stack);
    process.exit(1);
  }
}

main();
