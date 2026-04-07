/**
 * TrackTrackr — Puppeteer Scraper
 * ─────────────────────────────────────────────────────────────────
 * Scrapes all Ultra Miami tracklists from 1001tracklists.com
 *
 * Output: ~/Downloads/umf_miami/{year}/{YYYY_MM_DD}_{dj}_{stage}_UMF_Miami.json
 *
 * Each file includes:
 *   - Set metadata (DJ, stage, date, genre, views, likes)
 *   - djs[] — structured DJ array, handles B2B correctly
 *   - tracks[] — full tracklist with blend groups + Spotify/SC/YT mediaIds per track
 *   - recordings[] — set-level recording links (YouTube, SoundCloud, Hearthis, Mixcloud)
 *
 * SETUP:
 *   npm install puppeteer-extra puppeteer-extra-plugin-stealth chalk@4 cli-progress
 *
 * RUN:
 *   node scraper.js                    default: 1 worker, 3s delay
 *   node scraper.js --workers=2
 *   node scraper.js --delay=4000
 *
 * RESUME: re-run anytime — skips files that already have a recordings field
 * ─────────────────────────────────────────────────────────────────
 */

const puppeteer     = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs            = require('fs');
const path          = require('path');
const os            = require('os');

puppeteer.use(StealthPlugin());

let chalk, cliProgress;
try { chalk       = require('chalk');        } catch { chalk = new Proxy({}, { get: (_,k) => k === 'bold' ? new Proxy({}, { get: () => s => s }) : s => s }); }
try { cliProgress = require('cli-progress'); } catch { cliProgress = null; }

// ── config ─────────────────────────────────────────────────────────
const INDEX_FILE  = path.join(os.homedir(), 'Downloads', 'tracklore_index_complete_1467sets.json');
const OUT_BASE    = path.join(os.homedir(), 'Downloads', 'umf_miami');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const ARGS = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
);

const NUM_WORKERS  = Math.min(parseInt(ARGS.workers  ?? '1'), 8);
const DELAY_MS     = parseInt(ARGS.delay ?? '3000');
const PAGE_TIMEOUT = 30000;
const FORWARD_WAIT = 6000;
const CAPTCHA_POLL = 3000;
const CAPTCHA_MAX  = 60;

const W_COLORS = ['cyan', 'yellow', 'green', 'magenta', 'blueBright', 'redBright', 'white', 'gray'];

// ── logger ─────────────────────────────────────────────────────────
const T = () => new Date().toISOString().substring(11, 19);

function wLog(wId, msg, type = 'info') {
  const col    = W_COLORS[wId % W_COLORS.length];
  const prefix = chalk[col](`[W${wId + 1}][${T()}]`);
  if      (type === 'ok')   console.log(`${prefix} ✅ ${chalk.green(msg)}`);
  else if (type === 'warn') console.log(`${prefix} ⚠️  ${chalk.yellow(msg)}`);
  else if (type === 'err')  console.log(`${prefix} ❌ ${chalk.red(msg)}`);
  else if (type === 'skip') console.log(`${prefix} ⏭️  ${chalk.gray(msg)}`);
  else if (type === 'save') console.log(`${prefix} 💾 ${chalk.cyan(msg)}`);
  else                      console.log(`${prefix} ${msg}`);
}

function mLog(msg, type = 'info') {
  const prefix = chalk.bold(`[MAIN][${T()}]`);
  if      (type === 'ok')  console.log(`${prefix} ✅ ${chalk.green(msg)}`);
  else if (type === 'err') console.log(`${prefix} ❌ ${chalk.red(msg)}`);
  else if (type === 'prg') console.log(`${prefix} 📦 ${chalk.yellow(msg)}`);
  else                     console.log(`${prefix} ${msg}`);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── filename helpers ────────────────────────────────────────────────
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
  const dir = path.join(OUT_BASE, String(set.year || 'unknown'));
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, buildFilename(set));
}

// Skip if file already has recordings field (new format)
// Re-scrape if file exists but missing recordings (old Puppeteer format)
function alreadyScraped(set) {
  const fp = outPath(set);
  if (!fs.existsSync(fp)) return false;
  try {
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    return Object.prototype.hasOwnProperty.call(data, 'recordings');
  } catch { return false; }
}

function writeSet(data) {
  const fp = outPath(data);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
  return fp;
}

// ── page state ──────────────────────────────────────────────────────
async function getPageState(page) {
  try {
    return await page.evaluate(() => {
      const text = document.body?.innerText || '';
      const url  = window.location.href;
      if (document.querySelectorAll('.tlpItem').length > 0)        return 'tracks';
      if (text.includes('Fill out the captcha') ||
          text.includes('Just a moment') ||
          url.includes('challenges.cloudflare') ||
          text.includes('Turnstile'))                               return 'captcha';
      if (text.includes('Please wait') ||
          text.includes('forwarded to'))                            return 'forward';
      if (document.querySelector('h1'))                             return 'loaded';
      return 'unknown';
    });
  } catch { return 'unknown'; }
}

// ── captcha handler ─────────────────────────────────────────────────
async function handleCaptcha(page, wId) {
  wLog(wId, '🤖 Captcha/Cloudflare — please solve in browser window', 'warn');
  for (let i = 0; i < CAPTCHA_MAX; i++) {
    await sleep(CAPTCHA_POLL);
    const state = await getPageState(page);
    if (state === 'tracks' || state === 'loaded') {
      wLog(wId, 'Captcha solved — resuming', 'ok');
      return true;
    }
    if (i > 0 && i % 10 === 0) wLog(wId, `Still waiting... (${i * CAPTCHA_POLL / 1000}s)`, 'warn');
  }
  wLog(wId, 'Captcha timed out — skipping set', 'err');
  return false;
}

// ── page parser ─────────────────────────────────────────────────────
// Runs entirely inside page.evaluate() — no Node context needed
async function parsePage(page) {
  return page.evaluate(() => {

    // ── DJs from h1 only ─────────────────────────────────────────
    const h1  = document.querySelector('h1');
    const djs = h1
      ? Array.from(h1.querySelectorAll('a[href*="/dj/"]')).map(a => ({
          name: a.textContent.trim(),
          slug: (a.getAttribute('href').match(/\/dj\/([^/]+)\//) || [])[1] || ''
        }))
      : [];

    // ── set-level recordings ──────────────────────────────────────
    // 1001TL source IDs → platform names
    const SOURCE_MAP = {
      '10': 'soundcloud',
      '13': 'youtube',
      '18': 'youtube',
      '28': 'spotify',
      '40': 'hearthis',
      '52': 'mixcloud',
    };

    const recordings = [];
    document.querySelectorAll('[data-idmedia][data-idsource]').forEach(el => {
      const idMedia   = el.getAttribute('data-idmedia');
      const idSource  = el.getAttribute('data-idsource');
      const platform  = SOURCE_MAP[idSource] || `source_${idSource}`;
      const iframeSrc = el.querySelector('iframe')?.getAttribute('src') || '';

      let url = iframeSrc;

      // SoundCloud: extract track URL from player wrapper
      const scMatch = iframeSrc.match(/url=([^&]+)/);
      if (scMatch) {
        try { url = decodeURIComponent(scMatch[1]); } catch { url = scMatch[1]; }
      }
      // YouTube / youtube-nocookie: extract video ID
      const ytMatch = iframeSrc.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
      if (ytMatch) url = `https://www.youtube.com/watch?v=${ytMatch[1]}`;
      // Mixcloud: extract key from encoded URL
      const mcMatch = iframeSrc.match(/mixcloud\.com%2F([^%&"]+)/i);
      if (mcMatch) url = `https://www.mixcloud.com/${decodeURIComponent(mcMatch[1])}`;
      // Hearthis: extract numeric ID
      const htMatch = iframeSrc.match(/hearthis\.at\/embed\/(\d+)/);
      if (htMatch) url = `https://hearthis.at/${htMatch[1]}/`;

      if (idMedia && idSource) {
        recordings.push({ platform, idMedia, idSource, url: url || iframeSrc });
      }
    });

    // ── track-level media IDs (per-track Spotify/SC/YT IDs) ──────
    function parseMediaIds(el) {
      const ICONS = {
        spotify:    'fa-spotify',
        youtube:    'fa-video-camera',
        soundcloud: 'fa-soundcloud',
        appleMusic: 'fa-apple',
      };
      const ids = {};
      for (const [platform, cls] of Object.entries(ICONS)) {
        const btn = el.querySelector(`.mAction.${cls},.${cls}.mAction`);
        if (!btn) continue;
        const m = (btn.getAttribute('onclick') || '').match(/idItem:\s*(\d+)/);
        if (m) ids[platform] = m[1];
      }
      return Object.keys(ids).length ? ids : null;
    }

    // ── tracks ────────────────────────────────────────────────────
    const raw = Array.from(document.querySelectorAll('.tlpItem')).map(el => {
      const cls  = el.className;
      const full = (el.querySelector('.trackValue')?.textContent || '').trim();
      if (!full) return null;
      const di    = full.indexOf(' - ');
      const rowM  = cls.match(/trRow(\d+)/);
      return {
        pos:      (el.querySelector('.fontXL')?.textContent || '').trim(),
        artist:   di > -1 ? full.substring(0, di).trim() : full,
        title:    di > -1 ? full.substring(di + 3).trim() : '',
        remix:    (el.querySelector('.trackEditData')?.textContent || '').trim(),
        label:    (el.querySelector('.trackLabel,.iBlock.notranslate')?.textContent || '').trim(),
        trackId:  el.getAttribute('data-id') || '',
        row:      rowM ? parseInt(rowM[1]) : null,
        type:     cls.includes('tlpSubTog') ? 'sub' : cls.includes(' con') ? 'blend' : 'normal',
        mediaIds: parseMediaIds(el),
      };
    }).filter(t => t && (t.artist || t.title) && t.type !== 'sub');

    // Group blend tracks onto their parent numbered track
    const tracks = [];
    for (const t of raw) {
      if (t.type === 'normal') {
        tracks.push({ ...t, blendGroup: null });
      } else if (t.type === 'blend') {
        const parent = tracks[tracks.length - 1];
        if (parent) {
          if (!parent.blendGroup) parent.blendGroup = [{
            artist: parent.artist, title: parent.title,
            remix:  parent.remix,  trackId: parent.trackId,
          }];
          parent.blendGroup.push({ artist: t.artist, title: t.title, remix: t.remix, trackId: t.trackId });
          tracks.push({ ...t });
        }
      }
    }

    return { djs, tracks, recordings };
  });
}

// ── scrape one set ──────────────────────────────────────────────────
async function scrapeSet(page, set, wId) {
  const label = `${set.dj} @ ${set.stage} (${set.date})`;
  wLog(wId, `→ ${label}`);

  try {
    await page.goto(set.url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });
    await sleep(1500);

    let state = await getPageState(page);
    wLog(wId, `  Page state: ${state}`);

    if (state === 'forward') {
      wLog(wId, `  Forwarding page — waiting ${FORWARD_WAIT / 1000}s...`);
      await sleep(FORWARD_WAIT);
      state = await getPageState(page);
    }

    if (state === 'captcha') {
      const solved = await handleCaptcha(page, wId);
      if (!solved) return { ...set, djs: [], tracks: [], recordings: [], scrapeError: 'captcha-timeout', scrapedAt: new Date().toISOString() };
      state = await getPageState(page);
    }

    if (state !== 'tracks') {
      try {
        await page.waitForSelector('.tlpItem', { timeout: PAGE_TIMEOUT });
      } catch {
        // Old/empty set — no identified tracks, still save it
        wLog(wId, `  No tracks found — storing empty`, 'warn');
        return { ...set, djs: [], tracks: [], recordings: [], scrapedAt: new Date().toISOString() };
      }
    }

    const { djs, tracks, recordings } = await parsePage(page);

    const normal = tracks.filter(t => t.type === 'normal').length;
    const blends = tracks.filter(t => t.type === 'blend').length;
    const isB2B  = djs.length > 1;
    const recStr = recordings.length ? `, 🎵 ${recordings.map(r => r.platform).join('/')}` : '';

    wLog(wId, `  ${normal} tracks, ${blends} blends${isB2B ? ', 🤝 B2B' : ''}${recStr}`, 'ok');

    return {
      ...set,
      djs: djs.length
        ? djs
        : set.dj.split(/\s*(?:&|x|b2b)\s*/i).map(n => ({
            name: n.trim(),
            slug: n.trim().toLowerCase().replace(/[^a-z0-9]/g, ''),
          })),
      tracks,
      recordings,
      scrapedAt: new Date().toISOString(),
    };

  } catch (e) {
    if (e.message.toLowerCase().includes('timeout')) {
      wLog(wId, `  Timeout — backing off 15s`, 'warn');
      await sleep(15000);
    } else {
      wLog(wId, `  Error: ${e.message}`, 'err');
    }
    return null;
  }
}

// ── worker ──────────────────────────────────────────────────────────
async function runWorker(browser, queue, wId, stats, bar) {
  wLog(wId, `Starting — ${queue.length} sets assigned`);

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
  });

  // Block heavy resources — faster page loads
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (['image', 'font', 'media', 'stylesheet'].includes(req.resourceType())) req.abort();
    else req.continue();
  });

  let workerDone = 0;

  for (let i = 0; i < queue.length; i++) {
    const set = queue[i];

    if (alreadyScraped(set)) {
      wLog(wId, `Skipping (done): ${buildFilename(set)}`, 'skip');
      stats.skipped++;
      if (bar) bar.increment();
      continue;
    }

    const result = await scrapeSet(page, set, wId);

    if (result) {
      const fp = writeSet(result);
      stats.done++;
      workerDone++;
      wLog(wId, fp.replace(os.homedir(), '~'), 'save');
    } else {
      stats.failed++;
      wLog(wId, `Will retry next run: ${set.dj} ${set.date}`, 'warn');
    }

    if (bar) bar.increment();

    if (workerDone > 0 && workerDone % 25 === 0) {
      wLog(wId, `─── ${workerDone} scraped this session ───`);
    }

    const jitter = Math.floor(Math.random() * 600);
    await sleep(DELAY_MS + jitter);
  }

  await page.close();
  wLog(wId, `Done — ${workerDone} sets scraped this session`, 'ok');
}

// ── main ────────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + chalk.bold('🎧  TrackTrackr — Ultra Miami Scraper'));
  console.log(chalk.gray('══════════════════════════════════════\n'));

  if (!fs.existsSync(INDEX_FILE)) {
    mLog(`Index file not found: ${INDEX_FILE}`, 'err');
    process.exit(1);
  }

  const raw  = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  const sets = Array.isArray(raw) ? raw : Object.values(raw.sets || raw);
  mLog(`Loaded ${sets.length} sets from index`, 'ok');

  const sorted    = [...sets].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const todo      = sorted.filter(s => !alreadyScraped(s));
  const doneCount = sorted.length - todo.length;

  mLog(`Output:  ~/Downloads/umf_miami/{year}/{date}_{dj}_{stage}_UMF_Miami.json`);
  mLog(`Workers: ${NUM_WORKERS} | Delay: ${DELAY_MS}ms + jitter | Stealth: on`);
  mLog(`Already done: ${chalk.green(doneCount)} | To scrape: ${chalk.yellow(todo.length)}`);

  if (todo.length === 0) { mLog('All done!', 'ok'); return; }

  const etaMins = Math.round(todo.length * (DELAY_MS + 400) / NUM_WORKERS / 60000);
  mLog(`ETA: ~${etaMins} min\n`);

  let bar = null;
  if (cliProgress) {
    bar = new cliProgress.SingleBar({
      format: '  [{bar}] {percentage}% | {value}/{total} | ETA: {eta}s',
      barCompleteChar: '█', barIncompleteChar: '░', hideCursor: true,
    });
    bar.start(sorted.length, doneCount);
  }

  mLog('Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless:       false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1400,900',
    ],
    defaultViewport: null,
  });
  mLog('Chrome launched\n', 'ok');

  const chunks = Array.from({ length: NUM_WORKERS }, (_, i) =>
    todo.filter((_, idx) => idx % NUM_WORKERS === i)
  );
  chunks.forEach((c, i) =>
    mLog(`Worker ${i + 1}: ${c.length} sets (${c[0]?.date} → ${c[c.length - 1]?.date})`)
  );
  console.log('');

  const stats = { done: 0, failed: 0, skipped: doneCount };

  try {
    await Promise.all(chunks.map((chunk, wId) => runWorker(browser, chunk, wId, stats, bar)));
  } finally {
    await browser.close();
    if (bar) bar.stop();
  }

  console.log('\n' + chalk.gray('══════════════════════════════════════'));
  mLog('COMPLETE', 'ok');
  console.log(`  ${chalk.green(`✅ Scraped: ${stats.done}`)}`);
  console.log(`  ${chalk.gray(`⏭️  Skipped: ${stats.skipped}`)}`);
  console.log(`  ${chalk.yellow(`⚠️  Failed:  ${stats.failed}`)}`);
  console.log(`  ${chalk.cyan(`📁 ${OUT_BASE.replace(os.homedir(), '~')}`)}`);

  // Write manifest
  const manifest = [];
  for (const year of fs.readdirSync(OUT_BASE).filter(f => /^\d{4}$|^unknown$/.test(f))) {
    for (const file of fs.readdirSync(path.join(OUT_BASE, year)).filter(f => f.endsWith('.json'))) {
      manifest.push(`${year}/${file}`);
    }
  }
  manifest.sort();
  fs.writeFileSync(path.join(OUT_BASE, '_manifest.txt'), manifest.join('\n'));
  mLog(`Manifest: ${manifest.length} files written`);
}

main().catch(e => {
  console.error(chalk.red('\n❌ Fatal:'), e.message);
  process.exit(1);
});
