#!/usr/bin/env node
// Builds per-DJ index files with pre-computed stats, signature tracks, and recording URLs.
// Each DJ gets a small JSON file under data/djs/{slug}.json
// Usage: node scripts/build-dj-indexes.js

const fs = require('fs');
const path = require('path');

const DATA_ROOT = path.join(__dirname, '..', 'data');
const DJ_DIR = path.join(DATA_ROOT, 'djs');

// Ensure output dir
if (!fs.existsSync(DJ_DIR)) fs.mkdirSync(DJ_DIR, { recursive: true });

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
  return title
    .replace(/\s*[\(\[][^\)\]]*\b(remix|edit|bootleg|mashup|flip|mix|rework|version|vip|dub|re-?edit|tribute|instrumental|intro|original|feat\.?|ft\.?|featuring)\b[^\)\]]*[\)\]]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim() || title;
}

function stripFeaturing(artist) {
  return artist.replace(/\s+(?:ft\.?|feat\.?|featuring)\s+.*/i, '').trim() || artist;
}

// Read blocklist
let blockedSets = new Set();
let blockedFestivals = new Set();
try {
  const bl = JSON.parse(fs.readFileSync(path.join(DATA_ROOT, 'blocklist.json'), 'utf-8'));
  blockedSets = new Set(bl.sets || []);
  blockedFestivals = new Set(bl.festivals || []);
} catch {}

// Load all festival indexes
const festivals = [];
const allSets = []; // SetMeta with festival info
const entries = fs.readdirSync(DATA_ROOT, { withFileTypes: true });
for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  if (blockedFestivals.has(entry.name)) continue;
  if (entry.name === 'djs') continue;
  const indexPath = path.join(DATA_ROOT, entry.name, 'index.json');
  if (!fs.existsSync(indexPath)) continue;
  const idx = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  festivals.push({ slug: entry.name, index: idx });
  for (const s of idx.sets) {
    if (blockedSets.has(s.tlId)) continue;
    s.festival = entry.name;
    s.festivalName = idx.festivalName || entry.name;
    allSets.push(s);
  }
}

// Build DJ -> sets mapping
const djSets = new Map(); // slug -> SetMeta[]
const djNames = new Map(); // slug -> display name
for (const s of allSets) {
  for (const d of s.djs) {
    const slugs = [d.slug, ...(d.aliases || [])];
    for (const slug of slugs) {
      if (!djSets.has(slug)) djSets.set(slug, []);
      djSets.get(slug).push(s);
      if (!djNames.has(slug)) djNames.set(slug, d.name);
    }
  }
}

// Build a global file index: tlId -> relative path
const fileIndex = {};
for (const { slug } of festivals) {
  const festDir = path.join(DATA_ROOT, slug);
  try {
    const yearDirs = fs.readdirSync(festDir, { withFileTypes: true });
    for (const yd of yearDirs) {
      if (!yd.isDirectory() || !/^\d{4}$/.test(yd.name)) continue;
      const files = fs.readdirSync(path.join(festDir, yd.name)).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const filePath = path.join(festDir, yd.name, file);
        try {
          const fd = fs.openSync(filePath, 'r');
          const buf = Buffer.alloc(200);
          fs.readSync(fd, buf, 0, 200, 0);
          fs.closeSync(fd);
          const match = buf.toString('utf-8').match(/"tlId"\s*:\s*"([^"]+)"/);
          if (match) fileIndex[match[1]] = path.relative(DATA_ROOT, filePath);
        } catch {}
      }
    }
  } catch {}
}

// Save global file + recording index (small: just paths and recordings)
const recordingIndex = {};
const tracksByDJ = new Map(); // djSlug -> Map<trackKey, { artist, title, count, years }>
const globalTrackPlayers = new Map(); // trackKey -> Set<djSlug> (for "most supported")
const trackAppearances = new Map(); // trackKey -> [{ tlId, year, dj, djSlugs, stage, date, festival, festivalName, label, remix }]
const blendAppearances = new Map(); // trackKey -> [{ tlId, year, dj, djSlugs, pairedWith, festival }]

console.log(`Processing ${djSets.size} DJs across ${allSets.length} sets...`);

// Load set files and build per-DJ track data
let filesLoaded = 0;
for (const [tlId, relPath] of Object.entries(fileIndex)) {
  const filePath = path.join(DATA_ROOT, relPath);
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    filesLoaded++;

    // Recordings
    const recs = data.recordings || [];
    const yt = recs.find(r => r.platform === 'youtube');
    const sc = recs.find(r => r.platform === 'soundcloud');
    if (yt || sc) {
      recordingIndex[tlId] = {};
      if (yt) recordingIndex[tlId].yt = yt.url;
      if (sc) recordingIndex[tlId].sc = sc.url;
    }

    // Track data per DJ
    const djSlugs = (data.djs || []).flatMap(d => [d.slug, ...(d.aliases || [])]);
    const tracks = (data.tracks || []).filter(t =>
      (t.type === 'normal' || t.type === 'blend') && !isIDTrack(t.artist, t.title)
    );

    const setFestival = allSets.find(s => s.tlId === data.tlId)?.festival || '';
    const setFestivalName = allSets.find(s => s.tlId === data.tlId)?.festivalName || '';

    for (const t of tracks) {
      const artist = stripFeaturing(t.artist);
      const title = stripRemix(t.title);
      const key = trackKey(artist, title);
      const year = data.year;

      // Track appearances (for per-track pages)
      if (!trackAppearances.has(key)) trackAppearances.set(key, []);
      trackAppearances.get(key).push({
        tlId: data.tlId, year, dj: data.dj || '', djSlugs,
        stage: data.stage || '', date: data.date || '',
        festival: setFestival, festivalName: setFestivalName,
        label: t.label || '', remix: t.remix || '',
        artist, title,
      });

      // Blend appearances
      if (t.type === 'normal' && t.blendGroup && t.blendGroup.length >= 2) {
        for (const bg of t.blendGroup) {
          if (isIDTrack(bg.artist, bg.title)) continue;
          const bgKey = trackKey(stripFeaturing(bg.artist), stripRemix(bg.title));
          if (!blendAppearances.has(bgKey)) blendAppearances.set(bgKey, []);
          blendAppearances.get(bgKey).push({
            tlId: data.tlId, year, dj: data.dj || '', djSlugs,
            stage: data.stage || '', date: data.date || '',
            pairedWith: t.blendGroup.filter(b => trackKey(b.artist, b.title) !== bgKey)
              .map(b => ({ artist: b.artist, title: b.title, remix: b.remix || '' })),
            festival: setFestival, festivalName: setFestivalName,
          });
        }
      }

      // Global track players (for most-supported)
      if (!globalTrackPlayers.has(key)) globalTrackPlayers.set(key, new Set());
      for (const slug of djSlugs) globalTrackPlayers.get(key).add(slug);

      // Per-DJ tracks
      for (const slug of djSlugs) {
        if (!tracksByDJ.has(slug)) tracksByDJ.set(slug, new Map());
        const djTracks = tracksByDJ.get(slug);
        if (!djTracks.has(key)) {
          djTracks.set(key, { artist, title, count: 0, years: new Set(), sets: new Set() });
        }
        const entry = djTracks.get(key);
        entry.count++;
        entry.years.add(year);
        entry.sets.add(tlId);
      }
    }
  } catch {}

  if (filesLoaded % 1000 === 0) process.stdout.write(`  ${filesLoaded} files...\r`);
}
console.log(`  Loaded ${filesLoaded} set files`);

// Save recordings index (separate small file)
const recPath = path.join(DATA_ROOT, 'recordings.json');
fs.writeFileSync(recPath, JSON.stringify(recordingIndex));
console.log(`Saved ${recPath}: ${Object.keys(recordingIndex).length} recordings (${(fs.statSync(recPath).size / 1024).toFixed(0)}KB)`);

// Save file index
const filePath = path.join(DATA_ROOT, 'file-index.json');
fs.writeFileSync(filePath, JSON.stringify(fileIndex));
console.log(`Saved ${filePath}: ${Object.keys(fileIndex).length} files (${(fs.statSync(filePath).size / 1024).toFixed(0)}KB)`);

// Build and save per-DJ indexes
let djCount = 0;
for (const [slug, sets] of djSets) {
  const name = djNames.get(slug) || slug;
  const years = [...new Set(sets.map(s => s.year))].sort((a, b) => a - b);
  const festivalList = [...new Set(sets.map(s => s.festival))];

  // Streak
  let bestStreak = 1, curStreak = 1;
  for (let i = 1; i < years.length; i++) {
    if (years[i] === years[i - 1] + 1) { curStreak++; if (curStreak > bestStreak) bestStreak = curStreak; }
    else curStreak = 1;
  }

  // Tracks
  const djTracks = tracksByDJ.get(slug) || new Map();
  let totalUnique = djTracks.size;
  let repeated = 0;
  for (const [, t] of djTracks) {
    if (t.sets.size > 1) repeated++;
  }
  const repeatRate = totalUnique > 0 ? repeated / totalUnique : 0;

  // ID rate
  const withTracks = sets.filter(s => s.tracksTotal > 0 && s.hasSetFile);
  const avgIdRate = withTracks.length > 0
    ? withTracks.reduce((sum, s) => sum + (s.tracksIdentified / s.tracksTotal), 0) / withTracks.length
    : 0;

  // Signature tracks (top played)
  const signatureTracks = [...djTracks.entries()]
    .filter(([, t]) => t.count >= 2)
    .map(([key, t]) => ({
      artist: t.artist,
      title: t.title,
      key,
      count: t.count,
      years: [...t.years].sort((a, b) => a - b),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  // Most supported (tracks by this DJ played by others)
  const supportedTracks = [];
  const nameLower = name.toLowerCase();
  for (const [key, players] of globalTrackPlayers) {
    const entry = djTracks.get(key);
    if (!entry) continue;
    const artistLower = entry.artist.toLowerCase();
    const isDJTrack = artistLower === nameLower ||
      artistLower.startsWith(nameLower + ' ') ||
      artistLower.includes(' ' + nameLower) ||
      artistLower.includes(nameLower + ',');
    if (!isDJTrack) continue;
    const otherCount = [...players].filter(s => s !== slug).length;
    if (otherCount === 0) continue;
    supportedTracks.push({
      artist: entry.artist,
      title: entry.title,
      key,
      playedByCount: otherCount,
    });
  }
  supportedTracks.sort((a, b) => b.playedByCount - a.playedByCount);

  // Timeline
  const timeline = {};
  for (const s of sets) {
    if (!timeline[s.year]) timeline[s.year] = { sets: 0, festivals: [] };
    timeline[s.year].sets++;
    if (!timeline[s.year].festivals.includes(s.festival)) {
      timeline[s.year].festivals.push(s.festival);
    }
  }

  const djIndex = {
    slug,
    name,
    years,
    firstYear: years[0],
    lastYear: years[years.length - 1],
    totalSets: sets.length,
    uniqueYears: years.length,
    streak: bestStreak,
    festivals: festivalList,
    totalUniqueTracks: totalUnique,
    repeatRate: Math.round(repeatRate * 100),
    idRate: Math.round(avgIdRate * 100),
    timeline,
    signatureTracks: signatureTracks.slice(0, 20),
    supportedTracks: supportedTracks.slice(0, 20),
  };

  fs.writeFileSync(path.join(DJ_DIR, `${slug}.json`), JSON.stringify(djIndex));
  djCount++;
}

console.log(`Built ${djCount} DJ indexes in ${DJ_DIR}/`);

// Clean up the old giant track-index.json if it exists
const oldIndex = path.join(DATA_ROOT, 'track-index.json');
if (fs.existsSync(oldIndex)) {
  fs.unlinkSync(oldIndex);
  console.log(`Removed old ${oldIndex}`);
}

// Build track leaderboard + search index
function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function makeTrackSlug(artist, title) {
  const slug = slugify(artist) + '-' + slugify(title);
  return slug.length > 200 ? slug.substring(0, 200) : slug;
}

// Aggregate all tracks with per-year, per-festival, and cross-tab counts
const trackAgg = new Map();
for (const [slug, djTracks] of tracksByDJ) {
  for (const [key, t] of djTracks) {
    if (!trackAgg.has(key)) {
      trackAgg.set(key, {
        artist: t.artist, title: t.title,
        totalPlays: 0, years: new Set(), djs: new Set(), festivals: new Set(),
        yearCounts: {}, festivalCounts: {}, yearFestivalCounts: {},
      });
    }
    const entry = trackAgg.get(key);
    entry.totalPlays += t.count;
    entry.djs.add(slug);
    for (const y of t.years) {
      entry.years.add(y);
      entry.yearCounts[y] = (entry.yearCounts[y] || 0) + t.count;
    }
    // Festival info from set metadata + year-festival cross counts
    for (const tlId of t.sets) {
      const setMeta = allSets.find(s => s.tlId === tlId);
      if (setMeta) {
        entry.festivals.add(setMeta.festival);
        entry.festivalCounts[setMeta.festival] = (entry.festivalCounts[setMeta.festival] || 0) + 1;
        const yfKey = `${setMeta.year}:${setMeta.festival}`;
        entry.yearFestivalCounts[yfKey] = (entry.yearFestivalCounts[yfKey] || 0) + 1;
      }
    }
  }
}

// Build top 500 for the leaderboard page (with full breakdown data)
const leaderboard = [...trackAgg.entries()]
  .map(([key, t]) => ({
    key,
    artist: t.artist,
    title: t.title,
    slug: makeTrackSlug(t.artist, t.title),
    playCount: t.totalPlays,
    years: [...t.years].sort((a, b) => a - b),
    djs: [...t.djs],
    festivals: [...t.festivals],
    yearCounts: t.yearCounts,
    festivalCounts: t.festivalCounts,
    yearFestivalCounts: t.yearFestivalCounts,
  }))
  .sort((a, b) => b.playCount - a.playCount)
  .slice(0, 500);

const lbPath = path.join(DATA_ROOT, 'tracks-leaderboard.json');
fs.writeFileSync(lbPath, JSON.stringify(leaderboard));
console.log(`Saved ${lbPath}: ${leaderboard.length} tracks (${(fs.statSync(lbPath).size / 1024).toFixed(0)}KB)`);

// Build lightweight search index (top 5000, minimal fields)
const searchTracks = [...trackAgg.entries()]
  .sort((a, b) => b[1].totalPlays - a[1].totalPlays)
  .slice(0, 5000)
  .map(([key, t]) => ({
    a: t.artist,
    t: t.title,
    s: makeTrackSlug(t.artist, t.title),
    p: t.totalPlays,
    y: t.years.size,
    d: t.djs.size,
  }));

const searchPath = path.join(DATA_ROOT, 'track-search.json');
fs.writeFileSync(searchPath, JSON.stringify(searchTracks));
console.log(`Saved ${searchPath}: ${searchTracks.length} tracks (${(fs.statSync(searchPath).size / 1024).toFixed(0)}KB)`);

// Build per-track index files for top tracks only (ones people actually visit)
const TRACK_DIR = path.join(DATA_ROOT, 'tracks');
if (!fs.existsSync(TRACK_DIR)) fs.mkdirSync(TRACK_DIR, { recursive: true });
// Clean old files
for (const f of fs.readdirSync(TRACK_DIR)) { try { fs.unlinkSync(path.join(TRACK_DIR, f)); } catch {} }

// Only build indexes for top tracks by play count (keeps file count manageable)
const topTrackKeys = [...trackAppearances.entries()]
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 5000);

const slugToKey = {};
let trackFileCount = 0;
for (const [key, appearances] of topTrackKeys) {
  const parts = key.split('|||');
  const slug = makeTrackSlug(parts[0], parts[1]);
  slugToKey[slug] = key;

  const sorted = appearances.sort((a, b) => b.date.localeCompare(a.date));
  const years = [...new Set(appearances.map(a => a.year))].sort((a, b) => a - b);

  // Streak
  let bestStreak = 1, curStreak = 1, bestStart = years[0];
  for (let i = 1; i < years.length; i++) {
    if (years[i] === years[i - 1] + 1) { curStreak++; if (curStreak > bestStreak) { bestStreak = curStreak; bestStart = years[i] - curStreak + 1; } }
    else curStreak = 1;
  }

  // Orbit by year
  const orbitByYear = {};
  for (const a of appearances) {
    if (!orbitByYear[a.year]) orbitByYear[a.year] = new Set();
    orbitByYear[a.year].add(a.dj);
  }
  const orbitCounts = {};
  for (const [y, s] of Object.entries(orbitByYear)) orbitCounts[y] = s.size;

  const blends = blendAppearances.get(key) || [];

  fs.writeFileSync(path.join(TRACK_DIR, `${slug}.json`), JSON.stringify({
    slug, key, artist: parts[0], title: parts[1],
    history: sorted, years, playCount: appearances.length,
    streak: { streak: bestStreak, startYear: bestStart, endYear: bestStart + bestStreak - 1, totalYears: years.length, years, orbitByYear: orbitCounts },
    blends,
  }));
  trackFileCount++;
}

// Also save slug->key for all tracks (for reverse lookup on track pages)
// Include ALL tracks, not just pre-built ones
for (const [key] of trackAppearances) {
  const parts = key.split('|||');
  const slug = makeTrackSlug(parts[0], parts[1]);
  if (!slugToKey[slug]) slugToKey[slug] = key;
}
const slugMapPath = path.join(DATA_ROOT, 'track-slugs.json');
fs.writeFileSync(slugMapPath, JSON.stringify(slugToKey));

console.log(`Built ${trackFileCount} track indexes in ${TRACK_DIR}/`);
const trackDirSize = (fs.readdirSync(TRACK_DIR).reduce((sum, f) => {
  try { return sum + fs.statSync(path.join(TRACK_DIR, f)).size; } catch { return sum; }
}, 0) / 1024 / 1024).toFixed(1);
console.log(`  Total size: ${trackDirSize}MB`);
console.log(`Saved ${slugMapPath}: ${Object.keys(slugToKey).length} slug mappings (${(fs.statSync(slugMapPath).size / 1024).toFixed(0)}KB)`);
