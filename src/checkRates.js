require('dotenv').config();
const { scrapeRate } = require('./scrapeRate');
const { sendAlertEmail } = require('./sendAlertEmail');
const { appendHistory, lastNDays } = require('./history');
const { formatWeeklySummary } = require('./weeklySummary');

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

// A single transient hiccup (a Wi-Fi blip, a slow DNS lookup, ether.fi being
// briefly slow) shouldn't page the user — retry a few times, spaced out,
// before treating it as a real failure worth alerting about.
async function withRetries(fn, { attempts = 3, delayMs = 20000, label } = {}) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.error(`[${label}] intento ${i}/${attempts} falló: ${err.message}`);
      if (i < attempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastErr;
}

async function main() {
  let earnRate;
  let borrowRate;

  const [earnResult, borrowResult] = await Promise.allSettled([
    withRetries(() => scrapeRate(EARN_URL, { label: 'earn', nearText: EARN_VAULT_PATTERN }), { label: 'earn' }),
    withRetries(() => scrapeRate(BORROW_URL, { label: 'borrow', nearText: 'annual interest rate' }), { label: 'borrow' }),
  ]);

  const failures = [];
  if (earnResult.status === 'fulfilled') {
    earnRate = earnResult.value;
  } else {
    failures.push(`earn (${EARN_URL}): ${earnResult.reason.message}`);
  }
  if (borrowResult.status === 'fulfilled') {
    borrowRate = borrowResult.value;
  } else {
    failures.push(`borrow (${BORROW_URL}): ${borrowResult.reason.message}`);
  }

  if (failures.length > 0) {
    console.error('Falló la extracción de tasas:', failures.join(' | '));
    await sendAlertEmail({
      subject: '⚠️ etherfi-rates-bot no pudo leer las tasas',
      text: `El bot no pudo extraer alguna de las tasas desde ether.fi (tras reintentos).\n\n${failures.join('\n')}\n\nRevisar si cambió el diseño de las páginas.`,
    });
    process.exitCode = 1;
    return;
  }

  const spread = earnRate - borrowRate;

  console.log(`Earn rate:   ${earnRate}%`);
  console.log(`Borrow rate: ${borrowRate}%`);
  console.log(`Spread:      ${spread.toFixed(2)}%`);
  console.log(`Umbral:      ${SPREAD_THRESHOLD}%`);

  const history = appendHistory({
    timestamp: new Date().toISOString(),
    earnRate,
    borrowRate,
    spread,
  });

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

  const isSunday = new Date().getDay() === 0;
  if (isSunday) {
    await sendAlertEmail(formatWeeklySummary(lastNDays(history, 7)));
    console.log('Resumen semanal enviado por email.');
  }
}

main().catch((err) => {
  console.error('Error inesperado:', err);
  process.exitCode = 1;
});
