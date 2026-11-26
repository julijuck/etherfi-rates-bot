const test = require('node:test');
const assert = require('node:assert');
const { extractEarnRates } = require('../src/fetchEarnRates');
const { formatWeeklySummary } = require('../src/weeklySummary');
// Real response captured from https://www.ether.fi/app/cash/earn on 2026-11-26
// (from an Argentina IP); the app showed USD Bold 7.89%, USD RWAs 5.86%, USD 4.89%.
const fixture = require('./fixtures-markets-overview.json');

const clone = () => JSON.parse(JSON.stringify(fixture));

test('extracts the three USD vaults with the same rounding the app shows', () => {
  assert.deepStrictEqual(extractEarnRates(fixture), { usd: 4.89, bold: 7.89, rwa: 5.86 });
});

test('fails loudly if a vault is missing (e.g. geo-restricted)', () => {
  const p = clone();
  p.data.liquid = p.data.liquid.filter((v) => v.vaultId !== 'liquid-rwa');
  assert.throws(() => extractEarnRates(p), /USD RWAs: no aparece/);
});

test('fails loudly if an id now points at a different card', () => {
  const p = clone();
  p.data.liquid.find((v) => v.vaultId === 'liquid-defi').subLabel = 'Turbo';
  assert.throws(() => extractEarnRates(p), /ahora se llama "USD Turbo"/);
});

test('rejects a missing or implausible APY', () => {
  const p = clone();
  p.data.liquid.find((v) => v.vaultId === 'liquid-usd').apy = null;
  assert.throws(() => extractEarnRates(p), /USD: APY no plausible/);
});

test('weekly summary mixes old single-vault records with new ones', () => {
  const { text } = formatWeeklySummary([
    { timestamp: '2026-11-20T13:00:00Z', earnRate: 5.0, borrowRate: 4.1, spread: 0.9 },
    {
      timestamp: '2026-11-26T13:00:00Z',
      earnRate: 4.89,
      borrowRate: 4.15,
      spread: 0.74,
      earnRates: { usd: 4.89, bold: 7.89, rwa: 5.86 },
    },
  ]);
  assert.match(text, /USD Bold +promedio \+3\.74%.*\(1 de 2 chequeos\)/);
  assert.match(text, /USD +promedio \+0\.82%/);
  assert.match(text, /USD RWAs +earn 5\.86% +spread \+1\.71%/);
  console.log(text);
});
