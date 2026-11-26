const { EARN_VAULTS } = require('./rateSources');

// Records written before multi-vault support only have `earnRate` (the plain
// "USD" vault). Map them into the same shape so old and new rows mix.
function earnRatesOf(record) {
  if (record.earnRates) return record.earnRates;
  return { [EARN_VAULTS[0].key]: record.earnRate };
}

function fmt(n) {
  return typeof n === 'number' && Number.isFinite(n) ? `${n.toFixed(2)}%` : '  -  ';
}

function signed(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '  -  ';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function stats(values) {
  const vs = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (vs.length === 0) return null;
  return {
    avg: vs.reduce((a, b) => a + b, 0) / vs.length,
    min: Math.min(...vs),
    max: Math.max(...vs),
    n: vs.length,
  };
}

function formatWeeklySummary(records) {
  if (records.length === 0) {
    return {
      subject: '📊 ether.fi Cash: resumen semanal (sin datos)',
      text: 'No hay chequeos registrados en los últimos 7 días.',
    };
  }

  const header = ['Día       ', 'borrow ', ...EARN_VAULTS.map((v) => v.name.padEnd(9))].join('  ');
  const lines = records.map((r) => {
    const label = new Date(r.timestamp).toLocaleDateString('es-AR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });
    const earn = earnRatesOf(r);
    const cols = EARN_VAULTS.map((v) => fmt(earn[v.key]).padEnd(9));
    return [label.padEnd(10), fmt(r.borrowRate).padEnd(7), ...cols].join('  ');
  });

  const spreadBlocks = EARN_VAULTS.map((v) => {
    const s = stats(records.map((r) => earnRatesOf(r)[v.key] - r.borrowRate));
    if (!s) return `${v.name.padEnd(9)} sin datos todavía`;
    const note = s.n < records.length ? `  (${s.n} de ${records.length} chequeos)` : '';
    return `${v.name.padEnd(9)} promedio ${signed(s.avg)}  mín ${signed(s.min)}  máx ${signed(s.max)}${note}`;
  });

  const last = records[records.length - 1];
  const lastEarn = earnRatesOf(last);
  const lastLines = EARN_VAULTS.map(
    (v) =>
      `${v.name.padEnd(9)} earn ${fmt(lastEarn[v.key])}  spread ${signed(lastEarn[v.key] - last.borrowRate)}`
  );

  const text = `Resumen de los últimos ${records.length} chequeos (tasas earn por vault vs. borrow):

${header}
${lines.join('\n')}

Spread (earn - borrow) por vault:
${spreadBlocks.join('\n')}

Último chequeo (borrow ${fmt(last.borrowRate)}):
${lastLines.join('\n')}`;

  return {
    subject: '📊 ether.fi Cash: resumen semanal de tasas',
    text,
  };
}

module.exports = { formatWeeklySummary };
