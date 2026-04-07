const fs = require('fs');
const path = require('path');
const os = require('os');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function slugify(str) {
  return (str || '')
    .toLowerCase()
    .replace(/\s*[&+]\s*/g, '-and-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

function buildFilename(set, config) {
  const date = (set.date || `${set.year || 'unknown'}-01-01`).replace(/-/g, '_');
  const dj = slugify(set.dj);
  const stage = slugify(set.stage || 'unknown-stage');
  const suffix = config.filenameSuffix || 'Set';
  return `${date}_${dj}_${stage}_${suffix}.json`;
}

function outPath(set, config) {
  const outDir = config.outputDir.replace(/^~/, os.homedir());
  const dir = path.join(outDir, String(set.year || 'unknown'));
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, buildFilename(set, config));
}

function parseArgs() {
  return Object.fromEntries(
    process.argv.slice(2)
      .filter(a => a.startsWith('--'))
      .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
  );
}

function parseCueTime(text) {
  if (!text) return null;
  const parts = text.split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

module.exports = { sleep, slugify, buildFilename, outPath, parseArgs, parseCueTime };
