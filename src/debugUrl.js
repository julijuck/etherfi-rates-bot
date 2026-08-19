const { scrapeRate } = require('./scrapeRate');
const { EARN_URL, EARN_VAULT_PATTERN, BORROW_URL, BORROW_VAULT_PATTERN } = require('./rateSources');

// Reproduce the exact anchor checkRates.js would use for this URL in
// production, so this debug run reflects what scrapeRate actually sees
// day to day (instead of silently falling back to the 'apy' default,
// which doesn't appear anywhere on these pages and made every candidate
// come back with distance "n/a").
function resolveNearText(url) {
  if (process.env.DEBUG_NEAR_TEXT) return process.env.DEBUG_NEAR_TEXT;
  if (url === EARN_URL) return EARN_VAULT_PATTERN;
  if (url === BORROW_URL) return BORROW_VAULT_PATTERN;
  return undefined; // unknown URL: let scrapeRate fall back to its 'apy' default
}

async function main() {
  const url = process.env.DEBUG_URL;
  if (!url) {
    console.error('Falta DEBUG_URL');
    process.exit(1);
  }
  process.env.DEBUG_SCRAPE = '1';

  const nearText = resolveNearText(url);
  console.error(`[debug] nearText: ${nearText ? nearText.toString() : "'apy' (default, URL desconocida)"}`);

  try {
    const rate = await scrapeRate(url, { label: 'debug', nearText });
    console.log('rate found:', rate);
  } catch (err) {
    console.error('scrapeRate threw (expected if page has no % or is a docs page):', err.message);
  }
}

main();
