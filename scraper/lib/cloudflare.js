const { sleep } = require('./utils');
const { getPageState } = require('./browser');

/**
 * Handle Cloudflare interstitials and captchas.
 *
 * Tier 1: Auto-click "here" link on forwarding page
 * Tier 2: Click Turnstile checkbox via iframe inspection
 * Tier 3: Wait for manual solve (user or Claude computer use)
 */

// Track consecutive CF encounters for pacing
let cfCount = 0;
let lastCfTime = 0;

function recordCfEncounter() {
  const now = Date.now();
  if (now - lastCfTime > 60000) cfCount = 0; // reset after 60s gap
  cfCount++;
  lastCfTime = now;
}

function getCooldownMs() {
  if (cfCount >= 5) return 300000; // 5 min
  if (cfCount >= 3) return 60000;  // 1 min
  return 10000;                     // 10s extra
}

function resetCfCount() {
  cfCount = 0;
}

// Tier 1: Click "here" link on forwarding page
async function handleForwarding(page, log) {
  log.info('  Forwarding page detected — clicking through...');

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      // Try to find and click the "here" link
      const clicked = await page.evaluate(() => {
        // Look for links with "here" text
        const links = Array.from(document.querySelectorAll('a'));
        for (const a of links) {
          const text = a.textContent.trim().toLowerCase();
          if (text === 'here' || text.includes('click here') || text.includes('proceed')) {
            a.click();
            return true;
          }
        }
        // Also try any prominent link/button
        const btn = document.querySelector('a.btn, button, input[type="submit"]');
        if (btn) { btn.click(); return true; }
        return false;
      });

      if (clicked) {
        log.info(`  Clicked forwarding link (attempt ${attempt + 1})`);
      }
    } catch { /* page navigated mid-evaluate, that's fine */ }

    await sleep(2000);
    const state = await getPageState(page);
    if (state === 'tracks' || state === 'loaded') {
      log.ok('  Forwarding resolved');
      return true;
    }
    if (state !== 'forward') {
      return state; // changed to something else (captcha, etc)
    }
  }

  log.warn('  Forwarding not resolved after 5 attempts');
  return false;
}

// Tier 2: Click Turnstile checkbox
async function handleTurnstile(page, log) {
  log.info('  Attempting Turnstile checkbox click...');

  try {
    // Find the Turnstile iframe
    const frames = page.frames();
    for (const frame of frames) {
      const url = frame.url();
      if (url.includes('challenges.cloudflare') || url.includes('turnstile')) {
        try {
          // Try clicking the checkbox inside the iframe
          const checkbox = await frame.$('input[type="checkbox"], .ctp-checkbox-label, #challenge-stage');
          if (checkbox) {
            await checkbox.click();
            log.info('  Clicked Turnstile checkbox');
            await sleep(3000);
            return true;
          }
        } catch { /* frame might be cross-origin */ }
      }
    }
  } catch (e) {
    log.warn(`  Turnstile click failed: ${e.message}`);
  }

  // Fallback: try clicking in the known Turnstile checkbox region
  try {
    const box = await page.evaluate(() => {
      const iframe = document.querySelector('iframe[src*="challenges.cloudflare"], iframe[src*="turnstile"]');
      if (iframe) {
        const rect = iframe.getBoundingClientRect();
        return { x: rect.x + 25, y: rect.y + 25 }; // checkbox is top-left of widget
      }
      return null;
    });

    if (box) {
      await page.mouse.click(box.x, box.y);
      log.info('  Clicked Turnstile iframe region');
      await sleep(3000);
      return true;
    }
  } catch { /* ignore */ }

  return false;
}

// Tier 3: Wait for manual solve or Claude computer use
async function waitForManualSolve(page, log, maxWaitMs = 180000) {
  log.warn('  🤖 Captcha requires manual solve — use Claude computer use or solve in browser');
  log.warn(`  Waiting up to ${maxWaitMs / 1000}s...`);

  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await sleep(3000);
    const state = await getPageState(page);
    if (state === 'tracks' || state === 'loaded') {
      log.ok('  Captcha solved!');
      return true;
    }
    const elapsed = Math.round((Date.now() - start) / 1000);
    if (elapsed > 0 && elapsed % 30 === 0) {
      log.warn(`  Still waiting... (${elapsed}s)`);
    }
  }

  log.err('  Captcha timed out');
  return false;
}

/**
 * Main handler — called after page.goto when state is 'forward' or 'captcha'.
 * Returns final page state or false on failure.
 */
async function handleCloudflare(page, initialState, log) {
  recordCfEncounter();
  let state = initialState;

  // Tier 1: forwarding
  if (state === 'forward') {
    const result = await handleForwarding(page, log);
    if (result === true) return 'resolved';
    if (typeof result === 'string') state = result; // e.g. 'captcha'
    else return false;
  }

  // Tier 2: Turnstile auto-click
  if (state === 'captcha') {
    const clicked = await handleTurnstile(page, log);
    if (clicked) {
      await sleep(2000);
      const newState = await getPageState(page);
      if (newState === 'tracks' || newState === 'loaded') return 'resolved';
    }

    // Tier 3: manual / computer use
    const solved = await waitForManualSolve(page, log);
    if (solved) return 'resolved';
    return false;
  }

  return false;
}

module.exports = { handleCloudflare, getCooldownMs, resetCfCount };
