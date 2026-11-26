const { chromium } = require('playwright');
const { EARN_URL, MARKETS_OVERVIEW_PATH, EARN_VAULTS } = require('./rateSources');

const MIN_PLAUSIBLE_RATE = 0;
const MAX_PLAUSIBLE_RATE = 50;

/**
 * Picks the configured vaults out of the markets/overview payload and
 * validates them. Exported separately so it can be tested without a browser.
 * Throws if any vault is missing, doesn't look like the expected card, isn't
 * live, or has an implausible APY.
 */
function extractEarnRates(payload, vaults = EARN_VAULTS) {
  const liquid = payload && payload.data && payload.data.liquid;
  if (!Array.isArray(liquid)) {
    throw new Error('La respuesta de markets/overview no trae la lista "liquid" de vaults.');
  }

  const rates = {};
  const problems = [];
  for (const v of vaults) {
    const entry = liquid.find((e) => e.vaultId === v.vaultId);
    if (!entry) {
      problems.push(`${v.name}: no aparece el vault "${v.vaultId}" (¿geo-restringido o renombrado?)`);
      continue;
    }
    if (entry.label !== v.label || (entry.subLabel || null) !== v.subLabel) {
      problems.push(
        `${v.name}: el vault "${v.vaultId}" ahora se llama "${[entry.label, entry.subLabel].filter(Boolean).join(' ')}"`
      );
      continue;
    }
    if (entry.status !== 'live') {
      problems.push(`${v.name}: estado "${entry.status}" (no está live)`);
      continue;
    }
    const apy = typeof entry.apy === 'number' ? entry.apy : NaN;
    if (!Number.isFinite(apy) || apy < MIN_PLAUSIBLE_RATE || apy > MAX_PLAUSIBLE_RATE) {
      problems.push(`${v.name}: APY no plausible (${entry.apy})`);
      continue;
    }
    // Round to 2 decimals, same precision the app shows on the card.
    rates[v.key] = Math.round(apy * 100) / 100;
  }

  if (problems.length > 0) {
    throw new Error(problems.join(' | '));
  }
  return rates;
}

/**
 * Loads the public /cash/earn page in headless Chromium and reads the APY of
 * every vault in EARN_VAULTS from the markets/overview JSON the page fetches
 * for itself. Going through the page (instead of calling the endpoint
 * directly) keeps whatever country/region and headers the app decides to
 * send, so we see exactly the vaults and rates the user sees from this IP.
 *
 * Returns e.g. { usd: 4.89, bold: 7.89, rwa: 5.86 }.
 */
async function fetchEarnRates({ label = 'earn' } = {}) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    });

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes(MARKETS_OVERVIEW_PATH) && res.request().method() === 'GET',
      { timeout: 90000 }
    );
    await page.goto(EARN_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    const response = await responsePromise;

    if (!response.ok()) {
      throw new Error(`[${label}] markets/overview respondió HTTP ${response.status()}`);
    }
    const payload = await response.json();

    if (process.env.DEBUG_SCRAPE) {
      console.error(`[${label}] ${response.url()}`);
      console.error(JSON.stringify(payload && payload.data && payload.data.liquid, null, 2));
    }

    const rates = extractEarnRates(payload);
    console.error(`[${label}] vaults leídos de ${response.url()}:`);
    for (const v of EARN_VAULTS) {
      console.error(`   ${v.name.padEnd(9)} ${rates[v.key]}%`);
    }
    return rates;
  } finally {
    await browser.close();
  }
}

module.exports = { fetchEarnRates, extractEarnRates };
