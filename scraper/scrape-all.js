#!/usr/bin/env node
/**
 * Scrape all festival sets, one festival at a time.
 * Opens Chrome with stealth — use a mouse clicker for Turnstile challenges.
 *
 * Usage:
 *   node scrape-all.js
 *   node scrape-all.js --skip=ultra-miami         # skip festivals
 *   node scrape-all.js --only=edc-las-vegas       # just one
 *   node scrape-all.js --year=2025                 # only 2025 sets
 *   node scrape-all.js --only=coachella --weekend=1 # only W1 (excludes -weekend-2 slugs)
 *   node scrape-all.js --delay=8000                # slower pacing (ms)
 */

const fs = require('fs');
const path = require('path');
const { loadFestival } = require('./lib/config');

const FESTIVALS = [
  'edc-las-vegas',
  'coachella',
  'tomorrowland',
  'electric-zoo',
  'creamfields',
  'mysteryland',
  'lollapalooza',
  'parookaville',
  'ultra-miami',
];

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2)
      .filter(a => a.startsWith('--'))
      .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
  );

  const skipSet = new Set((args.skip || '').split(',').filter(Boolean));
  const onlySet = args.only ? new Set(args.only.split(',')) : null;

  let queue = FESTIVALS;
  if (onlySet) queue = queue.filter(f => onlySet.has(f));
  queue = queue.filter(f => !skipSet.has(f));

  // Check status
  const status = queue.map(name => {
    const config = loadFestival(name);
    const indexPath = path.join(__dirname, config.indexFile);
    if (!fs.existsSync(indexPath)) return { name, config, indexCount: 0, hasIndex: false };
    try {
      const sets = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      return { name, config, indexCount: sets.length, hasIndex: true };
    } catch {
      return { name, config, indexCount: 0, hasIndex: false };
    }
  }).filter(s => s.hasIndex);

  console.log('\n🎧  TrackTrackr — Batch Scraper');
  console.log('════════════════════════════════════\n');

  if (args.year) console.log(`  Filtering to year: ${args.year}`);
  console.log(`  Delay: ${args.delay || 5000}ms + jitter\n`);

  for (const s of status) {
    console.log(`  ${s.config.displayName.padEnd(30)} ${s.indexCount} sets in index`);
  }

  const total = status.reduce((sum, s) => sum + s.indexCount, 0);
  console.log(`\n  Total: ${total} sets across ${status.length} festivals\n`);

  const scrape = require('./commands/scrape');

  for (let i = 0; i < status.length; i++) {
    const { name, config } = status[i];
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`  Festival ${i + 1}/${status.length}: ${config.displayName}`);
    console.log(`${'═'.repeat(50)}`);

    try {
      await scrape.run(config, args);
    } catch (e) {
      console.error(`\n❌ ${name} failed: ${e.message}`);
      console.log('   Continuing to next festival...\n');
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log('🏁  All done!');
  console.log(`${'═'.repeat(50)}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
