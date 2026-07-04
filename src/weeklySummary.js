function formatWeeklySummary(records) {
  if (records.length === 0) {
    return {
      subject: '📊 ether.fi Cash: resumen semanal (sin datos)',
      text: 'No hay chequeos registrados en los últimos 7 días.',
    };
  }

  const lines = records.map((r) => {
    const label = new Date(r.timestamp).toLocaleDateString('es-AR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });
    return `${label}  earn ${r.earnRate.toFixed(2)}%  borrow ${r.borrowRate.toFixed(2)}%  spread ${r.spread.toFixed(2)}%`;
  });

  const spreads = records.map((r) => r.spread);
  const avgSpread = spreads.reduce((a, b) => a + b, 0) / spreads.length;
  const minSpread = Math.min(...spreads);
  const maxSpread = Math.max(...spreads);
  const last = records[records.length - 1];

  const text = `Resumen de los últimos ${records.length} chequeos:

${lines.join('\n')}

Spread promedio: ${avgSpread.toFixed(2)}%
Spread mínimo:   ${minSpread.toFixed(2)}%
Spread máximo:   ${maxSpread.toFixed(2)}%

Último chequeo: earn ${last.earnRate.toFixed(2)}%  borrow ${last.borrowRate.toFixed(2)}%  spread ${last.spread.toFixed(2)}%`;

  return {
    subject: '📊 ether.fi Cash: resumen semanal de tasas',
    text,
  };
}

module.exports = { formatWeeklySummary };
