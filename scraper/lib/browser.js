const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const CHROME_PATH = process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function launchBrowser() {
  return puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1400,900',
    ],
    defaultViewport: null,
  });
}

async function createPage(browser) {
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );
  await page.setViewport({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
  });

  // Block heavy resources
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (['image', 'font', 'media', 'stylesheet'].includes(req.resourceType())) req.abort();
    else req.continue();
  });

  return page;
}

async function getPageState(page) {
  try {
    return await page.evaluate(() => {
      const text = document.body?.innerText || '';
      const url = window.location.href;
      if (document.querySelectorAll('.tlpItem').length > 0) return 'tracks';
      if (text.includes('Fill out the captcha') ||
          text.includes('Just a moment') ||
          url.includes('challenges.cloudflare') ||
          text.includes('Turnstile')) return 'captcha';
      if (text.includes('Please wait') ||
          text.includes('forwarded to')) return 'forward';
      if (document.querySelector('h1')) return 'loaded';
      return 'unknown';
    });
  } catch { return 'unknown'; }
}

module.exports = { launchBrowser, createPage, getPageState };
