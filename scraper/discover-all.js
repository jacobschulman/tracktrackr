#!/usr/bin/env node
/**
 * Discover indexes for all festivals, one after another.
 * Opens Chrome for each — scroll to load all sets, press Enter, repeat.
 *
 * Usage:
 *   node discover-all.js
 *   node discover-all.js --skip=ultra-miami,edc-las-vegas   # skip ones you've done
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
  const queue = FESTIVALS.filter(f => !skipSet.has(f));

  // Check which already have indexes
  const status = queue.map(name => {
    const config = loadFestival(name);
    const indexPath = path.join(__dirname, config.indexFile);
    const exists = fs.existsSync(indexPath);
    let count = 0;
    if (exists) {
      try { count = JSON.parse(fs.readFileSync(indexPath, 'utf8')).length; } catch {}
    }
    return { name, displayName: config.displayName, exists, count };
  });

  console.log('\n🎪  TrackTrackr — Batch Discover');
  console.log('════════════════════════════════════\n');

  for (const s of status) {
    const icon = s.exists ? `✅ ${s.count} sets` : '⬜ not yet';
    console.log(`  ${s.displayName.padEnd(30)} ${icon}`);
  }

  const todo = status.filter(s => !s.exists);
  if (todo.length === 0) {
    console.log('\n✅ All indexes already exist! Use --skip or delete an index to re-discover.');
    return;
  }

  console.log(`\n📋 Will discover: ${todo.map(s => s.name).join(', ')}`);
  console.log('   For each: scroll to load all sets → press Enter → next festival\n');

  const discover = require('./commands/discover');

  for (let i = 0; i < todo.length; i++) {
    const { name } = todo[i];
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`  Festival ${i + 1}/${todo.length}: ${name}`);
    console.log(`${'─'.repeat(50)}`);

    const config = loadFestival(name);
    try {
      await discover.run(config, {});
    } catch (e) {
      console.error(`\n❌ ${name} failed: ${e.message}`);
      console.log('   Continuing to next festival...\n');
    }
  }

  // Final summary
  console.log(`\n${'═'.repeat(50)}`);
  console.log('📊  Final Index Summary');
  console.log(`${'═'.repeat(50)}\n`);

  for (const name of FESTIVALS) {
    const config = loadFestival(name);
    const indexPath = path.join(__dirname, config.indexFile);
    if (fs.existsSync(indexPath)) {
      try {
        const count = JSON.parse(fs.readFileSync(indexPath, 'utf8')).length;
        console.log(`  ✅ ${config.displayName.padEnd(30)} ${count} sets`);
      } catch {
        console.log(`  ⚠️  ${config.displayName.padEnd(30)} error reading index`);
      }
    } else {
      console.log(`  ⬜ ${config.displayName.padEnd(30)} no index`);
    }
  }
  console.log('');
}

main().catch(e => { console.error(e); process.exit(1); });
