const fs = require('fs');
const path = require('path');
const os = require('os');
const { launchBrowser, createPage, getPageState } = require('../lib/browser');
const { handleCloudflare } = require('../lib/cloudflare');
const { sleep } = require('../lib/utils');
const { createLogger, chalk } = require('../lib/logger');

const log = createLogger('DISCOVER', 'magenta');

/**
 * Parse tracklist links from the current page DOM.
 * Returns array of { tlId, dj, stage, date, year, url }
 */
async function parseSetLinks(page) {
  return page.evaluate(() => {
    const items = [];
    const seen = new Set();
    const links = document.querySelectorAll('a[href*="/tracklist/"]');

    for (const a of links) {
      const href = a.getAttribute('href');
      if (!href || !href.includes('/tracklist/')) continue;

      const idMatch = href.match(/\/tracklist\/([^/]+)\//);
      if (!idMatch) continue;
      const tlId = idMatch[1];
      if (seen.has(tlId)) continue;
      seen.add(tlId);

      const dateMatch = href.match(/(\d{4}-\d{2}-\d{2})\.html/);
      const date = dateMatch ? dateMatch[1] : null;
      const year = date ? parseInt(date.substring(0, 4)) : null;

      const slugMatch = href.match(/\/tracklist\/[^/]+\/([^/]+)\.html/);
      const slug = slugMatch ? slugMatch[1] : '';
      // Strip festival suffix from slug to get clean DJ name
      const cleanSlug = slug
        .replace(/-electric-daisy-carnival.*$/i, '')
        .replace(/-edc.*$/i, '')
        .replace(/-ultra-music-festival.*$/i, '')
        .replace(/-tomorrowland.*$/i, '')
        .replace(/-united-states.*$/i, '')
        .replace(/-las-vegas.*$/i, '');

      const fullUrl = href.startsWith('http')
        ? href
        : 'https://www.1001tracklists.com' + href;

      items.push({ tlId, dj: cleanSlug, stage: '', date, year, url: fullUrl });
    }

    return items;
  });
}

async function run(config, args) {
  console.log('\n' + chalk.bold(`🔍  TrackTrackr — Discover New Sets (${config.displayName})`));
  console.log(chalk.gray('══════════════════════════════════════\n'));

  // Load existing index
  const indexPath = args.index
    ? path.resolve(args.index)
    : path.join(__dirname, '..', config.indexFile);

  let existing = [];
  if (fs.existsSync(indexPath)) {
    const raw = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    existing = Array.isArray(raw) ? raw : Object.values(raw.sets || raw);
    log.ok(`Existing index: ${existing.length} sets`);
  } else {
    log.warn(`No existing index at ${indexPath} — starting fresh`);
  }

  const existingIds = new Set(existing.map(s => s.tlId));

  // Launch browser and navigate to source page
  log.info('Launching Chrome...');
  const browser = await launchBrowser();
  const page = await createPage(browser);

  const sourceUrl = `${config.baseUrl || 'https://www.1001tracklists.com'}/source/${config.sourceId}/index.html`;
  log.info(`Loading: ${sourceUrl}`);

  try {
    await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);

    // Handle Cloudflare — wait patiently for manual solve if needed
    let state = await getPageState(page);
    log.info(`Page state: ${state}`);

    if (state === 'forward' || state === 'captcha' || state === 'unknown') {
      log.warn('Cloudflare challenge detected — solve it in the browser window if needed');
      // First try auto-handling
      const result = await handleCloudflare(page, state, log);
      state = await getPageState(page);

      // If still not through, wait for manual solve (up to 3 min)
      if (state !== 'loaded' && state !== 'tracks') {
        log.info('Waiting for page to load (solve Cloudflare in browser if stuck)...');
        const start = Date.now();
        while (Date.now() - start < 180000) {
          await sleep(3000);
          state = await getPageState(page);
          if (state === 'loaded' || state === 'tracks') break;
          // Check if the URL changed (redirect after CF solve)
          const url = await page.url();
          if (url.includes('/source/')) {
            try {
              await page.waitForSelector('a[href*="/tracklist/"]', { timeout: 5000 });
              state = 'loaded';
              break;
            } catch { /* keep waiting */ }
          }
        }
        if (state !== 'loaded' && state !== 'tracks') {
          log.err('Could not get past Cloudflare after 3 minutes. Try again.');
          await browser.close();
          return;
        }
      }

      log.ok('Cloudflare resolved');

      // After CF, we might need to re-navigate
      const currentUrl = await page.url();
      if (!currentUrl.includes(config.sourceId)) {
        log.info('Re-navigating to source page...');
        await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await sleep(3000);
      }
    }

    // Wait for content
    try {
      await page.waitForSelector('a[href*="/tracklist/"]', { timeout: 15000 });
    } catch {
      log.warn('No tracklist links found yet — waiting a bit longer...');
      await sleep(10000);
    }

    // Let the user scroll to lazy-load all sets
    const initialItems = await parseSetLinks(page);
    log.ok(`Page loaded with ${initialItems.length} tracklist links`);
    log.info('');
    log.info(chalk.yellow('👉  Scroll down in the browser to lazy-load all sets.'));
    log.info(chalk.yellow('    When you\'re done scrolling, press ENTER here to capture.'));
    log.info('');

    // Wait for Enter keypress
    await new Promise(resolve => {
      process.stdin.setRawMode?.(false);
      process.stdin.resume();
      process.stdin.once('data', () => resolve());
    });

    // Capture all links from the fully-scrolled page
    const allPageItems = await parseSetLinks(page);
    log.ok(`Captured ${allPageItems.length} total tracklist links from page`);

    // Filter to new sets only
    const allItems = [];
    for (const item of allPageItems) {
      if (args.year && String(item.year) !== String(args.year)) continue;
      if (!existingIds.has(item.tlId)) {
        allItems.push(item);
      }
    }

    if (allItems.length === 0) {
      log.ok(`No new sets found — index is up to date (${existing.length} sets)`);
      await browser.close();
      return;
    }

    log.ok(`Found ${allItems.length} new sets (${allPageItems.length - allItems.length} already in index)`);
    for (const item of allItems) {
      log.info(`  NEW: ${item.tlId} — ${item.dj} (${item.date || 'no date'})`);
    }

    if (args['dry-run']) {
      log.info('Dry run — not writing index');
      await browser.close();
      return;
    }

    // Merge and save
    const merged = [...allItems, ...existing];
    const outFile = indexPath.endsWith('.json') ? indexPath : indexPath + '.json';
    fs.writeFileSync(outFile, JSON.stringify(merged, null, 2));
    log.ok(`Saved index: ${outFile.replace(os.homedir(), '~')} (${merged.length} sets)`);

  } catch (e) {
    log.err(`Fatal: ${e.message}`);
    if (process.env.DEBUG) console.error(e.stack);
  } finally {
    await browser.close();
  }
}

module.exports = { run };
