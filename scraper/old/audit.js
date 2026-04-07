/**
 * TrackTrackr — Audit Script
 * ─────────────────────────────────────────────────────────────────
 * Scans all scraped files, cross-references against the index,
 * and generates a retry queue for any problematic sets.
 *
 * Categories checked:
 *   MISSING      — file doesn't exist on disk at all
 *   NO_RECORDINGS — file exists but missing recordings field (old format)
 *   CAPTCHA_ERROR — file exists but scrapeError: captcha-timeout
 *   EMPTY_TRACKS  — tracksIdentified > 0 in index but tracks: [] on disk
 *   CORRUPT       — file exists but can't be parsed as JSON
 *
 * RUN:
 *   node audit.js
 *   node audit.js --index=tracklore_index_updated_2026-03-29.json
 *   node audit.js --fix   (just show counts, don't write retry queue)
 * ─────────────────────────────────────────────────────────────────
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

let chalk;
try { chalk = require('chalk'); } catch { chalk = new Proxy({}, { get: () => s => s }); }

// ── config ─────────────────────────────────────────────────────────
const ARGS = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k,v] = a.slice(2).split('='); return [k, v ?? true]; })
);

const DOWNLOADS  = path.join(os.homedir(), 'Downloads');
const INDEX_FILE = path.join(DOWNLOADS, ARGS.index || 'tracklore_index_complete_1467sets.json');
const OUT_BASE   = path.join(DOWNLOADS, 'umf_miami');
const DRY_RUN    = ARGS.fix === true;

const T   = () => new Date().toISOString().substring(11,19);
const log = m => console.log(`[${T()}] ${m}`);
const ok  = m => console.log(chalk.green(`[${T()}] ✅ ${m}`));
const err = m => console.log(chalk.red(`[${T()}] ❌ ${m}`));
const wrn = m => console.log(chalk.yellow(`[${T()}] ⚠️  ${m}`));
const prg = m => console.log(chalk.cyan(`[${T()}] 📊 ${m}`));

// ── filename (must match scraper.js) ──────────────────────────────
function slugify(str) {
  return (str || '')
    .toLowerCase()
    .replace(/\s*[&+]\s*/g, '-and-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

function buildFilename(set) {
  const date  = (set.date || `${set.year || 'unknown'}-01-01`).replace(/-/g, '_');
  const dj    = slugify(set.dj);
  const stage = slugify(set.stage || 'unknown-stage');
  return `${date}_${dj}_${stage}_UMF_Miami.json`;
}

function outPath(set) {
  return path.join(OUT_BASE, String(set.year || 'unknown'), buildFilename(set));
}

function readSet(fp) {
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
  catch { return null; }
}

// ── main ────────────────────────────────────────────────────────────
function main() {
  console.log('\n' + chalk.bold('🔍  TrackTrackr — Audit'));
  console.log(chalk.gray('══════════════════════════════════\n'));

  // Load index
  if (!fs.existsSync(INDEX_FILE)) {
    err(`Index file not found: ${INDEX_FILE}`);
    process.exit(1);
  }

  const raw  = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  const sets = Array.isArray(raw) ? raw : Object.values(raw.sets || raw);
  log(`Index: ${sets.length} sets`);

  // Audit results
  const issues = {
    MISSING:        [],
    NO_RECORDINGS:  [],
    CAPTCHA_ERROR:  [],
    EMPTY_TRACKS:   [],
    CORRUPT:        [],
  };

  let clean = 0;

  for (const set of sets) {
    const fp   = outPath(set);
    const exists = fs.existsSync(fp);

    if (!exists) {
      issues.MISSING.push(set);
      continue;
    }

    const data = readSet(fp);

    if (!data) {
      issues.CORRUPT.push(set);
      continue;
    }

    // Missing recordings field (old scraper format)
    if (!Object.prototype.hasOwnProperty.call(data, 'recordings')) {
      issues.NO_RECORDINGS.push(set);
      continue;
    }

    // Captcha timeout — file saved but set wasn't actually scraped
    if (data.scrapeError === 'captcha-timeout') {
      issues.CAPTCHA_ERROR.push(set);
      continue;
    }

    // Empty tracks when we expected some
    if (
      set.tracksIdentified > 3 &&
      Array.isArray(data.tracks) &&
      data.tracks.length === 0 &&
      !data.scrapeError
    ) {
      issues.EMPTY_TRACKS.push(set);
      continue;
    }

    clean++;
  }

  // ── report ────────────────────────────────────────────────────────
  console.log('');
  prg(`AUDIT RESULTS`);
  console.log(chalk.gray('──────────────────────────────────'));
  ok( `Clean (no issues):         ${clean}`);
  wrn(`Missing (never scraped):   ${issues.MISSING.length}`);
  wrn(`No recordings field:       ${issues.NO_RECORDINGS.length}`);
  wrn(`Captcha timeout:           ${issues.CAPTCHA_ERROR.length}`);
  wrn(`Empty tracks (unexpected): ${issues.EMPTY_TRACKS.length}`);
  err(`Corrupt files:             ${issues.CORRUPT.length}`);
  console.log(chalk.gray('──────────────────────────────────'));

  const retryList = [
    ...issues.MISSING,
    ...issues.CAPTCHA_ERROR,
    ...issues.EMPTY_TRACKS,
    ...issues.CORRUPT,
    ...issues.NO_RECORDINGS,
  ];

  console.log(chalk.yellow(`\nTotal sets needing retry: ${retryList.length}`));

  if (retryList.length === 0) {
    ok('Everything looks good! No retry needed.');
    return;
  }

  // Show samples per category
  for (const [cat, list] of Object.entries(issues)) {
    if (list.length === 0) continue;
    console.log(`\n${chalk.cyan(cat)} (${list.length} sets):`);
    list.slice(0, 5).forEach(s =>
      console.log(`  ${chalk.gray(s.date)} ${s.dj} @ ${s.stage}`)
    );
    if (list.length > 5) console.log(`  ${chalk.gray(`...and ${list.length - 5} more`)}`);
  }

  if (DRY_RUN) {
    log('\n--fix mode: showing counts only, not writing retry queue');
    return;
  }

  // Write retry queue
  const retryFile = path.join(DOWNLOADS, '_retry_queue.json');
  // Sort: missing first, then captcha errors, then empty tracks
  const sorted = retryList.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  fs.writeFileSync(retryFile, JSON.stringify(sorted, null, 2));

  ok(`\nRetry queue written: ${retryFile.replace(os.homedir(), '~')}`);
  log(`Run retry scraper:  node scraper.js --index=${path.basename(retryFile)}`);
}

main();
