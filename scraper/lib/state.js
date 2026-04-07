const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(__dirname, '..', '.state');

function stateFile(festivalName) {
  return path.join(STATE_DIR, `${festivalName}.json`);
}

function loadState(festivalName) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const file = stateFile(festivalName);
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      // Corrupt state — start fresh
      return createEmpty(festivalName);
    }
  }
  return createEmpty(festivalName);
}

function createEmpty(festivalName) {
  return {
    festival: festivalName,
    lastUpdated: new Date().toISOString(),
    sets: {},
  };
}

function saveState(state) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const file = stateFile(state.festival);
  const tmp = file + '.tmp';
  state.lastUpdated = new Date().toISOString();
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, file);
}

function markScraped(state, tlId, { trackCount, hasMediaIds, outputFile }) {
  state.sets[tlId] = {
    ...(state.sets[tlId] || {}),
    status: trackCount > 0 ? 'scraped' : 'empty',
    scrapeAttempts: (state.sets[tlId]?.scrapeAttempts || 0) + 1,
    lastAttempt: new Date().toISOString(),
    lastError: null,
    trackCount,
    hasMediaIds,
    resolved: state.sets[tlId]?.resolved || false,
    outputFile,
  };
  saveState(state);
}

function markFailed(state, tlId, error) {
  state.sets[tlId] = {
    ...(state.sets[tlId] || {}),
    status: 'failed',
    scrapeAttempts: (state.sets[tlId]?.scrapeAttempts || 0) + 1,
    lastAttempt: new Date().toISOString(),
    lastError: error,
    trackCount: state.sets[tlId]?.trackCount || 0,
    hasMediaIds: state.sets[tlId]?.hasMediaIds || false,
    resolved: state.sets[tlId]?.resolved || false,
  };
  saveState(state);
}

function markResolved(state, tlId) {
  if (state.sets[tlId]) {
    state.sets[tlId].resolved = true;
    saveState(state);
  }
}

function getRetryQueue(state, maxAttempts = 3) {
  return Object.entries(state.sets)
    .filter(([, s]) => s.status === 'failed' && s.scrapeAttempts < maxAttempts)
    .map(([tlId]) => tlId);
}

function getPendingResolve(state) {
  return Object.entries(state.sets)
    .filter(([, s]) => s.hasMediaIds && !s.resolved && (s.status === 'scraped'))
    .map(([tlId]) => tlId);
}

function getStats(state) {
  const sets = Object.values(state.sets);
  return {
    total: sets.length,
    scraped: sets.filter(s => s.status === 'scraped').length,
    empty: sets.filter(s => s.status === 'empty').length,
    failed: sets.filter(s => s.status === 'failed').length,
    resolved: sets.filter(s => s.resolved).length,
  };
}

module.exports = {
  loadState, saveState, markScraped, markFailed, markResolved,
  getRetryQueue, getPendingResolve, getStats,
};
