#!/usr/bin/env node
/**
 * scrape_empty.js — Re-scrape the 20 sets that came back empty
 *
 * Uses the same Puppeteer approach as scrape_2026.js but targets
 * specific sets from any year that have empty track arrays.
 *
 * RUN:
 *   cd scraper && node scrape_empty.js
 *   node scrape_empty.js --delay=4000
 */

const puppeteer     = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs            = require('fs');
const path          = require('path');
const os            = require('os');

puppeteer.use(StealthPlugin());

let chalk;
try { chalk = require('chalk'); } catch { chalk = new Proxy({}, { get: (_, k) => k === 'bold' ? new Proxy({}, { get: () => s => s }) : s => s }); }

const ARGS = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
);

const OUT_BASE     = path.join(os.homedir(), 'Downloads', 'umf_miami');
const CHROME_PATH  = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DELAY_MS     = parseInt(ARGS.delay ?? '3000');
const PAGE_TIMEOUT = 30000;

const T     = () => new Date().toISOString().substring(11, 19);
const log   = m => console.log(`[${T()}] ${m}`);
const ok    = m => console.log(chalk.green(`[${T()}] ✅ ${m}`));
const wrn   = m => console.log(chalk.yellow(`[${T()}] ⚠️  ${m}`));
const err   = m => console.log(chalk.red(`[${T()}] ❌ ${m}`));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── The 20 empty sets ────────────────────────────────────────────
const EMPTY_SETS = [
  { tlId: '1p0hf8k', dj: 'Ferry Corsten', stage: 'Unknown Stage', date: '2005-03-26', year: 2005, url: 'https://www.1001tracklists.com/tracklist/1p0hf8k/' },
  { tlId: 'n2yht9', dj: 'ATB', stage: 'Unknown Stage', date: '2011-03-27', year: 2011, url: 'https://www.1001tracklists.com/tracklist/n2yht9/' },
  { tlId: '2tsj2d9', dj: 'Tritonal', stage: 'ASOT 550 Festival', date: '2012-03-25', year: 2012, url: 'https://www.1001tracklists.com/tracklist/2tsj2d9/' },
  { tlId: '1bhp8w1', dj: 'Above & Beyond', stage: 'Mainstage', date: '2013-03-17', year: 2013, url: 'https://www.1001tracklists.com/tracklist/1bhp8w1/' },
  { tlId: '8hyyh7t', dj: 'Armin van Buuren', stage: 'Mainstage', date: '2013-03-17', year: 2013, url: 'https://www.1001tracklists.com/tracklist/8hyyh7t/' },
  { tlId: '43wpsl1', dj: 'Avicii', stage: 'Megastructure', date: '2013-03-17', year: 2013, url: 'https://www.1001tracklists.com/tracklist/43wpsl1/' },
  { tlId: '1jgdhmk', dj: 'Dog Blood', stage: 'Worldwide Stage', date: '2013-03-17', year: 2013, url: 'https://www.1001tracklists.com/tracklist/1jgdhmk/' },
  { tlId: '91v4uw9', dj: 'Prok & Fitch', stage: 'Unknown Stage', date: '2013-03-17', year: 2013, url: 'https://www.1001tracklists.com/tracklist/91v4uw9/' },
  { tlId: '6ubbst9', dj: 'Zedd', stage: 'Mainstage', date: '2013-03-17', year: 2013, url: 'https://www.1001tracklists.com/tracklist/6ubbst9/' },
  { tlId: '6ncz369', dj: 'Armin van Buuren', stage: 'ASOT 600 Festival', date: '2013-03-24', year: 2013, url: 'https://www.1001tracklists.com/tracklist/6ncz369/' },
  { tlId: '5bnuct9', dj: 'Sander van Doorn', stage: 'Mainstage', date: '2013-03-24', year: 2013, url: 'https://www.1001tracklists.com/tracklist/5bnuct9/' },
  { tlId: '4dv3zwt', dj: 'Tritonal', stage: 'ASOT 600 Festival', date: '2013-03-24', year: 2013, url: 'https://www.1001tracklists.com/tracklist/4dv3zwt/' },
  { tlId: '8bnj36k', dj: 'Fedde Le Grand', stage: 'Worldwide Stage', date: '2014-03-30', year: 2014, url: 'https://www.1001tracklists.com/tracklist/8bnj36k/' },
  { tlId: '1kvjfp9', dj: 'Cedric Gervais', stage: 'Worldwide Stage', date: '2015-03-28', year: 2015, url: 'https://www.1001tracklists.com/tracklist/1kvjfp9/' },
  { tlId: '5uyfnw9', dj: 'Eric Prydz', stage: 'ASOT Stage', date: '2015-03-29', year: 2015, url: 'https://www.1001tracklists.com/tracklist/5uyfnw9/' },
  { tlId: '11mxrbz1', dj: 'Laidback Luke', stage: 'Worldwide Stage', date: '2016-03-19', year: 2016, url: 'https://www.1001tracklists.com/tracklist/11mxrbz1/' },
  { tlId: '11nug1f1', dj: 'Bobby Burns', stage: 'UMF Radio Stage', date: '2017-03-26', year: 2017, url: 'https://www.1001tracklists.com/tracklist/11nug1f1/' },
  { tlId: '2gd8ftc1', dj: 'Luigi Madonna', stage: 'Resistance Stage', date: '2018-03-24', year: 2018, url: 'https://www.1001tracklists.com/tracklist/2gd8ftc1/' },
  { tlId: '1025k4r1', dj: 'Kx5', stage: 'Live Stage', date: '2023-03-26', year: 2023, url: 'https://www.1001tracklists.com/tracklist/1025k4r1/' },
  { tlId: '1042vhnk', dj: 'Frank Walker', stage: 'Mainstage', date: '2024-03-23', year: 2024, url: 'https://www.1001tracklists.com/tracklist/1042vhnk/' },
];

function slugify(str) {
  return (str || '').toLowerCase()
    .replace(/\s*[&+]\s*/g, '-and-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

function outPath(set) {
  const date  = (set.date || '2000-01-01').replace(/-/g, '_');
  const dj    = slugify(set.dj);
  const stage = slugify(set.stage || 'unknown-stage');
  const dir   = path.join(OUT_BASE, String(set.year));
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${date}_${dj}_${stage}_UMF_Miami.json`);
}

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

    // Grab tracksIdentified / tracksTotal from the page header
    let tracksIdentified = 0, tracksTotal = 0;
    const idText = document.querySelector('.cValueCnt')?.textContent || '';
    const idMatch = idText.match(/(\d+)\s*\/\s*(\d+)/);
    if (idMatch) {
      tracksIdentified = parseInt(idMatch[1]);
      tracksTotal = parseInt(idMatch[2]);
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

    const stageEl = document.querySelector('.stage a, a[href*="/source/"]');
    const stageName = stageEl?.textContent?.trim() || '';

    // Duration
    const durEl = document.querySelector('.cValue[title*="duration"], .cValue');
    const duration = durEl?.textContent?.trim() || '';

    return { djs, tracks, recordings, tracksIdentified, tracksTotal, stageName, duration };
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
        wrn('  No tracks found on page');
        return 'empty';
      }
    }

    const { djs, tracks, recordings, tracksIdentified, tracksTotal, stageName, duration } = await parsePage(page);

    const djName = djs.length > 0 ? djs.map(d => d.name).join(' & ') : set.dj;
    const stage  = set.stage || stageName || '';

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
      tracksIdentified,
      tracksTotal,
      duration,
      tracks,
      recordings,
      scrapedAt: new Date().toISOString(),
    };

    fs.writeFileSync(outPath(result), JSON.stringify(result, null, 2));
    const normal = tracks.filter(t => t.type === 'normal').length;
    const blend = tracks.filter(t => t.type === 'blend').length;
    ok(`  ${normal} tracks + ${blend} blends, ${recordings.length} recordings`);
    return 'ok';

  } catch (e) {
    err(`  Error: ${e.message}`);
    if (e.message.toLowerCase().includes('timeout')) await sleep(10000);
    return 'fail';
  }
}

async function main() {
  console.log('\n🎧  TrackTrackr — Re-scrape Empty Sets');
  console.log('══════════════════════════════════════\n');

  log(`${EMPTY_SETS.length} sets to re-scrape`);
  console.log('\nSets:');
  EMPTY_SETS.forEach(s => console.log(`  • ${s.dj} — ${s.year} ${s.stage}`));
  console.log('');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--window-size=1400,900'],
    defaultViewport: null,
  });
  ok('Chrome launched');

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 900 });
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (['image', 'font', 'media', 'stylesheet'].includes(req.resourceType())) req.abort();
    else req.continue();
  });

  let scraped = 0, failed = 0, empty = 0;

  for (let i = 0; i < EMPTY_SETS.length; i++) {
    const result = await scrapeSet(page, EMPTY_SETS[i], i, EMPTY_SETS.length);
    if (result === 'ok') scraped++;
    else if (result === 'empty') empty++;
    else failed++;

    if (i < EMPTY_SETS.length - 1) await sleep(DELAY_MS + Math.floor(Math.random() * 600));
  }

  await browser.close();

  console.log(`\n${'═'.repeat(46)}`);
  ok(`Done!  ✅ ${scraped} scraped  ⚠️ ${failed} failed  ⬜ ${empty} still empty`);
  console.log(`\nOutput in ~/Downloads/umf_miami/{year}/`);
  console.log('Run prepare-data.mjs after to integrate.\n');
}

main().catch(e => { err('Fatal: ' + e.message); process.exit(1); });
