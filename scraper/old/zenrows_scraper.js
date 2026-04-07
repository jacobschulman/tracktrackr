/**
 * TrackTrackr — ZenRows Scraper
 * ─────────────────────────────────────────────────────────────────
 * Uses ZenRows API to bypass Cloudflare — no browser needed.
 * Reads index JSON, scrapes each set page, writes to disk.
 *
 * SETUP:
 *   npm install axios cheerio chalk@4 cli-progress p-limit
 *   Sign up at zenrows.com — grab your API key
 *
 * RUN:
 *   ZENROWS_KEY=your_key_here node scraper_zenrows.js
 *   ZENROWS_KEY=your_key node scraper_zenrows.js --concurrency=5
 *   ZENROWS_KEY=your_key node scraper_zenrows.js --delay=1000
 *
 * RESUME: re-run anytime — skips files already on disk
 * ─────────────────────────────────────────────────────────────────
 */

const axios     = require('axios');
const cheerio   = require('cheerio');
const fs        = require('fs');
const path      = require('path');
const os        = require('os');
const pLimit    = require('p-limit');

let chalk, cliProgress;
try { chalk       = require('chalk');        } catch { chalk = new Proxy({}, { get: () => s => s }); }
try { cliProgress = require('cli-progress'); } catch { cliProgress = null; }

// ── config ─────────────────────────────────────────────────────────
const ZENROWS_KEY  = process.env.ZENROWS_KEY;
const INDEX_FILE   = path.join(os.homedir(), 'Downloads', 'tracklore_index_complete_1467sets.json');
const OUT_BASE     = path.join(os.homedir(), 'Downloads', 'umf_miami');

const ARGS = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k,v] = a.slice(2).split('='); return [k, v ?? true]; })
);

const CONCURRENCY = parseInt(ARGS.concurrency ?? '2');  // parallel requests
const DELAY_MS    = parseInt(ARGS.delay ?? '500');       // ms between requests
const MAX_RETRIES = 3;

// ── logger ─────────────────────────────────────────────────────────
const T   = () => new Date().toISOString().substring(11,19);
const log = (m, c='') => console.log(c ? chalk[c](`[${T()}] ${m}`) : `[${T()}] ${m}`);
const ok  = m => console.log(chalk.green(`[${T()}] ✅ ${m}`));
const err = m => console.log(chalk.red(`[${T()}] ❌ ${m}`));
const wrn = m => console.log(chalk.yellow(`[${T()}] ⚠️  ${m}`));
const prg = m => console.log(chalk.yellow(`[${T()}] 📦 ${m}`));

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── filename ───────────────────────────────────────────────────────
function slugify(str) {
  return (str || '')
    .toLowerCase()
    .replace(/\s*[&+]\s*/g, '-and-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

function buildFilename(set) {
  const date  = (set.date || `${set.year||'unknown'}-01-01`).replace(/-/g, '_');
  const dj    = slugify(set.dj);
  const stage = slugify(set.stage || 'unknown-stage');
  return `${date}_${dj}_${stage}_UMF_Miami.json`;
}

function outPath(set) {
  const dir = path.join(OUT_BASE, String(set.year || 'unknown'));
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, buildFilename(set));
}

const alreadyScraped = set => fs.existsSync(outPath(set));

function writeSet(data) {
  const fp = outPath(data);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
  return fp;
}

// ── ZenRows fetch ──────────────────────────────────────────────────
async function fetchPage(url, attempt = 1) {
  try {
    const resp = await axios.get('https://api.zenrows.com/v1/', {
      params: {
        apikey:           ZENROWS_KEY,
        url:              url,
        js_render:        'true',    // execute JS like a real browser
        wait_for:         '.tlpItem', // wait for tracks to appear
        premium_proxy:    'true',    // residential IP — key for Cloudflare
        proxy_country:    'us',
      },
      timeout: 45000,
    });
    return resp.data;
  } catch (e) {
    const status = e.response?.status;
    const msg    = e.response?.data?.message || e.message;

    if (status === 422) {
      // Page loaded but wait_for selector never appeared — no tracks
      wrn(`No tracks selector on ${url} (422) — returning as empty`);
      return e.response?.data?.html || '';
    }
    if (status === 429 || status === 503) {
      if (attempt <= MAX_RETRIES) {
        const wait = attempt * 10000;
        wrn(`Rate limited (${status}) — waiting ${wait/1000}s before retry ${attempt}/${MAX_RETRIES}`);
        await sleep(wait);
        return fetchPage(url, attempt + 1);
      }
    }
    if (attempt <= MAX_RETRIES) {
      wrn(`Error ${status || '?'}: ${msg} — retry ${attempt}/${MAX_RETRIES} in 5s`);
      await sleep(5000 * attempt);
      return fetchPage(url, attempt + 1);
    }
    throw new Error(`Failed after ${MAX_RETRIES} attempts: ${msg}`);
  }
}

// ── parse HTML with cheerio ────────────────────────────────────────
function parseHTML(html, set) {
  const $ = cheerio.load(html);

  // DJs from h1 links only
  const djs = [];
  $('h1 a[href*="/dj/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const slug = (href.match(/\/dj\/([^/]+)\//) || [])[1] || '';
    djs.push({ name: $(el).text().trim(), slug });
  });

  const ICONS = {
    spotify:    'fa-spotify',
    youtube:    'fa-video-camera',
    soundcloud: 'fa-soundcloud',
    appleMusic: 'fa-apple',
  };

  function parseMediaIds(el) {
    const ids = {};
    for (const [platform, cls] of Object.entries(ICONS)) {
      const btn = $(el).find(`.mAction.${cls},.${cls}.mAction`);
      if (!btn.length) continue;
      const onclick = btn.attr('onclick') || '';
      const m = onclick.match(/idItem:\s*(\d+)/);
      if (m) ids[platform] = m[1];
    }
    return Object.keys(ids).length ? ids : null;
  }

  // Parse track rows
  const raw = [];
  $('.tlpItem').each((_, el) => {
    const cls  = $(el).attr('class') || '';
    const full = $(el).find('.trackValue').text().trim();
    if (!full) return;

    const di    = full.indexOf(' - ');
    const rowM  = cls.match(/trRow(\d+)/);
    const type  = cls.includes('tlpSubTog') ? 'sub'
                : cls.includes(' con')      ? 'blend'
                : 'normal';

    raw.push({
      pos:      $(el).find('.fontXL').text().trim(),
      artist:   di > -1 ? full.substring(0, di).trim() : full,
      title:    di > -1 ? full.substring(di + 3).trim() : '',
      remix:    $(el).find('.trackEditData').text().trim(),
      label:    $(el).find('.trackLabel, .iBlock.notranslate').first().text().trim(),
      trackId:  $(el).attr('data-id') || '',
      row:      rowM ? parseInt(rowM[1]) : null,
      type,
      mediaIds: parseMediaIds(el),
    });
  });

  // Filter sub-tracks, group blends onto parent
  const filtered = raw.filter(t => (t.artist || t.title) && t.type !== 'sub');
  const tracks   = [];

  for (const t of filtered) {
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

  return {
    djs: djs.length
      ? djs
      : (set.dj || '').split(/\s*(?:&|x|b2b)\s*/i).map(n => ({
          name: n.trim(),
          slug: n.trim().toLowerCase().replace(/[^a-z0-9]/g, ''),
        })),
    tracks,
  };
}

// ── scrape one set ─────────────────────────────────────────────────
async function scrapeSet(set) {
  const label = `${set.dj} @ ${set.stage} (${set.date})`;

  try {
    log(`→ ${label}`);
    const html = await fetchPage(set.url);

    if (!html || html.length < 500) {
      wrn(`Empty response for ${label}`);
      return { ...set, djs: [], tracks: [], scrapeError: 'empty-response', scrapedAt: new Date().toISOString() };
    }

    const { djs, tracks } = parseHTML(html, set);
    const normal = tracks.filter(t => t.type === 'normal').length;
    const blends = tracks.filter(t => t.type === 'blend').length;
    const isB2B  = djs.length > 1;

    ok(`${normal} tracks, ${blends} blends${isB2B ? ', 🤝 B2B' : ''} — ${label}`);

    return {
      ...set,
      djs,
      tracks,
      scrapedAt: new Date().toISOString(),
    };

  } catch (e) {
    err(`Failed: ${label} — ${e.message}`);
    return null;
  }
}

// ── main ───────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + chalk.bold('🎧  TrackTrackr — ZenRows Scraper'));
  console.log(chalk.gray('══════════════════════════════════\n'));

  if (!ZENROWS_KEY) {
    err('ZENROWS_KEY not set. Run: ZENROWS_KEY=your_key node scraper_zenrows.js');
    process.exit(1);
  }

  // Load index
  if (!fs.existsSync(INDEX_FILE)) {
    err(`Index file not found: ${INDEX_FILE}`);
    process.exit(1);
  }

  const raw  = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  const sets = Array.isArray(raw) ? raw : Object.values(raw.sets || raw);
  log(`Loaded ${sets.length} sets from index`, 'cyan');

  // Skip 2025 + 2026 (already scraped by Puppeteer)
  const SKIP_YEARS = new Set([2025, 2026]);

  // Sort newest first (2024 → 1999), skip already scraped + skipped years
  const sorted    = [...sets]
    .filter(s => !SKIP_YEARS.has(s.year))
    .sort((a,b) => (b.date||'').localeCompare(a.date||''));
  const todo      = sorted.filter(s => !alreadyScraped(s));
  const doneCount = sorted.length - todo.length;

  log(`Skipping years: 2025, 2026 (already scraped)`);
  log(`Already on disk: ${chalk.green(doneCount)} | To scrape: ${chalk.yellow(todo.length)} | Order: newest first (2024 → 1999)`);
  log(`Concurrency: ${CONCURRENCY} | Delay: ${DELAY_MS}ms`);

  if (todo.length === 0) { ok('All done! Nothing to scrape.'); return; }

  const etaMins = Math.round(todo.length * (DELAY_MS + 3000) / CONCURRENCY / 60000);
  log(`ETA: ~${etaMins} min\n`);

  // Progress bar
  let bar = null;
  if (cliProgress) {
    bar = new cliProgress.SingleBar({
      format: '  [{bar}] {percentage}% | {value}/{total} | ETA: {eta}s',
      barCompleteChar: '█', barIncompleteChar: '░', hideCursor: true,
    });
    bar.start(sorted.length, doneCount);
  }

  // Concurrency limiter
  const limit  = pLimit(CONCURRENCY);
  const stats  = { done: 0, failed: 0, skipped: doneCount };

  const tasks = todo.map(set => limit(async () => {
    // Double-check on disk (another worker may have just written it)
    if (alreadyScraped(set)) {
      stats.skipped++;
      if (bar) bar.increment();
      return;
    }

    const result = await scrapeSet(set);
    await sleep(DELAY_MS);

    if (result) {
      const fp = writeSet(result);
      stats.done++;
      log(`💾 ${fp.replace(os.homedir(), '~')}`, 'cyan');
    } else {
      stats.failed++;
      wrn(`Will retry on next run: ${set.dj} ${set.date}`);
    }

    if (bar) bar.increment();

    if ((stats.done + stats.failed) % 50 === 0) {
      prg(`Progress: ${stats.done} done | ${stats.failed} failed | ${stats.skipped} skipped`);
    }
  }));

  await Promise.all(tasks);
  if (bar) bar.stop();

  // Manifest
  const manifest = [];
  for (const year of fs.readdirSync(OUT_BASE).filter(f => /^\d{4}$|^unknown$/.test(f))) {
    for (const file of fs.readdirSync(path.join(OUT_BASE, year)).filter(f => f.endsWith('.json'))) {
      manifest.push(`${year}/${file}`);
    }
  }
  manifest.sort();
  fs.writeFileSync(path.join(OUT_BASE, '_manifest.txt'), manifest.join('\n'));

  console.log('\n' + chalk.gray('══════════════════════════════════'));
  ok('COMPLETE');
  console.log(`  ${chalk.green(`✅ Scraped: ${stats.done}`)}`);
  console.log(`  ${chalk.gray(`⏭️  Skipped: ${stats.skipped}`)}`);
  console.log(`  ${chalk.yellow(`⚠️  Failed:  ${stats.failed}`)}`);
  console.log(`  ${chalk.cyan(`📁 ${OUT_BASE.replace(os.homedir(), '~')}`)}`);
  console.log(`  ${chalk.gray(`📋 Manifest: ${manifest.length} total files`)}`);
}

main().catch(e => {
  err('Fatal: ' + e.message);
  process.exit(1);
});
