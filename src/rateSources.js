const EARN_URL = 'https://www.ether.fi/app/cash/earn';
// Legacy text anchor for the plain "USD" vault card. Only used by
// debugUrl.js now: the real check reads the earn vaults from the JSON the
// page itself loads (see EARN_VAULTS / fetchEarnRates.js), because with
// three cards all labelled "USD" (Bold, RWAs and plain) a text anchor is
// too easy to confuse.
const EARN_VAULT_PATTERN = /\bUSD\b(?!\s*(?:RWAs|Bold))/i;

// The /cash/earn page fetches its vault list (with each vault's APY) from
// this endpoint. The page builds the query string itself (country/region
// come from the visitor's IP), so we don't call it directly: we load the
// page and read the response the page receives.
const MARKETS_OVERVIEW_PATH = '/app/cash/api/markets/overview';

// USD-denominated earn vaults to compare against the borrow rate.
// `vaultId` is ether.fi's internal id in that JSON; `label`/`subLabel` are
// what the card shows, and are checked too so that a silent re-mapping of
// ids on ether.fi's side fails loudly instead of reporting the wrong vault.
// The first entry is the "main" vault, stored as `earnRate` in history for
// backwards compatibility with records written before multi-vault support.
const EARN_VAULTS = [
  { key: 'usd', name: 'USD', vaultId: 'liquid-usd', label: 'USD', subLabel: null },
  { key: 'bold', name: 'USD Bold', vaultId: 'liquid-defi', label: 'USD', subLabel: 'Bold' },
  { key: 'rwa', name: 'USD RWAs', vaultId: 'liquid-rwa', label: 'USD', subLabel: 'RWAs' },
];

// Borrow used to be a fixed 4% documented in a help article, but ether.fi
// switched it to a dynamic, pool-driven rate shown on this app page. It's
// public (no login needed) and the same rate for everyone.
const BORROW_URL = 'https://www.ether.fi/app/cash/borrow';
// \bUSD\b won't match inside "USDC" (no word boundary between D and C),
// so it shouldn't get confused by the ticker subtitle shown next to the row.
const BORROW_VAULT_PATTERN = /\bUSD\b/i;

module.exports = {
  EARN_URL,
  EARN_VAULT_PATTERN,
  MARKETS_OVERVIEW_PATH,
  EARN_VAULTS,
  BORROW_URL,
  BORROW_VAULT_PATTERN,
};
