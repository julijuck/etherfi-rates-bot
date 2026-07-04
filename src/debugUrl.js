const { scrapeRate } = require('./scrapeRate');

async function main() {
  const url = process.env.DEBUG_URL;
  if (!url) {
    console.error('Falta DEBUG_URL');
    process.exit(1);
  }
  process.env.DEBUG_SCRAPE = '1';
  try {
    const rate = await scrapeRate(url, { label: 'debug' });
    console.log('rate found:', rate);
  } catch (err) {
    console.error('scrapeRate threw (expected if page has no % or is a docs page):', err.message);
  }
}

main();
