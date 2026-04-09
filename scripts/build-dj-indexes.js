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

    for (const t of tracks) {
      const artist = stripFeaturing(t.artist);
      const title = stripRemix(t.title);
      const key = trackKey(artist, title);
      const year = data.year;

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

// Build lightweight track search index
const trackSearchEntries = [];
const trackSearchMap = new Map(); // key -> { artist, title, playCount, years, djs }
for (const [slug, djTracks] of tracksByDJ) {
  for (const [key, t] of djTracks) {
    if (!trackSearchMap.has(key)) {
      trackSearchMap.set(key, { a: t.artist, t: t.title, p: 0, y: new Set(), d: new Set() });
    }
    const entry = trackSearchMap.get(key);
    entry.p += t.count;
    for (const y of t.years) entry.y.add(y);
    entry.d.add(slug);
  }
}
for (const [key, t] of trackSearchMap) {
  trackSearchEntries.push({
    a: t.a,
    t: t.t,
    s: '', // computed below
    p: t.p,
    y: t.y.size,
    d: t.d.size,
  });
}
// Sort by play count, take top 5000 for search
trackSearchEntries.sort((a, b) => b.p - a.p);
const topTracks = trackSearchEntries.slice(0, 5000);

// Compute slugs
function slugify(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
function makeTrackSlug(artist, title) {
  return slugify(artist) + '-' + slugify(title);
}
for (const t of topTracks) {
  t.s = makeTrackSlug(t.a, t.t);
}

const searchPath = path.join(DATA_ROOT, 'track-search.json');
fs.writeFileSync(searchPath, JSON.stringify(topTracks));
console.log(`Saved ${searchPath}: ${topTracks.length} tracks (${(fs.statSync(searchPath).size / 1024).toFixed(0)}KB)`);
