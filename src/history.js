const fs = require('fs');
const path = require('path');

const HISTORY_DIR = path.join(__dirname, '..', 'data');
const HISTORY_PATH = path.join(HISTORY_DIR, 'history.json');
const RETENTION_DAYS = 35;

function loadHistory() {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function appendHistory(record) {
  const history = loadHistory();
  history.push(record);

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const pruned = history.filter((r) => new Date(r.timestamp).getTime() >= cutoff);

  fs.mkdirSync(HISTORY_DIR, { recursive: true });
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(pruned, null, 2));

  return pruned;
}

function lastNDays(history, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return history.filter((r) => new Date(r.timestamp).getTime() >= cutoff);
}

module.exports = { appendHistory, lastNDays };
