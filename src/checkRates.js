require('dotenv').config();
const { scrapeRate } = require('./scrapeRate');
const { fetchEarnRates } = require('./fetchEarnRates');
const { sendAlertEmail } = require('./sendAlertEmail');
const { appendHistory, lastNDays } = require('./history');
const { formatWeeklySummary } = require('./weeklySummary');
const { EARN_URL, EARN_VAULTS, BORROW_URL, BORROW_VAULT_PATTERN } = require('./rateSources');

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
  let earnRates;
  let borrowRate;

  const [earnResult, borrowResult] = await Promise.allSettled([
    withRetries(() => fetchEarnRates({ label: 'earn' }), { label: 'earn' }),
    withRetries(() => scrapeRate(BORROW_URL, { label: 'borrow', nearText: BORROW_VAULT_PATTERN }), { label: 'borrow' }),
  ]);

  const failures = [];
  if (earnResult.status === 'fulfilled') {
    earnRates = earnResult.value;
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

  const spreads = {};
  for (const v of EARN_VAULTS) {
    spreads[v.key] = earnRates[v.key] - borrowRate;
  }

  const rows = EARN_VAULTS.map(
    (v) =>
      `${v.name.padEnd(9)} earn ${earnRates[v.key].toFixed(2)}%  spread ${spreads[v.key] >= 0 ? '+' : ''}${spreads[v.key].toFixed(2)}%`
  );

  console.log(`Borrow rate: ${borrowRate}%`);
  rows.forEach((r) => console.log(r));
  console.log(`Umbral:      ${SPREAD_THRESHOLD}%`);

  // earnRate/spread keep pointing at the plain "USD" vault so records written
  // before multi-vault support stay comparable; earnRates holds all vaults.
  const mainKey = EARN_VAULTS[0].key;
  const history = appendHistory({
    timestamp: new Date().toISOString(),
    earnRate: earnRates[mainKey],
    borrowRate,
    spread: spreads[mainKey],
    earnRates,
  });

  const belowThreshold = EARN_VAULTS.filter((v) => spreads[v.key] < SPREAD_THRESHOLD);
  if (belowThreshold.length > 0) {
    const anyNegative = belowThreshold.some((v) => spreads[v.key] < 0);
    const names = belowThreshold.map((v) => v.name).join(', ');
    const subject = anyNegative
      ? `🚨 ether.fi Cash: el préstamo ahora es más caro que lo que ganás (${names})`
      : `⚠️ ether.fi Cash: el spread de tasas se está achicando (${names})`;

    const text = `Borrow rate (préstamo): ${borrowRate}%
Umbral configurado:     ${SPREAD_THRESHOLD}%

Vault      earn (colateral) y spread (earn - borrow):
${rows.join('\n')}

Por debajo del umbral: ${names}

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
