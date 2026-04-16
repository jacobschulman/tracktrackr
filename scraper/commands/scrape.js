const fs = require('fs');
const path = require('path');
const os = require('os');
const { launchBrowser, createPage, getPageState } = require('../lib/browser');
const { handleCloudflare, getCooldownMs, resetCfCount } = require('../lib/cloudflare');
const { parsePage } = require('../lib/parser');
const { loadState, markScraped, markFailed, getRetryQueue } = require('../lib/state');
const { sleep, buildFilename, outPath } = require('../lib/utils');
const { createLogger, chalk } = require('../lib/logger');

let cliProgress;
try { cliProgress = require('cli-progress'); } catch { cliProgress = null; }

const log = createLogger('SCRAPE', 'cyan');

function alreadyScraped(set, config) {
  const fp = outPath(set, config);
  if (!fs.existsSync(fp)) return false;
  try {
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    return Object.prototype.hasOwnProperty.call(data, 'recordings');
  } catch { return false; }
}

function writeSet(data, config) {
  const fp = outPath(data, config);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
  return fp;
}

async function scrapeSet(page, set, config) {
  const label = `${set.dj} @ ${set.stage || '?'} (${set.date})`;
  log.info(`→ ${label}`);

  try {
    await page.goto(set.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1500);

    let state = await getPageState(page);
    log.info(`  Page state: ${state}`);

    // Handle Cloudflare (forwarding + captcha)
    if (state === 'forward' || state === 'captcha') {
      const result = await handleCloudflare(page, state, log);
      if (result === 'resolved') {
        state = await getPageState(page);
      } else {
        return { error: 'cloudflare-blocked' };
      }
    }

    // Wait for tracks if not already visible
    if (state !== 'tracks') {
      try {
        await page.waitForSelector('.tlpItem', { timeout: 30000 });
      } catch {
        log.warn(`  No tracks found — storing empty`);
        return {
          data: {
            ...set, djs: [], tracks: [], recordings: [],
            scrapedAt: new Date().toISOString(),
            scrapeVersion: 2,
          }
        };
      }
    }

    // Parse the page
    const { djs, tracks, recordings, meta } = await parsePage(page);

    const normal = tracks.filter(t => t.type === 'normal').length;
    const blends = tracks.filter(t => t.type === 'blend').length;
    const cued = tracks.filter(t => t.cueTime !== null).length;
    const withMedia = tracks.filter(t => t.mediaIds).length;
    const recStr = recordings.length ? `, ${recordings.map(r => r.platform).join('/')}` : '';

    log.ok(`  ${normal} tracks, ${blends} blends, ${cued} cue times, ${withMedia} media IDs${recStr}`);

    const djName = djs.length > 0 ? djs.map(d => d.name).join(' & ') : set.dj;

    return {
      data: {
        ...set,
        dj: djName,
        stage: set.stage || meta.stageName || '',
        djs: djs.length
          ? djs
          : djName.split(/\s*(?:&|x|b2b)\s*/i).map(n => ({
              name: n.trim(),
              slug: n.trim().toLowerCase().replace(/[^a-z0-9]/g, ''),
            })),
        genre: meta.genre || set.genre || '',
        tracksIdentified: meta.tracksIdentified || set.tracksIdentified || 0,
        tracksTotal: meta.tracksTotal || set.tracksTotal || 0,
        duration: meta.duration || set.duration || '',
        tracks,
        recordings,
        scrapedAt: new Date().toISOString(),
        scrapeVersion: 2,
      }
    };

  } catch (e) {
    if (e.message.toLowerCase().includes('timeout')) {
      log.warn(`  Timeout — backing off 15s`);
      await sleep(15000);
    } else {
      log.err(`  Error: ${e.message}`);
    }
    return { error: e.message };
  }
}

async function run(config, args) {
  console.log('\n' + chalk.bold(`🎧  TrackTrackr — ${config.displayName} Scraper`));
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
  log.ok(`Loaded ${sets.length} sets from index`);

  // Load state
  const state = loadState(config.name);

  // Filter
  let queue = [...sets].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (args.year) {
    queue = queue.filter(s => String(s.year) === String(args.year));
    log.info(`Filtered to year ${args.year}: ${queue.length} sets`);
  }

  if (args.weekend) {
    const wk = String(args.weekend);
    queue = queue.filter(s => {
      const isW2 = /-weekend-2\b/i.test(s.url || '') || /-weekend-2\b/i.test(s.dj || '');
      return wk === '2' ? isW2 : !isW2;
    });
    log.info(`Filtered to weekend ${wk}: ${queue.length} sets`);
  }

  if (args.filter) {
    const ids = new Set(args.filter.split(','));
    queue = queue.filter(s => ids.has(s.tlId));
    log.info(`Filtered to ${queue.length} specific sets`);
  }

  if (args['retry-failed']) {
    const retryIds = new Set(getRetryQueue(state));
    queue = queue.filter(s => retryIds.has(s.tlId));
    log.info(`Retry mode: ${queue.length} failed sets to retry`);
  } else {
    // Skip already scraped
    queue = queue.filter(s => !alreadyScraped(s, config));
  }

  const totalSets = sets.length;
  const skipped = totalSets - queue.length;

  log.info(`Already done: ${chalk.green(skipped)} | To scrape: ${chalk.yellow(queue.length)}`);

  const delay = parseInt(args.delay ?? '5000');
  log.info(`Delay: ${delay}ms + jitter | Single worker | Stealth: on`);

  if (queue.length === 0) { log.ok('Nothing to scrape!'); return; }

  // Progress bar
  let bar = null;
  if (cliProgress) {
    bar = new cliProgress.SingleBar({
      format: '  [{bar}] {percentage}% | {value}/{total} | ETA: {eta}s',
      barCompleteChar: '█', barIncompleteChar: '░', hideCursor: true,
    });
    bar.start(totalSets, skipped);
  }

  // Launch browser
  log.info('Launching Chrome...');
  const browser = await launchBrowser();
  const page = await createPage(browser);
  log.ok('Chrome launched\n');

  const stats = { done: 0, failed: 0, empty: 0 };

  try {
    for (let i = 0; i < queue.length; i++) {
      const set = queue[i];
      const result = await scrapeSet(page, set, config);

      if (result.data) {
        const fp = writeSet(result.data, config);
        const trackCount = result.data.tracks.length;
        const hasMediaIds = result.data.tracks.some(t => t.mediaIds);

        markScraped(state, set.tlId, {
          trackCount,
          hasMediaIds,
          outputFile: fp.replace(os.homedir(), '~'),
        });

        if (trackCount > 0) {
          stats.done++;
          log.save(fp.replace(os.homedir(), '~'));
        } else {
          stats.empty++;
          log.warn(`Saved empty: ${buildFilename(set, config)}`);
        }
      } else {
        stats.failed++;
        markFailed(state, set.tlId, result.error);
        log.warn(`Failed: ${set.dj} ${set.date} — ${result.error}`);
      }

      if (bar) bar.increment();

      // Pacing
      if (i < queue.length - 1) {
        const cooldown = getCooldownMs();
        const jitter = Math.floor(Math.random() * 1000);
        const waitMs = Math.max(delay, cooldown) + jitter;
        if (cooldown > delay) {
          log.warn(`Cloudflare cooldown: waiting ${waitMs / 1000}s`);
        }
        await sleep(waitMs);
        resetCfCount();
      }
    }
  } finally {
    await browser.close();
    if (bar) bar.stop();
  }

  console.log('\n' + chalk.gray('══════════════════════════════════════'));
  log.ok('COMPLETE');
  console.log(`  ${chalk.green(`Scraped: ${stats.done}`)}`);
  console.log(`  ${chalk.gray(`Empty:   ${stats.empty}`)}`);
  console.log(`  ${chalk.yellow(`Failed:  ${stats.failed}`)}`);
  console.log(`  ${chalk.gray(`Skipped: ${skipped}`)}`);

  const outDir = config.outputDir.replace(/^~/, os.homedir());
  console.log(`  ${chalk.cyan(`Output:  ${outDir.replace(os.homedir(), '~')}`)}`);
}

module.exports = { run };
