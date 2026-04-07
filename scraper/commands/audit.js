const fs = require('fs');
const path = require('path');
const os = require('os');
const { loadState, getStats } = require('../lib/state');
const { outPath } = require('../lib/utils');
const { createLogger, chalk } = require('../lib/logger');

const log = createLogger('AUDIT', 'yellow');

async function run(config, args) {
  console.log('\n' + chalk.bold(`🔍  TrackTrackr — Audit (${config.displayName})`));
  console.log(chalk.gray('══════════════════════════════════════\n'));

  // Load index
  const indexPath = args.index
    ? path.resolve(args.index)
    : path.join(__dirname, '..', config.indexFile);

  if (!fs.existsSync(indexPath)) {
    log.err(`Index file not found: ${indexPath}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const sets = Array.isArray(raw) ? raw : Object.values(raw.sets || raw);
  log.info(`Index: ${sets.length} sets`);

  // Load state
  const state = loadState(config.name);
  const stateStats = getStats(state);
  log.info(`State: ${stateStats.total} tracked, ${stateStats.scraped} scraped, ${stateStats.failed} failed`);

  // Audit
  const issues = {
    MISSING: [],
    NO_RECORDINGS: [],
    CAPTCHA_ERROR: [],
    EMPTY_TRACKS: [],
    CORRUPT: [],
    NO_CUE_TIMES: [],
    NO_MEDIA_IDS: [],
  };
  let clean = 0;

  for (const set of sets) {
    const fp = outPath(set, config);
    if (!fs.existsSync(fp)) { issues.MISSING.push(set); continue; }

    let data;
    try { data = JSON.parse(fs.readFileSync(fp, 'utf8')); }
    catch { issues.CORRUPT.push(set); continue; }

    if (!Object.prototype.hasOwnProperty.call(data, 'recordings')) {
      issues.NO_RECORDINGS.push(set);
      continue;
    }

    if (data.scrapeError === 'captcha-timeout') {
      issues.CAPTCHA_ERROR.push(set);
      continue;
    }

    if (set.tracksIdentified > 3 && Array.isArray(data.tracks) && data.tracks.length === 0) {
      issues.EMPTY_TRACKS.push(set);
      continue;
    }

    // New checks
    if (data.tracks?.length > 0 && !data.tracks.some(t => t.cueTime !== null && t.cueTime !== undefined)) {
      issues.NO_CUE_TIMES.push(set);
    }
    if (data.tracks?.length > 0 && !data.tracks.some(t => t.mediaIds)) {
      issues.NO_MEDIA_IDS.push(set);
    }

    clean++;
  }

  // Report
  console.log('');
  log.info('AUDIT RESULTS');
  console.log(chalk.gray('──────────────────────────────────'));
  console.log(chalk.green(`  Clean (no issues):         ${clean}`));
  console.log(chalk.yellow(`  Missing (never scraped):   ${issues.MISSING.length}`));
  console.log(chalk.yellow(`  No recordings field:       ${issues.NO_RECORDINGS.length}`));
  console.log(chalk.yellow(`  Captcha timeout:           ${issues.CAPTCHA_ERROR.length}`));
  console.log(chalk.yellow(`  Empty tracks (unexpected): ${issues.EMPTY_TRACKS.length}`));
  console.log(chalk.red(`  Corrupt files:             ${issues.CORRUPT.length}`));
  console.log(chalk.gray(`  No cue times (v1 scrape):  ${issues.NO_CUE_TIMES.length}`));
  console.log(chalk.gray(`  No media IDs:              ${issues.NO_MEDIA_IDS.length}`));
  console.log(chalk.gray('──────────────────────────────────'));

  const retryList = [
    ...issues.MISSING,
    ...issues.CAPTCHA_ERROR,
    ...issues.EMPTY_TRACKS,
    ...issues.CORRUPT,
    ...issues.NO_RECORDINGS,
  ];

  console.log(chalk.yellow(`\nSets needing re-scrape: ${retryList.length}`));

  if (retryList.length === 0) {
    log.ok('Everything looks good!');
    return;
  }

  // Show samples
  for (const [cat, list] of Object.entries(issues)) {
    if (list.length === 0 || cat === 'NO_CUE_TIMES' || cat === 'NO_MEDIA_IDS') continue;
    console.log(`\n${chalk.cyan(cat)} (${list.length}):`);
    list.slice(0, 5).forEach(s =>
      console.log(`  ${chalk.gray(s.date || '????-??-??')} ${s.dj} @ ${s.stage || '?'}`)
    );
    if (list.length > 5) console.log(chalk.gray(`  ...and ${list.length - 5} more`));
  }

  if (args.fix) {
    log.info('\n--fix mode: showing counts only');
    return;
  }

  // Write retry queue (as tlId list for --filter flag)
  const retryIds = retryList.map(s => s.tlId).join(',');
  console.log(`\nTo re-scrape failed sets:`);
  console.log(chalk.cyan(`  node cli.js scrape --festival=${config.name} --retry-failed`));
  console.log(`\nOr specific sets:`);
  console.log(chalk.cyan(`  node cli.js scrape --festival=${config.name} --filter=${retryIds.substring(0, 80)}...`));
}

module.exports = { run };
