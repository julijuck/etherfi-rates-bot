const { chromium } = require('playwright');

const MIN_PLAUSIBLE_RATE = 0;
const MAX_PLAUSIBLE_RATE = 50;
const CONTEXT_CHARS = 40;
const MAX_DISTANCE_TO_ANCHOR = 200;

function parsePercent(text) {
  return parseFloat(text.replace(',', '.'));
}

function findAllIndices(haystack, needle) {
  if (needle instanceof RegExp) {
    const re = new RegExp(needle.source, needle.flags.includes('g') ? needle.flags : needle.flags + 'g');
    return [...haystack.matchAll(re)].map((m) => m.index);
  }
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
 * extracts the percentage closest to `nearText` (default "apy") in the
 * visible text. Throws if no plausible/close-enough percentage is found,
 * so a silent breakage (e.g. ether.fi changed their page) surfaces loudly
 * instead of reporting a bogus rate.
 *
 * Logs every candidate percentage with its surrounding text to stderr
 * so a run's logs (e.g. in GitHub Actions) can be used to sanity-check
 * or recalibrate the extraction without needing another live test.
 */
async function scrapeRate(url, { label, nearText = 'apy' } = {}) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Some vault cards render lazily as they scroll into view, so scroll
    // through the page before reading the text to make sure they're all there.
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 1500);
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(1500);

    const bodyText = await page.innerText('body');

    if (process.env.DEBUG_SCRAPE) {
      console.error(`[${label || url}] --- full page text ---`);
      console.error(bodyText);
      console.error(`[${label || url}] --- end page text ---`);
    }

    const percentRegex = /(\d+(?:[.,]\d+)?)\s*%/g;
    const matches = [...bodyText.matchAll(percentRegex)];

    const anchorIndices =
      nearText instanceof RegExp
        ? findAllIndices(bodyText, nearText)
        : findAllIndices(bodyText.toLowerCase(), nearText.toLowerCase());

    const candidates = matches
      .map((m) => {
        const value = parsePercent(m[1]);
        // Only consider anchors that precede the percentage: on ether.fi's
        // pages the label/name always comes before its value ("<name> ...
        // <rate>%APY"), so a forward-only distance avoids accidentally
        // matching the trailing rate of the *previous* card/section.
        const forwardDistances = anchorIndices
          .map((i) => m.index - i)
          .filter((d) => d >= 0);
        const distance = forwardDistances.length === 0 ? null : Math.min(...forwardDistances);
        return {
          value,
          index: m.index,
          distance,
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
      if (a.distance === null && b.distance === null) return 0;
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });

    console.error(`[${label || url}] candidatos detectados (más cercano a "${nearText}" primero):`);
    ranked.slice(0, 5).forEach((c, i) => {
      console.error(
        `  ${i === 0 ? '-> ' : '   '}${c.value}%  (dist.: ${c.distance ?? 'n/a'})  "...${c.snippet}..."`
      );
    });

    const best = ranked[0];
    if (best.distance === null || best.distance > MAX_DISTANCE_TO_ANCHOR) {
      throw new Error(
        `[${label || url}] No se encontró "${nearText}" cerca de ningún porcentaje plausible (dist. mínima: ${best.distance ?? 'n/a'}).`
      );
    }

    return best.value;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeRate };
