/**
 * TrackTrackr — Index Updater
 * ─────────────────────────────────────────────────────────────────
 * Fetches the latest sets from the 1001TL Ultra Miami overview,
 * merges any new ones into the existing index file, and saves it.
 *
 * RUN:
 *   node update_index.js
 * ─────────────────────────────────────────────────────────────────
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');

const INDEX_FILE = path.join(os.homedir(), 'Downloads', 'tracklore_index_complete_1467sets.json');
const SOURCE     = 'u8bf5c';

let chalk;
try { chalk = require('chalk'); } catch { chalk = new Proxy({}, { get: () => s => s }); }

const T   = () => new Date().toISOString().substring(11,19);
const log = m => console.log(`[${T()}] ${m}`);
const ok  = m => console.log(chalk.green(`[${T()}] ✅ ${m}`));
const err = m => console.log(chalk.red(`[${T()}] ❌ ${m}`));

const sleep = ms => new Promise(r => setTimeout(r, ms));

// POST to 1001TL's ajax endpoint
function postAjax(params) {
  return new Promise((resolve, reject) => {
    const body = Object.entries(params)
      .map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    const options = {
      hostname: 'www.1001tracklists.com',
      path:     '/ajax/get_data.php',
      method:   'POST',
      headers: {
        'Content-Type':  'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent':    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer':       `https://www.1001tracklists.com/source/${SOURCE}/ultra-music-festival-miami/index.html`,
        'Origin':        'https://www.1001tracklists.com',
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid JSON: ' + data.substring(0,100))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Parse set items from HTML batch
function parseBatch(html) {
  // Simple regex-based extraction (no DOM in Node)
  const items = [];
  let lastId = null;

  // Match each bItm block
  const hrefRe  = /href="(\/tracklist\/([^/]+)\/[^"]+)"/g;
  const titleRe  = /class="[^"]*bTitle[^"]*"[^>]*>.*?href="[^"]*">([^<]+)<\/a>/gs;
  const dateRe   = /fa-calendar[^<]*<\/i>([0-9-]+)/g;
  const viewRe   = /data-count="(\d+)"/g;
  const dataIdRe = /data-id="([^"]+)"/g;

  // Extract all data-ids (for cursor tracking)
  let m;
  const dataIds = [];
  while ((m = dataIdRe.exec(html)) !== null) dataIds.push(m[1]);
  lastId = dataIds[dataIds.length - 1] || null;

  // Extract tracklist hrefs
  const hrefs = [];
  while ((m = hrefRe.exec(html)) !== null) {
    if (m[1].includes('/tracklist/')) hrefs.push({ href: m[1], tlId: m[2] });
  }

  // Dedupe by tlId
  const seen = new Set();
  for (const { href, tlId } of hrefs) {
    if (seen.has(tlId)) continue;
    seen.add(tlId);

    // Extract date from URL
    const dateMatch = href.match(/(\d{4}-\d{2}-\d{2})\.html/);
    const date = dateMatch ? dateMatch[1] : null;
    const year = date ? parseInt(date.substring(0, 4)) : null;

    // Extract DJ + stage from URL slug
    // e.g. /tracklist/xxx/eric-prydz-resistance-megastructure-ultra-music-festival-miami-...
    const slugMatch = href.match(/\/tracklist\/[^/]+\/([^/]+)\.html/);
    const slug = slugMatch ? slugMatch[1] : '';
    const cleanSlug = slug
      .replace(/-ultra-music-festival-miami.*$/, '')
      .replace(/-united-states.*$/, '');

    items.push({
      tlId,
      dj:    cleanSlug, // rough — will be overwritten when set page is scraped
      stage: '',
      date,
      year,
      url:   'https://www.1001tracklists.com' + href,
    });
  }

  return { items, lastId, count: dataIds.length };
}

async function main() {
  console.log('\n' + chalk.bold('🔄  TrackTrackr — Index Updater'));
  console.log(chalk.gray('══════════════════════════════════\n'));

  // Load existing index
  if (!fs.existsSync(INDEX_FILE)) {
    err(`Index file not found: ${INDEX_FILE}`);
    process.exit(1);
  }

  const raw      = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  const existing = Array.isArray(raw) ? raw : Object.values(raw.sets || raw);
  const existingIds = new Set(existing.map(s => s.tlId));
  log(`Existing index: ${existing.length} sets`);

  // Paginate the overview to find new sets
  const newSets = [];
  let lastId    = null;
  let pos       = 0;
  let page      = 0;
  let done      = false;

  log('Fetching overview pages...');

  while (!done && page < 20) { // check first ~300 sets (covers any new additions)
    page++;
    await sleep(1000);

    let resp;
    try {
      const params = {
        type:   'overview',
        source: SOURCE,
        pos:    String(pos),
        width:  '1200',
      };
      // Only include id cursor after first page
      if (lastId) params.id = lastId;

      resp = await postAjax(params);
    } catch (e) {
      err(`Page ${page} failed: ${e.message}`);
      break;
    }

    if (!resp.success || !resp.data) {
      err(`Page ${page}: API failure — ${resp.message || 'unknown'}`);
      break;
    }

    const { items, lastId: newLastId, count } = parseBatch(resp.data);

    let addedThisPage = 0;
    for (const item of items) {
      if (!existingIds.has(item.tlId)) {
        existingIds.add(item.tlId);
        newSets.push(item);
        addedThisPage++;
        log(`  NEW: ${item.tlId} — ${item.url.split('/').pop()}`);
      }
    }

    log(`Page ${page}: ${items.length} items, ${addedThisPage} new | pos: ${pos}`);

    pos    += count;
    lastId  = newLastId || lastId;
    done    = resp.end === true || count === 0 || addedThisPage === 0;
  }

  if (newSets.length === 0) {
    ok(`No new sets found — index is up to date (${existing.length} sets)`);
    return;
  }

  // Merge new sets into existing index
  const merged = [...newSets, ...existing]; // new sets first (newest first order)
  ok(`Found ${newSets.length} new sets — merging into index`);

  // Save updated index
  const outFile = INDEX_FILE.replace('.json', `_updated_${new Date().toISOString().substring(0,10)}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ sets: Object.fromEntries(merged.map(s => [s.tlId, s])) }, null, 2));
  ok(`Saved updated index: ${outFile.replace(os.homedir(), '~')} (${merged.length} sets)`);
  log(`New sets to scrape: ${newSets.map(s => s.tlId).join(', ')}`);
}

main().catch(e => { err('Fatal: ' + e.message); process.exit(1); });
