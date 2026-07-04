const { scrapeRate } = require('./scrapeRate');
const { sendAlertEmail } = require('./sendAlertEmail');

const EARN_URL = 'https://www.ether.fi/app/cash/earn';
// The "USD" vault card is the user's actual position (the big one, ~$90M
// deposits). Must not match the "USD RWAs" card, which is a different,
// unrelated vault that also contains the substring "USD".
const EARN_VAULT_PATTERN = /\bUSD\b(?!\s*RWAs)/i;
// The app only shows the borrow rate once a wallet is connected, but
// ether.fi publishes it as a fixed, public number in their help center.
const BORROW_URL =
  'https://help.ether.fi/en/articles/326983-understanding-your-cash-card-borrow-mode-vs-direct-pay-mode';
const SPREAD_THRESHOLD = parseFloat(process.env.SPREAD_THRESHOLD || '0.25');

async function main() {
  let earnRate;
  let borrowRate;

  try {
    [earnRate, borrowRate] = await Promise.all([
      scrapeRate(EARN_URL, { label: 'earn', nearText: EARN_VAULT_PATTERN }),
      scrapeRate(BORROW_URL, { label: 'borrow', nearText: 'annual interest rate' }),
    ]);
  } catch (err) {
    console.error('Falló la extracción de tasas:', err.message);
    await sendAlertEmail({
      subject: '⚠️ etherfi-rates-bot no pudo leer las tasas',
      text: `El bot no pudo extraer alguna de las tasas desde ether.fi.\n\nError: ${err.message}\n\nRevisar si cambió el diseño de las páginas:\n- ${EARN_URL}\n- ${BORROW_URL}`,
    });
    process.exitCode = 1;
    return;
  }

  const spread = earnRate - borrowRate;

  console.log(`Earn rate:   ${earnRate}%`);
  console.log(`Borrow rate: ${borrowRate}%`);
  console.log(`Spread:      ${spread.toFixed(2)}%`);
  console.log(`Umbral:      ${SPREAD_THRESHOLD}%`);

  if (spread < SPREAD_THRESHOLD) {
    const subject =
      spread < 0
        ? '🚨 ether.fi Cash: el préstamo ahora es más caro que lo que ganás'
        : '⚠️ ether.fi Cash: el spread de tasas se está achicando';

    const text = `Earn rate (colateral):  ${earnRate}%
Borrow rate (préstamo): ${borrowRate}%
Spread (earn - borrow): ${spread.toFixed(2)}%
Umbral configurado:     ${SPREAD_THRESHOLD}%

${EARN_URL}
${BORROW_URL}`;

    await sendAlertEmail({ subject, text });
    console.log('Alerta enviada por email.');
  } else {
    console.log('Todo OK, no se envía alerta.');
  }
}

main().catch((err) => {
  console.error('Error inesperado:', err);
  process.exitCode = 1;
});
