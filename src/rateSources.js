const EARN_URL = 'https://www.ether.fi/app/cash/earn';
// The "USD" vault card is the user's actual position (the big one, ~$90M
// deposits). Must not match the "USD RWAs" card, which is a different,
// unrelated vault that also contains the substring "USD".
const EARN_VAULT_PATTERN = /\bUSD\b(?!\s*RWAs)/i;

// Borrow used to be a fixed 4% documented in a help article, but ether.fi
// switched it to a dynamic, pool-driven rate shown on this app page. It's
// public (no login needed) and the same rate for everyone.
const BORROW_URL = 'https://www.ether.fi/app/cash/borrow';
// \bUSD\b won't match inside "USDC" (no word boundary between D and C),
// so it shouldn't get confused by the ticker subtitle shown next to the row.
const BORROW_VAULT_PATTERN = /\bUSD\b/i;

module.exports = { EARN_URL, EARN_VAULT_PATTERN, BORROW_URL, BORROW_VAULT_PATTERN };
