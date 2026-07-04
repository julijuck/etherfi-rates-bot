const { chromium } = require('playwright');

const MIN_PLAUSIBLE_RATE = 0;
const MAX_PLAUSIBLE_RATE = 50;
const CONTEXT_CHARS = 40;

function parsePercent(text) {
  return parseFloat(text.replace(',', '.'));
}

function findAllIndices(haystack, needle) {
  const indices = [];
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    indices.push(idx);
    idx = haystack.indexOf(needle, idx + 1);
  }
  return indices;
}

function snippetAround(text, index, matchLength) {
  const start = Math.max(0, index - CONTEXT_CHARS);
  const end = Math.min(text.length, index + matchLength + CONTEXT_CHARS);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

/**
 * Opens `url` in headless Chromium, waits for the page to render, and
 * extracts the APY/rate percentage closest to the word "APY" in the
 * visible text. Throws if no plausible percentage is found, so a
 * silent breakage (e.g. ether.fi changed their page) surfaces loudly
 * instead of reporting a bogus rate.
 *
 * Logs every candidate percentage with its surrounding text to stderr
 * so a run's logs (e.g. in GitHub Actions) can be used to sanity-check
 * or recalibrate the extraction without needing another live test.
 */
async function scrapeRate(url, { label } = {}) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    const bodyText = await page.innerText('body');

    if (process.env.DEBUG_SCRAPE) {
      console.error(`[${label || url}] --- full page text ---`);
      console.error(bodyText);
      console.error(`[${label || url}] --- end page text ---`);
    }

    const percentRegex = /(\d+(?:[.,]\d+)?)\s*%/g;
    const matches = [...bodyText.matchAll(percentRegex)];

    const apyIndices = findAllIndices(bodyText.toLowerCase(), 'apy');

    const candidates = matches
      .map((m) => {
        const value = parsePercent(m[1]);
        const distanceToApy =
          apyIndices.length === 0
            ? null
            : Math.min(...apyIndices.map((i) => Math.abs(i - m.index)));
        return {
          value,
          index: m.index,
          distanceToApy,
          snippet: snippetAround(bodyText, m.index, m[0].length),
        };
      })
      .filter(
        (c) =>
          !Number.isNaN(c.value) &&
          c.value >= MIN_PLAUSIBLE_RATE &&
          c.value <= MAX_PLAUSIBLE_RATE
      );

    if (candidates.length === 0) {
      console.error(`[${label || url}] --- page text (no candidates found) ---`);
      console.error(bodyText.slice(0, 3000));
      console.error(`[${label || url}] --- end page text ---`);
      throw new Error(
        `[${label || url}] No se encontró ningún porcentaje plausible en la página.`
      );
    }

    const ranked = [...candidates].sort((a, b) => {
      if (a.distanceToApy === null && b.distanceToApy === null) return 0;
      if (a.distanceToApy === null) return 1;
      if (b.distanceToApy === null) return -1;
      return a.distanceToApy - b.distanceToApy;
    });

    console.error(`[${label || url}] candidatos detectados (más cercano a "APY" primero):`);
    ranked.slice(0, 5).forEach((c, i) => {
      console.error(
        `  ${i === 0 ? '-> ' : '   '}${c.value}%  (dist. a "APY": ${c.distanceToApy ?? 'n/a'})  "...${c.snippet}..."`
      );
    });

    return ranked[0].value;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeRate };
