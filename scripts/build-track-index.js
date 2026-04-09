#!/usr/bin/env node
// Pre-builds a track index from all set files so the app doesn't have to load them all at runtime
// Usage: node scripts/build-track-index.js

const fs = require('fs');
const path = require('path');

const DATA_ROOT = path.join(__dirname, '..', 'data');

function isIDTrack(artist, title) {
  const a = (artist || '').toLowerCase().trim();
  const t = (title || '').toLowerCase().trim();
  return a === 'id' || t === 'id' || a === '' || t === '' ||
    t.startsWith('id (') || t === 'id?' || a === 'id?';
}

function trackKey(artist, title) {
  return (artist || '').toLowerCase().trim() + '|||' + (title || '').toLowerCase().trim();
}

function stripRemix(title) {
  const stripped = title
    .replace(/\s*[\(\[][^\)\]]*\b(remix|edit|bootleg|mashup|flip|mix|rework|version|vip|dub|re-?edit|tribute|instrumental|intro|original|feat\.?|ft\.?|featuring)\b[^\)\]]*[\)\]]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return stripped || title;
}

function stripFeaturing(artist) {
  const stripped = artist
    .replace(/\s+(?:ft\.?|feat\.?|featuring)\s+.*/i, '')
    .trim();
  return stripped || artist;
}

// Read blocklist
let blockedSets = new Set();
let blockedFestivals = new Set();
try {
  const bl = JSON.parse(fs.readFileSync(path.join(DATA_ROOT, 'blocklist.json'), 'utf-8'));
  blockedSets = new Set(bl.sets || []);
  blockedFestivals = new Set(bl.festivals || []);
} catch {}

// Track index: key -> appearances
const trackIndex = new Map();
// Blend index
const blendIndex = new Map();
// File index: tlId -> path
const fileIndex = {};
// Recording index: tlId -> { ytUrl, scUrl }
const recordingIndex = {};

let totalFiles = 0;

const entries = fs.readdirSync(DATA_ROOT, { withFileTypes: true });
for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  if (blockedFestivals.has(entry.name)) continue;
  const indexPath = path.join(DATA_ROOT, entry.name, 'index.json');
  if (!fs.existsSync(indexPath)) continue;

  const festivalSlug = entry.name;
  const idx = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  const setTlIds = new Set(idx.sets.filter(s => !blockedSets.has(s.tlId)).map(s => s.tlId));

  const festDir = path.join(DATA_ROOT, festivalSlug);
  const yearDirs = fs.readdirSync(festDir, { withFileTypes: true });

  for (const yd of yearDirs) {
    if (!yd.isDirectory() || !/^\d{4}$/.test(yd.name)) continue;
    const yearPath = path.join(festDir, yd.name);
    const files = fs.readdirSync(yearPath).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const filePath = path.join(yearPath, file);
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);

        if (!data.tlId || !setTlIds.has(data.tlId)) continue;

        fileIndex[data.tlId] = path.relative(DATA_ROOT, filePath);
        totalFiles++;

        // Recordings
        const recordings = data.recordings || [];
        const yt = recordings.find(r => r.platform === 'youtube');
        const sc = recordings.find(r => r.platform === 'soundcloud');
        if (yt || sc) {
          recordingIndex[data.tlId] = {};
          if (yt) recordingIndex[data.tlId].yt = yt.url;
          if (sc) recordingIndex[data.tlId].sc = sc.url;
        }

        const tracks = data.tracks || [];
        const djSlugs = (data.djs || []).flatMap(d => {
          const slugs = [d.slug];
          if (d.aliases) slugs.push(...d.aliases);
          return slugs;
        });

        for (const t of tracks) {
          if (t.type !== 'normal' && t.type !== 'blend') continue;
          if (isIDTrack(t.artist, t.title)) continue;

          const cleanTitle = stripRemix(t.title);
          const canonArtist = stripFeaturing(t.artist);
          const key = trackKey(canonArtist, cleanTitle);

          if (!trackIndex.has(key)) trackIndex.set(key, []);
          trackIndex.get(key).push({
            tlId: data.tlId,
            pos: t.pos || '',
            year: data.year || parseInt(yd.name),
            dj: data.dj || '',
            djSlugs,
            stage: data.stage || '',
            date: data.date || '',
            label: t.label || '',
            remix: t.remix || '',
            artist: canonArtist,
            title: cleanTitle,
            festival: festivalSlug,
            festivalName: idx.festivalName || festivalSlug,
          });

          // Blend index
          if (t.type === 'normal' && t.blendGroup && t.blendGroup.length >= 2) {
            for (const bg of t.blendGroup) {
              if (isIDTrack(bg.artist, bg.title)) continue;
              const bgKey = trackKey(stripFeaturing(bg.artist), stripRemix(bg.title));
              if (!blendIndex.has(bgKey)) blendIndex.set(bgKey, []);
              blendIndex.get(bgKey).push({
                tlId: data.tlId,
                year: data.year || parseInt(yd.name),
                dj: data.dj || '',
                djSlugs,
                stage: data.stage || '',
                date: data.date || '',
                pairedWith: t.blendGroup.filter(b => trackKey(b.artist, b.title) !== bgKey).map(b => ({
                  artist: b.artist, title: b.title, remix: b.remix || '',
                })),
                festival: festivalSlug,
                festivalName: idx.festivalName || festivalSlug,
              });
            }
          }
        }
      } catch (err) {
        // skip bad files
      }
    }
  }
}

// Serialize
const output = {
  trackIndex: Object.fromEntries(trackIndex),
  blendIndex: Object.fromEntries(blendIndex),
  fileIndex,
  recordingIndex,
  builtAt: new Date().toISOString(),
  totalFiles,
  totalTracks: trackIndex.size,
};

const outPath = path.join(DATA_ROOT, 'track-index.json');
fs.writeFileSync(outPath, JSON.stringify(output));
const sizeMB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(1);
console.log(`Built ${outPath}: ${trackIndex.size} tracks, ${blendIndex.size} blends, ${totalFiles} files, ${Object.keys(recordingIndex).length} recordings (${sizeMB}MB)`);
