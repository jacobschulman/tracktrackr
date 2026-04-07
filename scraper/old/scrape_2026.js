#!/usr/bin/env node
/**
 * TrackTrackr — 2026 Final Scrape
 * ─────────────────────────────────────────────────────────────────
 * Two-phase script:
 *   1. Hits 1001TL API to discover any NEW 2026 sets not yet in our index
 *   2. Scrapes all new + empty sets with Puppeteer
 *
 * RUN:
 *   cd scraper && node scrape_2026.js
 *   node scrape_2026.js --skip-discover    (only re-scrape empty/failed sets)
 *   node scrape_2026.js --discover-only    (just update the index, don't scrape)
 *   node scrape_2026.js --delay=4000
 */

const puppeteer     = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs            = require('fs');
const path          = require('path');
const os            = require('os');

puppeteer.use(StealthPlugin());

let chalk;
try { chalk = require('chalk'); } catch { chalk = new Proxy({}, { get: (_, k) => k === 'bold' ? new Proxy({}, { get: () => s => s }) : s => s }); }

// ── CLI args ──────────────────────────────────────────────────────
const ARGS = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
);

const INDEX_FILE   = path.join(__dirname, 'tracklore_2026_sets.json');
const OUT_BASE     = path.join(os.homedir(), 'Downloads', 'umf_miami');
const CHROME_PATH  = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DELAY_MS     = parseInt(ARGS.delay ?? '3000');
const PAGE_TIMEOUT = 30000;
const SOURCE       = 'u8bf5c'; // 1001TL source ID for UMF Miami

// ── helpers ───────────────────────────────────────────────────────
const T     = () => new Date().toISOString().substring(11, 19);
const log   = m => console.log(`[${T()}] ${m}`);
const ok    = m => console.log(chalk.green(`[${T()}] ✅ ${m}`));
const wrn   = m => console.log(chalk.yellow(`[${T()}] ⚠️  ${m}`));
const err   = m => console.log(chalk.red(`[${T()}] ❌ ${m}`));
const sleep = ms => new Promise(r => setTimeout(r, ms));

function slugify(str) {
  return (str || '').toLowerCase()
    .replace(/\s*[&+]\s*/g, '-and-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

function outPath(set) {
  const date  = (set.date || '2026-01-01').replace(/-/g, '_');
  const dj    = slugify(set.dj);
  const stage = slugify(set.stage || 'unknown-stage');
  const dir   = path.join(OUT_BASE, '2026');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${date}_${dj}_${stage}_UMF_Miami.json`);
}

function alreadyScraped(set) {
  const fp = outPath(set);
  if (!fs.existsSync(fp)) return false;
  try {
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    return data.tracks && data.tracks.length > 0;
  } catch { return false; }
}

// Also check the project's data/ultra-miami/sets/{tlId}.json (where prepare-data puts them)
const PROJECT_SETS = path.resolve(__dirname, '..', 'data', 'ultra-miami', 'sets');

function hasScrapedData(set) {
  // Check project data dir (tlId-based files from prepare-data)
  const projectFile = path.join(PROJECT_SETS, `${set.tlId}.json`);
  if (fs.existsSync(projectFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
      if (data.tracks && data.tracks.length > 0) return true;
    } catch {}
  }
  // Check Downloads dir (filename-based files from scraper)
  const dlFile = outPath(set);
  if (fs.existsSync(dlFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(dlFile, 'utf8'));
      if (data.tracks && data.tracks.length > 0) return true;
    } catch {}
  }
  return false;
}

function needsRescrape(set) {
  return !hasScrapedData(set);
}

// ══════════════════════════════════════════════════════════════════
// PHASE 1: Discover new sets via Puppeteer (manual scroll)
// ══════════════════════════════════════════════════════════════════

async function discoverNewSets(existingSets, browser) {
  log('Phase 1: Opening 1001TL UMF overview — scroll down to load all 2026 sets');
  log('Press ENTER in this terminal when you\'re done scrolling.\n');

  const existingIds = new Set(existingSets.map(s => s.tlId));

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`https://www.1001tracklists.com/source/${SOURCE}/ultra-music-festival-miami/index.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });

  // Wait for user to scroll and press ENTER
  await new Promise(resolve => {
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.pause();
      resolve();
    });
  });

  log('Parsing page for 2026 tracklist links...');

  // Extract all tracklist links from the loaded page
  const found = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/tracklist/"]'));
    const seen = new Set();
    return links
      .map(a => {
        const href = a.getAttribute('href');
        const m = href.match(/\/tracklist\/([^/]+)\//);
        if (!m) return null;
        const tlId = m[1];
        if (seen.has(tlId)) return null;
        seen.add(tlId);
        const dateMatch = href.match(/(\d{4}-\d{2}-\d{2})/);
        const date = dateMatch ? dateMatch[1] : null;
        return { tlId, href, date };
      })
      .filter(x => x && x.date && x.date.startsWith('2026'));
  });

  await page.close();

  const newSets = [];
  for (const { tlId, href, date } of found) {
    if (existingIds.has(tlId)) continue;
    existingIds.add(tlId);

    const slug = href.match(/\/tracklist\/[^/]+\/([^/]+)/)?.[1] || '';
    const cleanSlug = slug
      .replace(/-ultra-music-festival-miami.*$/, '')
      .replace(/-united-states.*$/, '')
      .replace(/\.html$/, '');

    newSets.push({
      tlId,
      dj:    cleanSlug,
      stage: '',
      date,
      year:  2026,
      url:   'https://www.1001tracklists.com' + href,
    });
    log(`  NEW: ${tlId} — ${cleanSlug} (${date})`);
  }

  log(`Found ${found.length} total 2026 links, ${newSets.length} new`);
  return newSets;
}

// ══════════════════════════════════════════════════════════════════
// PHASE 2: Puppeteer scrape
// ══════════════════════════════════════════════════════════════════

async function getState(page) {
  try {
    return await page.evaluate(() => {
      const t = document.body?.innerText || '';
      if (document.querySelectorAll('.tlpItem').length > 0) return 'tracks';
      if (t.includes('captcha') || t.includes('Just a moment')) return 'captcha';
      if (t.includes('Please wait') || t.includes('forwarded')) return 'forward';
      if (document.querySelector('h1')) return 'loaded';
      return 'unknown';
    });
  } catch { return 'unknown'; }
}

async function parsePage(page) {
  return page.evaluate(() => {
    const SOURCE_MAP = { '10': 'soundcloud', '13': 'youtube', '18': 'youtube', '28': 'spotify', '40': 'hearthis', '52': 'mixcloud' };

    const h1  = document.querySelector('h1');
    const djs = h1
      ? Array.from(h1.querySelectorAll('a[href*="/dj/"]')).map(a => ({
          name: a.textContent.trim(),
          slug: (a.getAttribute('href').match(/\/dj\/([^/]+)\//) || [])[1] || ''
        }))
      : [];

    const recordings = [];
    document.querySelectorAll('[data-idmedia][data-idsource]').forEach(el => {
      const idMedia  = el.getAttribute('data-idmedia');
      const idSource = el.getAttribute('data-idsource');
      const platform = SOURCE_MAP[idSource] || `source_${idSource}`;
      const src      = el.querySelector('iframe')?.getAttribute('src') || '';
      let url = src;
      const sc = src.match(/url=([^&]+)/); if (sc) try { url = decodeURIComponent(sc[1]); } catch { url = sc[1]; }
      const yt = src.match(/\/embed\/([a-zA-Z0-9_-]{11})/); if (yt) url = `https://www.youtube.com/watch?v=${yt[1]}`;
      const mc = src.match(/mixcloud\.com%2F([^%&"]+)/i); if (mc) url = `https://www.mixcloud.com/${decodeURIComponent(mc[1])}`;
      const ht = src.match(/hearthis\.at\/embed\/(\d+)/); if (ht) url = `https://hearthis.at/${ht[1]}/`;
      if (idMedia && idSource) recordings.push({ platform, idMedia, idSource, url: url || src });
    });

    function parseMediaIds(el) {
      const ICONS = { spotify: 'fa-spotify', youtube: 'fa-video-camera', soundcloud: 'fa-soundcloud', appleMusic: 'fa-apple' };
      const ids = {};
      for (const [p, cls] of Object.entries(ICONS)) {
        const btn = el.querySelector(`.mAction.${cls},.${cls}.mAction`);
        if (!btn) continue;
        const m = (btn.getAttribute('onclick') || '').match(/idItem:\s*(\d+)/);
        if (m) ids[p] = m[1];
      }
      return Object.keys(ids).length ? ids : null;
    }

    const raw = Array.from(document.querySelectorAll('.tlpItem')).map(el => {
      const cls  = el.className;
      const full = (el.querySelector('.trackValue')?.textContent || '').trim();
      if (!full) return null;
      const di   = full.indexOf(' - ');
      const rowM = cls.match(/trRow(\d+)/);
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

    const tracks = [];
    for (const t of raw) {
      if (t.type === 'normal') {
        tracks.push({ ...t, blendGroup: null });
      } else if (t.type === 'blend') {
        const parent = tracks[tracks.length - 1];
        if (parent) {
          if (!parent.blendGroup) parent.blendGroup = [
            { artist: parent.artist, title: parent.title, remix: parent.remix, trackId: parent.trackId }
          ];
          parent.blendGroup.push({ artist: t.artist, title: t.title, remix: t.remix, trackId: t.trackId });
          tracks.push({ ...t });
        }
      }
    }

    // Also grab DJ name and stage from the page header for newly discovered sets
    const title = document.querySelector('h1')?.textContent?.trim() || '';
    const stageEl = document.querySelector('.stage a, a[href*="/source/"]');
    const stageName = stageEl?.textContent?.trim() || '';

    return { djs, tracks, recordings, pageTitle: title, pageStageName: stageName };
  });
}

async function scrapeSet(page, set, idx, total) {
  const label = `[${idx + 1}/${total}] ${set.dj} @ ${set.stage || '?'} (${set.date})`;
  log(`→ ${label}`);

  try {
    await page.goto(set.url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });
    await sleep(1500);

    let state = await getState(page);

    if (state === 'forward') {
      log('  Forwarding — waiting 6s...');
      await sleep(6000);
      state = await getState(page);
    }

    if (state === 'captcha') {
      wrn('  🤖 Captcha — solve in browser window, waiting up to 3 min...');
      for (let j = 0; j < 60; j++) {
        await sleep(3000);
        state = await getState(page);
        if (state === 'tracks' || state === 'loaded') { ok('  Captcha solved!'); break; }
        if (j > 0 && j % 10 === 0) wrn(`  Still waiting... (${j * 3}s)`);
      }
    }

    if (state !== 'tracks') {
      try { await page.waitForSelector('.tlpItem', { timeout: PAGE_TIMEOUT }); }
      catch {
        wrn('  No tracks found — storing empty');
        const empty = { ...set, djs: [], tracks: [], recordings: [], scrapedAt: new Date().toISOString() };
        fs.writeFileSync(outPath(set), JSON.stringify(empty, null, 2));
        return 'empty';
      }
    }

    const { djs, tracks, recordings, pageTitle, pageStageName } = await parsePage(page);

    // For newly discovered sets, fill in DJ name from page
    const djName = djs.length > 0 ? djs.map(d => d.name).join(' & ') : set.dj;
    const stage  = set.stage || pageStageName || '';

    const result = {
      ...set,
      dj:    djName,
      stage: stage,
      djs:   djs.length
        ? djs
        : djName.split(/\s*(?:&|x|b2b)\s*/i).map(n => ({
            name: n.trim(),
            slug: n.trim().toLowerCase().replace(/[^a-z0-9]/g, ''),
          })),
      tracks,
      recordings,
      scrapedAt: new Date().toISOString(),
    };

    fs.writeFileSync(outPath(result), JSON.stringify(result, null, 2));
    const normal = tracks.filter(t => t.type === 'normal').length;
    ok(`  ${normal} tracks, ${recordings.length} recordings`);
    return 'ok';

  } catch (e) {
    err(`  Error: ${e.message}`);
    if (e.message.toLowerCase().includes('timeout')) await sleep(10000);
    return 'fail';
  }
}

// ── main ──────────────────────────────────────────────────────────
async function main() {
  console.log('\n🎧  TrackTrackr — Ultra Miami 2026 Final Scrape');
  console.log('══════════════════════════════════════════════\n');

  // Load existing 2026 index
  let sets = [];
  if (fs.existsSync(INDEX_FILE)) {
    sets = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    log(`Loaded ${sets.length} existing 2026 sets from index`);
  }

  // Launch browser (shared for discover + scrape)
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--window-size=1400,900'],
    defaultViewport: null,
  });
  ok('Chrome launched');

  // ── Phase 1: Discover ──────────────────────────────────────────
  if (ARGS['skip-discover'] !== true) {
    const newSets = await discoverNewSets(sets, browser);
    if (newSets.length > 0) {
      sets = [...sets, ...newSets];
      fs.writeFileSync(INDEX_FILE, JSON.stringify(sets, null, 2));
      ok(`Added ${newSets.length} new sets → index now has ${sets.length} sets`);
    } else {
      ok('No new sets found on 1001TL');
    }
  }

  if (ARGS['discover-only'] === true) {
    await browser.close();
    ok('Discover-only mode — done!');
    return;
  }

  // ── Phase 2: Scrape ────────────────────────────────────────────
  const todo = sets.filter(s => needsRescrape(s));
  const doneCount = sets.length - todo.length;

  log(`Already scraped: ${doneCount} | Need scraping: ${todo.length}`);

  if (todo.length === 0) {
    await browser.close();
    ok(`All ${sets.length} 2026 sets are fully scraped!`);
    return;
  }

  console.log('\nSets to scrape:');
  todo.forEach(s => console.log(`  • ${s.dj} @ ${s.stage || '?'} (${s.date})`));
  console.log('');

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 900 });
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (['image', 'font', 'media', 'stylesheet'].includes(req.resourceType())) req.abort();
    else req.continue();
  });

  let scraped = 0, failed = 0;

  for (let i = 0; i < todo.length; i++) {
    const result = await scrapeSet(page, todo[i], i, todo.length);
    if (result === 'ok' || result === 'empty') scraped++;
    else failed++;

    if (i < todo.length - 1) await sleep(DELAY_MS + Math.floor(Math.random() * 600));
  }

  await browser.close();

  console.log(`\n${'═'.repeat(46)}`);
  ok(`Done!  ✅ ${scraped} scraped  ⚠️ ${failed} failed  (of ${todo.length})`);
  console.log(`📁 ~/Downloads/umf_miami/2026/\n`);
}

main().catch(e => { err('Fatal: ' + e.message); process.exit(1); });
