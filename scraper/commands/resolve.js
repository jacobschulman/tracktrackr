const fs = require('fs');
const path = require('path');
const os = require('os');
const { resolveTracks } = require('../lib/resolver');
const { loadState, markResolved, getPendingResolve } = require('../lib/state');
const { createLogger, chalk } = require('../lib/logger');

const log = createLogger('RESOLVE', 'green');

async function run(config, args) {
  console.log('\n' + chalk.bold(`🔗  TrackTrackr — Resolve Platform IDs (${config.displayName})`));
  console.log(chalk.gray('══════════════════════════════════════\n'));

  const outDir = config.outputDir.replace(/^~/, os.homedir());
  const state = loadState(config.name);

  // Find sets to resolve
  let tlIds;
  if (args.filter) {
    tlIds = args.filter.split(',');
  } else if (args.force) {
    // Re-resolve everything that has mediaIds
    tlIds = Object.entries(state.sets)
      .filter(([, s]) => s.hasMediaIds)
      .map(([id]) => id);
  } else {
    tlIds = getPendingResolve(state);
  }

  if (args.year) {
    // Need to cross-reference with actual files to filter by year
    tlIds = tlIds.filter(id => {
      const s = state.sets[id];
      if (!s?.outputFile) return false;
      return s.outputFile.includes(`/${args.year}/`);
    });
  }

  log.info(`Sets to resolve: ${tlIds.length}`);
  if (tlIds.length === 0) { log.ok('Nothing to resolve!'); return; }

  const concurrency = parseInt(args.concurrency ?? '5');
  const delayMs = parseInt(args.delay ?? '200');
  log.info(`Concurrency: ${concurrency} | Delay: ${delayMs}ms`);

  let resolved = 0, skipped = 0, failed = 0;

  for (const tlId of tlIds) {
    const stateEntry = state.sets[tlId];
    if (!stateEntry?.outputFile) {
      log.warn(`No output file recorded for ${tlId} — skipping`);
      skipped++;
      continue;
    }

    const fp = stateEntry.outputFile.replace(/^~/, os.homedir());
    if (!fs.existsSync(fp)) {
      // Try scanning year directories
      let found = null;
      try {
        for (const year of fs.readdirSync(outDir).filter(f => /^\d{4}$/.test(f))) {
          for (const file of fs.readdirSync(path.join(outDir, year)).filter(f => f.endsWith('.json'))) {
            const data = JSON.parse(fs.readFileSync(path.join(outDir, year, file), 'utf8'));
            if (data.tlId === tlId) { found = path.join(outDir, year, file); break; }
          }
          if (found) break;
        }
      } catch { /* ignore */ }

      if (!found) {
        log.warn(`File not found for ${tlId} — skipping`);
        skipped++;
        continue;
      }
    }

    const filePath = fs.existsSync(fp) ? fp : null;
    if (!filePath) { skipped++; continue; }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const tracksWithMedia = data.tracks.filter(t => t.mediaIds);

      if (tracksWithMedia.length === 0) {
        log.skip(`${data.dj} (${data.date}) — no mediaIds`);
        skipped++;
        continue;
      }

      log.info(`${data.dj} (${data.date}) — ${tracksWithMedia.length} tracks to resolve`);

      data.tracks = await resolveTracks(data.tracks, { concurrency, delayMs, log });
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      markResolved(state, tlId);
      resolved++;

      const withPlatformIds = data.tracks.filter(t => t.platformIds).length;
      log.ok(`  ${withPlatformIds}/${tracksWithMedia.length} resolved → ${filePath.replace(os.homedir(), '~')}`);
    } catch (e) {
      log.err(`  Failed ${tlId}: ${e.message}`);
      failed++;
    }
  }

  console.log('\n' + chalk.gray('══════════════════════════════════════'));
  log.ok('COMPLETE');
  console.log(`  ${chalk.green(`Resolved: ${resolved}`)}`);
  console.log(`  ${chalk.gray(`Skipped:  ${skipped}`)}`);
  console.log(`  ${chalk.yellow(`Failed:   ${failed}`)}`);
}

module.exports = { run };
