const { chromium } = require('playwright');

let browserInstance = null;

async function getChartBrowser() {
  if (browserInstance) return browserInstance;

  browserInstance = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  return browserInstance;
}

/**
 * Captures a PNG of the DexScreener Solana token page (chart area when possible).
 * Returns null on failure (network, timeout, missing page).
 */
async function captureDexScreenerChartPng(contractAddress) {
  const ca = String(contractAddress || '').trim();
  if (!ca) return null;

  let page;
  try {
    const browser = await getChartBrowser();
    page = await browser.newPage({
      viewport: { width: 1280, height: 720 }
    });

    const url = `https://dexscreener.com/solana/${ca}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4500);

    const canvas = await page.$('canvas');
    if (canvas) {
      const buf = await canvas.screenshot({ type: 'png' });
      await page.close();
      return buf;
    }

    const buf = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 72, width: 1280, height: 560 }
    });
    await page.close();
    return buf;
  } catch (err) {
    console.error('[ChartScreenshot]', err.message);
    try {
      if (page) await page.close();
    } catch (_) {
      /* ignore */
    }
    return null;
  }
}

module.exports = { captureDexScreenerChartPng };
