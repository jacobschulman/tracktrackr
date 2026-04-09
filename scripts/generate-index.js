#!/usr/bin/env node
// Generates index.json for a festival data directory by scanning year subdirectories
// Usage: node scripts/generate-index.js <festival-slug>
// Example: node scripts/generate-index.js coachella

const fs = require('fs');
const path = require('path');

const festivalSlug = process.argv[2];
if (!festivalSlug) {
  console.error('Usage: node scripts/generate-index.js <festival-slug>');
  process.exit(1);
}

const FESTIVAL_NAMES = {
  'ultra-miami': 'Ultra Music Festival Miami',
  'ultra-chile': 'Ultra Chile',
  'ultra-europe': 'Ultra Europe',
  'ultra-japan': 'Ultra Japan',
  'tomorrowland': 'Tomorrowland',
  'coachella': 'Coachella Valley Music and Arts Festival',
  'edc-las-vegas': 'Electric Daisy Carnival Las Vegas',
  'edc-china': 'Electric Daisy Carnival China',
  'edc-dallas': 'Electric Daisy Carnival Dallas',
  'edc-los-angeles': 'Electric Daisy Carnival Los Angeles',
  'edc-mexico': 'Electric Daisy Carnival Mexico',
  'edc-new-york': 'Electric Daisy Carnival New York',
  'edc-orlando': 'Electric Daisy Carnival Orlando',
  'electric-zoo': 'Electric Zoo',
  'creamfields': 'Creamfields',
  'lollapalooza': 'Lollapalooza',
  'mysteryland': 'Mysteryland',
  'parookaville': 'Parookaville',
};

const dataDir = path.join(__dirname, '..', 'data', festivalSlug);
if (!fs.existsSync(dataDir)) {
  console.error(`Data directory not found: ${dataDir}`);
  process.exit(1);
}

const sets = [];
const yearsSet = new Set();
const stagesSet = new Set();

const entries = fs.readdirSync(dataDir, { withFileTypes: true });
for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const yearStr = entry.name;
  if (!/^\d{4}$/.test(yearStr)) continue;

  const yearDir = path.join(dataDir, yearStr);
  const files = fs.readdirSync(yearDir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(yearDir, file), 'utf-8');
      const data = JSON.parse(raw);

      const tracks = data.tracks || [];
      const identified = tracks.filter(t =>
        (t.type === 'normal' || t.type === 'blend') &&
        t.artist && t.artist !== 'ID' && t.title && t.title !== 'ID'
      ).length;

      const setMeta = {
        tlId: data.tlId,
        dj: data.dj,
        djs: (data.djs || []).map(d => ({
          name: d.name,
          slug: d.slug,
          aliases: d.aliases || [],
        })),
        stage: data.stage || 'Unknown Stage',
        stageRaw: data.stageRaw || data.stage || '',
        date: data.date,
        year: data.year || parseInt(yearStr),
        genre: data.genre || '',
        tracksIdentified: data.tracksIdentified || identified,
        tracksTotal: data.tracksTotal || tracks.length,
        duration: data.duration || '',
        views: data.views || 0,
        likes: data.likes || 0,
        url: data.url || '',
        hasSetFile: true,
      };

      sets.push(setMeta);
      yearsSet.add(setMeta.year);
      stagesSet.add(setMeta.stage);
    } catch (err) {
      console.warn(`  Skipping ${file}: ${err.message}`);
    }
  }
}

sets.sort((a, b) => a.date.localeCompare(b.date) || a.dj.localeCompare(b.dj));

const index = {
  festival: festivalSlug,
  festivalName: FESTIVAL_NAMES[festivalSlug] || festivalSlug,
  years: [...yearsSet].sort((a, b) => a - b),
  totalSets: sets.length,
  scrapedSets: sets.length,
  stages: [...stagesSet].sort(),
  sets,
};

const outPath = path.join(dataDir, 'index.json');
fs.writeFileSync(outPath, JSON.stringify(index));
console.log(`Generated ${outPath}: ${sets.length} sets, ${yearsSet.size} years, ${stagesSet.size} stages`);
