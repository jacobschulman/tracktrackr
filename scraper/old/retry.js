/**
 * TrackTrackr — Retry Scraper
 * Reads _retry_queue.json from the same folder as this script.
 * Run: node retry.js
 */

const puppeteer     = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs            = require('fs');
const path          = require('path');
const os            = require('os');

puppeteer.use(StealthPlugin());

let chalk;
try { chalk = require('chalk'); } catch { chalk = new Proxy({}, { get: () => s => s }); }

const QUEUE_FILE  = path.join(__dirname, '_retry_queue.json');
const OUT_BASE    = path.join(os.homedir(), 'Downloads', 'umf_miami');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DELAY_MS    = 3000;
const PAGE_TIMEOUT = 30000;

const T   = () => new Date().toISOString().substring(11,19);
const log = m => console.log(`[${T()}] ${m}`);
const ok  = m => console.log(chalk.green(`[${T()}] ✅ ${m}`));
const wrn = m => console.log(chalk.yellow(`[${T()}] ⚠️  ${m}`));
const err = m => console.log(chalk.red(`[${T()}] ❌ ${m}`));
const sleep = ms => new Promise(r => setTimeout(r, ms));

function slugify(str) {
  return (str||'').toLowerCase().replace(/\s*[&+]\s*/g,'-and-').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').substring(0,50);
}

function outPath(set) {
  const date  = (set.date || `${set.year||'unknown'}-01-01`).replace(/-/g,'_');
  const dj    = slugify(set.dj);
  const stage = slugify(set.stage||'unknown-stage');
  const dir   = path.join(OUT_BASE, String(set.year||'unknown'));
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${date}_${dj}_${stage}_UMF_Miami.json`);
}

async function getState(page) {
  try {
    return await page.evaluate(() => {
      const t = document.body?.innerText||'';
      if (document.querySelectorAll('.tlpItem').length > 0) return 'tracks';
      if (t.includes('captcha')||t.includes('Just a moment')) return 'captcha';
      if (t.includes('Please wait')||t.includes('forwarded')) return 'forward';
      if (document.querySelector('h1')) return 'loaded';
      return 'unknown';
    });
  } catch { return 'unknown'; }
}

async function parsePage(page) {
  return page.evaluate(() => {
    const SOURCE_MAP = {'10':'soundcloud','13':'youtube','18':'youtube','28':'spotify','40':'hearthis','52':'mixcloud'};
    const h1  = document.querySelector('h1');
    const djs = h1 ? Array.from(h1.querySelectorAll('a[href*="/dj/"]')).map(a => ({
      name: a.textContent.trim(),
      slug: (a.getAttribute('href').match(/\/dj\/([^/]+)\//) || [])[1] || ''
    })) : [];

    const recordings = [];
    document.querySelectorAll('[data-idmedia][data-idsource]').forEach(el => {
      const idMedia  = el.getAttribute('data-idmedia');
      const idSource = el.getAttribute('data-idsource');
      const platform = SOURCE_MAP[idSource] || `source_${idSource}`;
      const src      = el.querySelector('iframe')?.getAttribute('src') || '';
      let url = src;
      const sc = src.match(/url=([^&]+)/); if (sc) { try { url = decodeURIComponent(sc[1]); } catch { url = sc[1]; } }
      const yt = src.match(/\/embed\/([a-zA-Z0-9_-]{11})/); if (yt) url = `https://www.youtube.com/watch?v=${yt[1]}`;
      const ht = src.match(/hearthis\.at\/embed\/(\d+)/);   if (ht) url = `https://hearthis.at/${ht[1]}/`;
      if (idMedia && idSource) recordings.push({ platform, idMedia, idSource, url: url||src });
    });

    const raw = Array.from(document.querySelectorAll('.tlpItem')).map(el => {
      const cls  = el.className;
      const full = (el.querySelector('.trackValue')?.textContent||'').trim();
      if (!full) return null;
      const di   = full.indexOf(' - ');
      const rowM = cls.match(/trRow(\d+)/);
      const ICONS = {spotify:'fa-spotify',youtube:'fa-video-camera',soundcloud:'fa-soundcloud',appleMusic:'fa-apple'};
      const ids = {};
      for (const [p,c] of Object.entries(ICONS)) {
        const btn = el.querySelector(`.mAction.${c},.${c}.mAction`);
        if (btn) { const m = (btn.getAttribute('onclick')||'').match(/idItem:\s*(\d+)/); if (m) ids[p]=m[1]; }
      }
      return {
        pos:      (el.querySelector('.fontXL')?.textContent||'').trim(),
        artist:   di>-1 ? full.substring(0,di).trim() : full,
        title:    di>-1 ? full.substring(di+3).trim() : '',
        remix:    (el.querySelector('.trackEditData')?.textContent||'').trim(),
        label:    (el.querySelector('.trackLabel,.iBlock.notranslate')?.textContent||'').trim(),
        trackId:  el.getAttribute('data-id')||'',
        row:      rowM ? parseInt(rowM[1]) : null,
        type:     cls.includes('tlpSubTog') ? 'sub' : cls.includes(' con') ? 'blend' : 'normal',
        mediaIds: Object.keys(ids).length ? ids : null,
      };
    }).filter(t => t && (t.artist||t.title) && t.type !== 'sub');

    const tracks = [];
    for (const t of raw) {
      if (t.type==='normal') { tracks.push({...t, blendGroup:null}); }
      else if (t.type==='blend') {
        const p = tracks[tracks.length-1];
        if (p) {
          if (!p.blendGroup) p.blendGroup=[{artist:p.artist,title:p.title,remix:p.remix,trackId:p.trackId}];
          p.blendGroup.push({artist:t.artist,title:t.title,remix:t.remix,trackId:t.trackId});
          tracks.push({...t});
        }
      }
    }
    return { djs, tracks, recordings };
  });
}

async function main() {
  if (!fs.existsSync(QUEUE_FILE)) { err('_retry_queue.json not found in ' + __dirname); process.exit(1); }

  const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  ok(`Loaded retry queue: ${queue.length} sets`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-blink-features=AutomationControlled','--window-size=1400,900'],
    defaultViewport: null,
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 900 });
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (['image','font','media','stylesheet'].includes(req.resourceType())) req.abort();
    else req.continue();
  });

  let done = 0, failed = 0;

  for (let i = 0; i < queue.length; i++) {
    const set = queue[i];
    log(`[${i+1}/${queue.length}] → ${set.dj} @ ${set.stage} (${set.date})`);

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
        log(chalk.yellow('  🤖 Captcha — solve in browser, waiting up to 3 min...'));
        for (let j = 0; j < 60; j++) {
          await sleep(3000);
          state = await getState(page);
          if (state === 'tracks' || state === 'loaded') { ok('  Captcha solved!'); break; }
          if (j > 0 && j % 10 === 0) wrn(`  Still waiting... (${j*3}s)`);
        }
      }

      if (state !== 'tracks') {
        try { await page.waitForSelector('.tlpItem', { timeout: PAGE_TIMEOUT }); }
        catch { wrn(`  No tracks — storing empty`); }
      }

      const { djs, tracks, recordings } = await parsePage(page);
      const result = {
        ...set,
        djs: djs.length ? djs : set.dj.split(/\s*(?:&|x|b2b)\s*/i).map(n => ({name:n.trim(),slug:n.trim().toLowerCase().replace(/[^a-z0-9]/g,'')})),
        tracks, recordings,
        scrapedAt: new Date().toISOString(),
      };

      fs.writeFileSync(outPath(set), JSON.stringify(result, null, 2));
      done++;
      ok(`  ${tracks.filter(t=>t.type==='normal').length} tracks, ${recordings.length} recordings`);

    } catch (e) {
      failed++;
      err(`  Error: ${e.message}`);
    }

    await sleep(DELAY_MS + Math.floor(Math.random()*500));
  }

  await browser.close();
  ok(`Done! ${done} scraped, ${failed} failed`);
}

main().catch(e => { err('Fatal: ' + e.message); process.exit(1); });
