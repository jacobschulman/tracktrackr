#!/usr/bin/env node
/**
 * prepare-data.mjs — Transform raw scraped UMF data into TrackTrackr format.
 *
 * Input:
 *   ~/Downloads/tracklore_index_complete_1467sets.json
 *   ~/Downloads/umf_miami/{year}/*.json
 *
 * Output:
 *   data/ultra-miami/index.json       (all sets, metadata only)
 *   data/ultra-miami/sets/{tlId}.json  (individual sets with tracks)
 */

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';

// ── Paths ────────────────────────────────────────
const HOME = process.env.HOME;
const INDEX_SRC = join(HOME, 'Downloads', 'tracklore_index_complete_1467sets.json');
const SETS_SRC = join(HOME, 'Downloads', 'umf_miami');
const OUT_DIR = resolve(import.meta.dirname, '..', 'data', 'ultra-miami');
const OUT_SETS = join(OUT_DIR, 'sets');

// ── Known single acts with "&" in their name ────
const SINGLE_ACTS = new Set([
  'Above & Beyond',
  'Aly & Fila',
  'Chase & Status',
  'Dimitri Vegas & Like Mike',
  'Sunnery James & Ryan Marciano',
  'Matisse & Sadko',
  'Axwell & Ingrosso',  // used Axwell Λ Ingrosso but also "Axwell & Ingrosso"
  'Axwell Λ Ingrosso',
  'Galantis', // just in case
  'W&W',
  'Chocolate Puma',
  'Good Times Ahead',
  'Dog Blood',
  'Paris & Simo',
  'Kris Kross Amsterdam',
  'Keys N Krates',
  'Showtek', // duo but single name
  'Sultan + Shepard',
  'Sultan & Shepard',
  'Sick Individuals',
  'DVLM', // abbreviation for Dimitri Vegas & Like Mike
  'Blasterjaxx',
  'Lost Kings',
  'Cheat Codes',
  'Cash Cash',
  'Two Friends',
  'Gabriel & Dresden',
]);

// ── Stage normalization ──────────────────────────
// Light normalization: fix casing, group radio recordings, group ASOT editions,
// but keep meaningfully different stages/events separate.
const STAGE_NORM = {
  // Mainstage variants
  'Main Stage': 'Mainstage',
  'Mainstage (Extra Hour)': 'Mainstage',
  'WORSHIP, Mainstage': 'Mainstage',
  'Day 2': 'Mainstage',

  // Worldwide Stage
  'Retro5pective DJ Set, Worldwide Stage': 'Worldwide Stage',
  'Workshop 007, Worldwide Stage': 'Worldwide Stage',
  'Worldwide Stage, UMF Miami, United States': 'Worldwide Stage',

  // Resistance
  'Carl Cox MegaStructure': 'Carl Cox Megastructure',
  'Carl Cox & Friends': 'Carl Cox & Friends Arena',
  'Carl Cox & Friend Stage': 'Carl Cox & Friends Arena',
  'Carl Cox & Friends, MegaStructure Stage': 'Carl Cox & Friends Arena',
  'Carl Cox & Friends, Megastructure Stage': 'Carl Cox & Friends Arena',
  'Carl Cox & Friends, UMF Miami, United States 2015-03-27': 'Carl Cox & Friends Arena',
  'Carl Cox Arena': 'Carl Cox & Friends Arena',
  'Carl Cox Arena, Megastructure Stage': 'Carl Cox & Friends Arena',
  'Resistance, The Cove': 'Resistance The Cove',
  'The Cove': 'Resistance The Cove',
  'Resistance': 'Resistance Stage',
  'Resistance Megastructure, Hybrid Set': 'Resistance Megastructure',
  'Resistance Cove FCKING SERIOUS Takeover': 'Resistance The Cove',
  'Dirtybird, Resistance The Cove': 'Resistance The Cove',
  'Spectrum, Resistance The Cove': 'Resistance The Cove',
  'HOLO, Resistance Megastructure': 'Resistance Megastructure',
  'Diynamic, Resistance Megastructure': 'Resistance Megastructure',
  'Reflector': 'Resistance Reflector',
  'Resistance Reflector Stage': 'Resistance Reflector',
  'Resistance Arcadia Spider': 'Resistance Stage',

  // Live Stage
  'ANALOG, Live Stage': 'Live Stage',
  'Connected Fighters, Live Stage': 'Live Stage',
  'LASERSHIP, Live Stage': 'Live Stage',
  'PORTALS, Live Stage': 'Live Stage',
  'Live Arena': 'Live Stage',

  // ASOT — group by edition, keeping milestone events distinct
  'ASOT Stage, Worldwide Stage': 'ASOT Stage',
  'ASOT Stage, (Warm-Up Set)': 'ASOT Stage',
  'ASOT Stage Warmup Set': 'ASOT Stage',
  'A State Of Trance Festival': 'ASOT Festival',
  'A State Of Trance Festival Special': 'ASOT Festival',
  'A State Of Trance Festival, Netherlands': 'ASOT Festival',
  'A State Of Trance Festival, UMF Miami, United States': 'ASOT Festival',
  'A State Of Trance Special Warm-Up Set, UMF Miami, United States': 'ASOT Festival',
  'A State Of Trance Special, UMF Miami, United States': 'ASOT Festival',
  'Miami Music Week, United States (UMF Miami, A State Of Trance 500)': 'ASOT 500 Festival',
  'A State Of Trance 550 Invasion Tour, UMF Miami, United States': 'ASOT 550 Festival',
  'A State Of Trance 550 Invasion Tour, United States (UMF Miami, WMC)': 'ASOT 550 Festival',
  '550 Invasion Tour, A State Of Trance Festival': 'ASOT 550 Festival',
  '550 Invasion Tour, A State Of Trance Festival, Netherlands': 'ASOT 550 Festival',
  'A State Of Trance 600 The Expedition, Mega Structure Stage, UMF Miami, United States': 'ASOT 600 Festival',
  'A State Of Trance 600 The Expedition, United States (UMF Miami)': 'ASOT 600 Festival',
  'A State Of Trance 600 The Expedition Warmup Set, United States (UMF Miami)': 'ASOT 600 Festival',
  '600 The Expedition, A State Of Trance Festival': 'ASOT 600 Festival',
  '600 The Expedition, A State Of Trance Festival, Mega Structure Stage': 'ASOT 600 Festival',
  '600 The Expedition, A State Of Trance Festival, Netherlands, Mega Structure Stage': 'ASOT 600 Festival',
  'A State Of Trance 650 New Horizons, UMF Miami, United States': 'ASOT 650 Festival',
  'A State Of Trance 650 New Horizons Warmup Set, UMF Miami, United States': 'ASOT 650 Festival',
  '650 New Horizons, A State Of Trance Festival': 'ASOT 650 Festival',
  '650 New Horizons, A State Of Trance Festival, Netherlands': 'ASOT 650 Festival',
  'A State Of Trance Festival 650 (New Horizons)': 'ASOT 650 Festival',
  'A State Of Trance Festival 700': 'ASOT 700 Festival',
  'A State Of Trance Festival 900': 'ASOT 900 Festival',
  'A State Of Trance Festival 900 (Warm Up Set)': 'ASOT 900 Festival',
  'Megastructure (Together in A State Of Trance)': 'ASOT Festival',
  'ASOT 10th Anniversary, Worldwide Stage': 'ASOT 10th Anniversary',
  '550 Invasion Tour, A State Of Trance Festival Warm-Up, Netherlands': 'ASOT 550 Festival',

  // Carl Cox extras
  'Carl Cox & Friends, Megastructure Stage, UMF Miami, United States': 'Carl Cox & Friends Arena',

  // Gud Vibrations radio → parent stage
  'Gud Vibrations Radio 058 (Worldwide Stage': 'Worldwide Stage',
  'Gud Vibrations Radio 059 (Worldwide Stage': 'Worldwide Stage',

  // Oldschool set
  'Oldschool Set, Revealed Stage': 'Revealed Stage',

  // UMF Radio recordings that reference a stage
  'UMF Radio 549 (UMF Radio Stage by STMPD RCRDS': 'UMF Radio Stage',
  'UMF Radio 669 (UMF Radio Stage by STMPD RCRDS': 'UMF Radio Stage',
  'Sunshine Forecast 020 (Mainstage': 'Mainstage',

  // Other named stages
  'KISS Nights (Purified Stage': 'Purified Stage',
  'OWSLA Stage': 'Owsla Stage',
  'Owsla Stage': 'Owsla Stage',
  'The Oasis': 'Oasis Stage',
  'Mega Structure Stage': 'Megastructure',
  'Space Ibiza Stage': 'Ibiza Space Arena',
  'Groovejet, Winter Music Conference WMC': 'Groovejet Stage',
  'Toolroom Knights': 'Toolroom Stage',
  'Group Therapy': 'Group Therapy Stage',
  'Ultra Ibiza': 'Ultra Worldwide',
  'Biscayne Stage': 'Biscayne Stage',
  'Underground Story Stage': 'Underground Stage',
};

// Patterns that indicate a radio/podcast recording (not a physical stage)
function isRadioRecording(stage) {
  const lower = stage.toLowerCase();
  // Already handled by STAGE_NORM? Skip radio detection
  if (STAGE_NORM[stage]) return false;
  return (
    lower.startsWith('umf radio ') && !lower.includes('umf radio stage') ||
    lower.includes('podcast') ||
    lower.includes('podcat') ||
    (lower.includes('radio ') || lower.includes('radio\u00a0')) && /\d{3,}/.test(stage) && !lower.includes('stage') ||
    lower.startsWith('club edition') ||
    lower.startsWith('drumcode') ||
    lower.startsWith('adam beyer') ||
    lower.startsWith('protocol radio') ||
    lower.startsWith('spectrum radio') && !lower.includes('cove') ||
    lower.startsWith('heartfeldt radio') ||
    lower.startsWith('in the mood') && /\d{3}/.test(stage) ||
    lower.startsWith('miami music week ultra20') ||
    lower.startsWith('bite this') ||
    lower.startsWith('this is sick') ||
    lower.startsWith('edible') ||
    lower.startsWith('the sound of holland') ||
    lower.startsWith('suara podcat') ||
    lower.startsWith('bbc radio') ||
    lower.startsWith('global radio') ||
    lower.startsWith('darklight sessions') ||
    lower.startsWith('fanfare radioshow') ||
    lower.startsWith('identity ') && /\d{3}/.test(stage) ||
    lower.startsWith('incredible ') && /\d{3}/.test(stage) ||
    lower.startsWith('lift off ') && /\d{3}/.test(stage) ||
    lower.startsWith('hardwell on air') ||
    lower.startsWith('3lau haus') ||
    lower.startsWith('promo mix') ||
    lower.startsWith('siriusxm') ||
    lower.startsWith('super you & me') ||
    lower.startsWith('sunshine forecast')
  );
}

// Radio recordings that reference a physical stage should map to that stage
function extractStageFromRadio(stage) {
  // "UMF Radio 560 (Carl Cox Megastructure" → "Carl Cox Megastructure"
  // "UMF Radio 738 (Oasis Stage" → "Oasis Stage"
  const m = stage.match(/\((.+?)(?:\)|$)/);
  if (m) {
    const inner = m[1].trim();
    // If it looks like a stage name, use it
    if (inner.includes('Stage') || inner.includes('Megastructure') ||
        inner.includes('Resistance') || inner.includes('Mainstage') ||
        inner.includes('Cove') || inner.includes('Oasis') ||
        inner.includes('Reflector') || inner.includes('Revealed') ||
        inner.includes('Carl Cox') || inner.includes('STMPD')) {
      return inner;
    }
  }
  return null;
}

function normalizeStage(raw) {
  if (STAGE_NORM[raw]) return STAGE_NORM[raw];

  if (isRadioRecording(raw)) {
    const extracted = extractStageFromRadio(raw);
    if (extracted) {
      // Recursively normalize the extracted stage
      return STAGE_NORM[extracted] || extracted;
    }
    return 'Radio/Podcast';
  }

  // UMF Radio Stage variants (physical stages at the festival)
  if (raw.startsWith('UMF Radio Stage')) return 'UMF Radio Stage';

  return raw;
}

// ── DJ slug generation ───────────────────────────
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseDJs(djString) {
  // Check if the full string is a known single act
  if (SINGLE_ACTS.has(djString)) {
    return [{ name: djString, slug: slugify(djString) }];
  }

  // Check for b2b / & / x separators
  // But be careful: "Above & Beyond" should not split
  // Strategy: try splitting, but check each part against known single acts
  const separators = [' b2b ', ' B2B ', ' x ', ' X '];
  for (const sep of separators) {
    if (djString.includes(sep)) {
      return djString.split(sep).map(name => ({
        name: name.trim(),
        slug: slugify(name.trim()),
      }));
    }
  }

  // Split on " & " but be cautious
  if (djString.includes(' & ')) {
    // If the whole name is in single acts, don't split
    // Otherwise, split
    const parts = djString.split(' & ');
    // Heuristic: if any recombination of parts is a known single act, don't split
    // Simple approach: just split on " & " since we already checked the full name
    return parts.map(name => ({
      name: name.trim(),
      slug: slugify(name.trim()),
    }));
  }

  return [{ name: djString, slug: slugify(djString) }];
}


// ── Main ─────────────────────────────────────────
console.log('Loading index...');
const indexRaw = JSON.parse(readFileSync(INDEX_SRC, 'utf-8'));
const indexSets = Object.values(indexRaw.sets);
console.log(`  Index entries: ${indexSets.length}`);

// Load all set files
console.log('Loading set files...');
const setFiles = new Map(); // tlId -> data
let dupes = 0;
const years = readdirSync(SETS_SRC).filter(y => /^\d{4}$/.test(y)).sort();

for (const year of years) {
  const yearDir = join(SETS_SRC, year);
  const files = readdirSync(yearDir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    try {
      const data = JSON.parse(readFileSync(join(yearDir, file), 'utf-8'));
      const tlId = data.tlId;
      if (!tlId) {
        console.warn(`  WARN: no tlId in ${year}/${file}`);
        continue;
      }
      if (setFiles.has(tlId)) {
        dupes++;
        // Keep the one with more tracks, or longer filename (less truncated)
        const existing = setFiles.get(tlId);
        const existingTrackCount = (existing.tracks || []).length;
        const newTrackCount = (data.tracks || []).length;
        if (newTrackCount > existingTrackCount) {
          setFiles.set(tlId, data);
        }
      } else {
        setFiles.set(tlId, data);
      }
    } catch (e) {
      console.warn(`  WARN: failed to parse ${year}/${file}: ${e.message}`);
    }
  }
}
console.log(`  Set files loaded: ${setFiles.size} (${dupes} duplicates resolved)`);

// Build output index
console.log('Building index...');
const outputSets = [];
const allStages = new Set();
const allDJSlugs = new Map(); // slug -> name

for (const entry of indexSets) {
  const tlId = entry.tlId;
  const hasSetFile = setFiles.has(tlId);
  const setData = setFiles.get(tlId);

  // Determine djs array
  let djs;
  if (setData && setData.djs && setData.djs.length > 0) {
    djs = setData.djs;
  } else {
    djs = parseDJs(entry.dj);
  }

  // Stage normalization
  const stageRaw = (setData ? setData.stage : entry.stage) || 'Unknown Stage';
  const stage = normalizeStage(stageRaw);
  allStages.add(stage);

  // Track djs
  for (const d of djs) {
    if (!allDJSlugs.has(d.slug) || d.name.length > allDJSlugs.get(d.slug).length) {
      allDJSlugs.set(d.slug, d.name);
    }
  }

  outputSets.push({
    tlId,
    dj: entry.dj,
    djs,
    stage,
    stageRaw,
    date: entry.date,
    year: entry.year,
    genre: entry.genre || '',
    tracksIdentified: entry.tracksIdentified || 0,
    tracksTotal: entry.tracksTotal || 0,
    duration: entry.duration || '',
    views: entry.views || 0,
    likes: entry.likes || 0,
    url: entry.url || '',
    hasSetFile,
  });
}

// Sort by date desc, then dj name
outputSets.sort((a, b) => {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.dj.localeCompare(b.dj);
});

// Collect years
const yearsInData = [...new Set(outputSets.map(s => s.year))].sort((a, b) => a - b);

const indexOutput = {
  festival: 'ultra-miami',
  festivalName: 'Ultra Music Festival Miami',
  years: yearsInData,
  totalSets: outputSets.length,
  scrapedSets: outputSets.filter(s => s.hasSetFile).length,
  stages: [...allStages].sort(),
  sets: outputSets,
};

// Write index
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(OUT_SETS, { recursive: true });
writeFileSync(join(OUT_DIR, 'index.json'), JSON.stringify(indexOutput));
console.log(`  Wrote index.json (${outputSets.length} sets, ${(JSON.stringify(indexOutput).length / 1024).toFixed(0)} KB)`);

// Write individual set files
console.log('Writing set files...');
let totalTracks = 0;
let totalBlends = 0;
let uniqueTracks = new Set();
let setsWritten = 0;

for (const [tlId, data] of setFiles) {
  const indexEntry = outputSets.find(s => s.tlId === tlId);
  if (!indexEntry) {
    console.warn(`  WARN: set ${tlId} not in index, skipping`);
    continue;
  }

  // Filter out ID/unidentified tracks
  const isIDTrack = (artist, title) => {
    const a = (artist || '').trim().toUpperCase();
    const t = (title || '').trim().toUpperCase();
    return a === 'ID' || t === 'ID' || a === '' || t === '' || t === 'ID?' || a === 'ID?';
  };

  const tracks = (data.tracks || [])
    .filter(t => !isIDTrack(t.artist, t.title))
    .map(t => ({
      pos: t.pos,
      artist: t.artist || '',
      title: t.title || '',
      remix: t.remix || '',
      label: t.label || '',
      trackId: t.trackId || '',
      type: t.type || 'normal',
      blendGroup: t.blendGroup ? t.blendGroup.filter(bg => !isIDTrack(bg.artist, bg.title)) : null,
    }));

  // Count stats
  for (const t of tracks) {
    if (t.type === 'normal') {
      totalTracks++;
      const key = `${t.artist.toLowerCase().trim()}|||${t.title.toLowerCase().trim()}`;
      uniqueTracks.add(key);
    }
    if (t.type === 'blend') {
      totalBlends++;
    }
  }

  const setOutput = {
    tlId,
    dj: data.dj,
    djs: indexEntry.djs,
    stage: indexEntry.stage,
    stageRaw: indexEntry.stageRaw,
    date: data.date,
    year: data.year,
    genre: data.genre || '',
    tracksIdentified: data.tracksIdentified || 0,
    tracksTotal: data.tracksTotal || 0,
    duration: data.duration || '',
    views: data.views || 0,
    likes: data.likes || 0,
    url: data.url || '',
    tracks,
  };

  writeFileSync(join(OUT_SETS, `${tlId}.json`), JSON.stringify(setOutput));
  setsWritten++;
}

console.log(`  Wrote ${setsWritten} set files`);

// Summary
console.log('\n═══ SUMMARY ═══');
console.log(`Total sets in index: ${outputSets.length}`);
console.log(`Scraped sets:        ${setsWritten}`);
console.log(`Years covered:       ${yearsInData[0]}–${yearsInData[yearsInData.length - 1]} (${yearsInData.length} years)`);
console.log(`Unique DJs:          ${allDJSlugs.size}`);
console.log(`Total normal tracks: ${totalTracks}`);
console.log(`Unique tracks:       ${uniqueTracks.size}`);
console.log(`Total blend events:  ${totalBlends}`);
console.log(`Stages:              ${allStages.size}`);
console.log(`  ${[...allStages].sort().join('\n  ')}`);
console.log(`\nIndex size: ${(JSON.stringify(indexOutput).length / 1024).toFixed(0)} KB`);
console.log(`Sets dir size: ~${(setsWritten * 13).toFixed(0)} KB (est.)`);
console.log('\nDone!');
