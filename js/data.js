/**
 * data.js — TrackTrackr data loading and query helpers
 *
 * All functions that touch data live here. Views import what they need.
 */

import { CONFIG } from './config.js';

// ── Cache ──────────────────────────────────────────
let _index = null;
const _setCache = new Map();
let _allSetsLoaded = false;
let _trackIndex = null;      // Map<trackKey, appearance[]>
let _blendIndex = null;       // Map<trackKey, blendAppearance[]>

// ── Track key helper ───────────────────────────────
export function trackKey(artist, title) {
  return (artist || '').toLowerCase().trim() + '|||' + (title || '').toLowerCase().trim();
}

export function parseTrackKey(key) {
  const [artist, title] = key.split('|||');
  return { artist: artist || '', title: title || '' };
}

function isIDTrack(artist, title) {
  const a = (artist || '').toLowerCase().trim();
  const t = (title || '').toLowerCase().trim();
  return a === 'id' || t === 'id' || a === '' || t === '' ||
    t.startsWith('id (') || t === 'id?' || a === 'id?';
}

// ── Canonical track grouping ──────────────────────
// Strips remix/edit/bootleg suffixes and expands mashups ("vs.")
// so all variants of a track are counted together.

function _stripRemix(title) {
  const stripped = title
    .replace(/\s*[\(\[][^\)\]]*\b(remix|edit|bootleg|mashup|flip|mix|rework|version|vip|dub|re-?edit|tribute|instrumental|intro|original|feat\.?|ft\.?|featuring)\b[^\)\]]*[\)\]]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return stripped || title;
}

function _stripFeaturing(artist) {
  const stripped = artist
    .replace(/\s+(?:ft\.?|feat\.?|featuring)\s+.*/i, '')
    .trim();
  return stripped || artist;
}

function _expandTrack(artist, title) {
  const cleanTitle = _stripRemix(title);
  const titleParts = cleanTitle.split(/\s+vs\.?\s+/i);

  if (titleParts.length > 1) {
    const artistParts = artist.split(/\s+vs\.?\s+/i);
    return titleParts.map((tp, i) => {
      const a = _stripFeaturing((artistParts[i] || artistParts[0]).trim());
      const t = tp.trim();
      return { artist: a, title: t, key: trackKey(a, t), titleOnly: t.toLowerCase().trim() };
    }).filter(p => !isIDTrack(p.artist, p.title));
  }

  const canonArtist = _stripFeaturing(artist);
  return [{ artist: canonArtist, title: cleanTitle, key: trackKey(canonArtist, cleanTitle), titleOnly: null }];
}

// ═══════════════════════════════════════════════════
// Loading
// ═══════════════════════════════════════════════════

export async function loadIndex(festival) {
  if (_index) return _index;
  const base = festival ? `data/${festival}` : CONFIG.dataBase;
  const res = await fetch(`${base}/index.json`);
  if (!res.ok) throw new Error(`Failed to load index: ${res.status}`);
  _index = await res.json();
  return _index;
}

export async function loadSet(tlId, festival) {
  if (_setCache.has(tlId)) return _setCache.get(tlId);
  const base = festival ? `data/${festival}` : CONFIG.dataBase;
  const res = await fetch(`${base}/sets/${tlId}.json`);
  if (!res.ok) return null;
  const data = await res.json();
  _setCache.set(tlId, data);
  return data;
}

export async function loadAllSets(festival, onProgress) {
  if (_allSetsLoaded) return;
  const index = await loadIndex(festival);
  const scraped = index.sets.filter(s => s.hasSetFile);
  let loaded = 0;

  // Batch in chunks of 25 concurrent
  const BATCH = 25;
  for (let i = 0; i < scraped.length; i += BATCH) {
    const batch = scraped.slice(i, i + BATCH);
    await Promise.all(batch.map(s => loadSet(s.tlId, festival)));
    loaded += batch.length;
    if (onProgress) onProgress(loaded, scraped.length);
  }

  _buildTrackIndex();
  _buildBlendIndex();
  _allSetsLoaded = true;
}

export function isAllLoaded() { return _allSetsLoaded; }

// ── Build indexes after all sets loaded ────────────
function _buildTrackIndex() {
  _trackIndex = new Map();
  // First pass: index all tracks normally
  const pendingTitleLookups = []; // mashup sub-tracks that might need title-based resolution
  for (const [tlId, setData] of _setCache) {
    if (!setData || !setData.tracks) continue;
    const seenCanonical = new Set(); // dedup within a single set
    // Collect all DJ slugs including aliases for this set
    const djSlugs = _collectDJSlugs(setData.djs);
    for (const t of setData.tracks) {
      // Count both normal and blend tracks as plays
      if (t.type !== 'normal' && t.type !== 'blend') continue;
      if (isIDTrack(t.artist, t.title)) continue;

      const expanded = _expandTrack(t.artist, t.title);
      const appearance = {
        tlId, pos: t.pos, year: setData.year, dj: setData.dj,
        djSlugs, stage: setData.stage, date: setData.date,
        label: t.label || '', remix: t.remix || '',
      };
      for (const { artist, title, key, titleOnly } of expanded) {
        // Only count each canonical track once per set
        const dedupKey = `${tlId}|||${key}`;
        if (seenCanonical.has(dedupKey)) continue;
        seenCanonical.add(dedupKey);

        if (!_trackIndex.has(key)) _trackIndex.set(key, []);
        _trackIndex.get(key).push({ ...appearance, artist, title });

        // If this came from a mashup expansion, remember it for title-based resolution
        if (titleOnly) {
          pendingTitleLookups.push({ key, titleOnly, tlId, seenCanonical, appearance: { ...appearance, artist, title } });
        }
      }
    }
  }

  // Second pass: for mashup sub-tracks, try to find an existing canonical entry
  // by matching title AND requiring artist word overlap.
  // Resolved plays are tagged matchType:'mashup' so the UI can flag them.
  const titleToCanonical = new Map();
  for (const [key, apps] of _trackIndex) {
    const title = key.split('|||')[1];
    if (!title) continue;
    if (!titleToCanonical.has(title)) titleToCanonical.set(title, []);
    titleToCanonical.get(title).push(key);
  }

  const _artistWords = (a) => {
    const words = new Set();
    for (const w of a.toLowerCase().split(/[\s&,]+/)) {
      if (w.length > 2 && !['the','and','vs','feat','ft'].includes(w)) words.add(w);
    }
    return words;
  };
  const _artistsOverlap = (a1, a2) => {
    const w1 = _artistWords(a1), w2 = _artistWords(a2);
    for (const w of w1) { if (w2.has(w)) return true; }
    return false;
  };

  let resolved = 0;
  for (const { key, titleOnly, tlId, seenCanonical, appearance } of pendingTitleLookups) {
    const mashupArtist = key.split('|||')[0];
    const candidates = titleToCanonical.get(titleOnly) || [];

    // Filter: must share artist words AND have >= 2 plays
    const eligible = [];
    for (const ck of candidates) {
      if (ck === key) continue;
      const apps = _trackIndex.get(ck);
      if (!apps || apps.length < 2) continue;
      if (_artistsOverlap(mashupArtist, ck.split('|||')[0])) {
        eligible.push({ key: ck, count: apps.length });
      }
    }
    if (eligible.length === 0) continue;

    // Pick best candidate; require 2x dominance over runner-up
    eligible.sort((a, b) => b.count - a.count);
    const best = eligible[0];
    const second = eligible[1];

    // If ambiguous, only resolve if all candidates overlap with each other (same song, formatting variants)
    if (second && best.count < second.count * 2) {
      const allOverlap = eligible.every((a, i) =>
        eligible.every((b, j) => i === j || _artistsOverlap(a.key.split('|||')[0], b.key.split('|||')[0]))
      );
      if (!allOverlap) continue;
    }

    const dedupKey = `${tlId}|||${best.key}`;
    if (seenCanonical.has(dedupKey)) continue;
    seenCanonical.add(dedupKey);

    const canonApps = _trackIndex.get(best.key);
    if (canonApps) {
      // Tag as mashup-inferred so the UI can flag it
      canonApps.push({ ...appearance, artist: canonApps[0].artist, title: canonApps[0].title, matchType: 'mashup-inferred' });
      resolved++;
    }
  }
  if (resolved > 0) console.log(`[data] Resolved ${resolved} mashup sub-tracks via title+artist matching`);
}

// Collect all slugs for a set's DJs, including their aliases
function _collectDJSlugs(djs) {
  if (!djs) return [];
  const slugs = new Set();
  for (const d of djs) {
    slugs.add(d.slug);
    if (d.aliases) {
      for (const a of d.aliases) slugs.add(a);
    }
  }
  return [...slugs];
}

function _buildBlendIndex() {
  _blendIndex = new Map();
  for (const [tlId, setData] of _setCache) {
    if (!setData || !setData.tracks) continue;
    for (const t of setData.tracks) {
      if (!t.blendGroup || t.blendGroup.length < 2) continue;
      for (const bg of t.blendGroup) {
        if (isIDTrack(bg.artist, bg.title)) continue;
        const key = trackKey(bg.artist, bg.title);
        const pairedWith = t.blendGroup
          .filter(x => trackKey(x.artist, x.title) !== key)
          .map(x => ({ artist: x.artist, title: x.title, remix: x.remix || '' }));

        if (pairedWith.length === 0) continue;
        if (!_blendIndex.has(key)) _blendIndex.set(key, []);
        _blendIndex.get(key).push({
          tlId,
          year: setData.year,
          dj: setData.dj,
          djSlugs: (setData.djs || []).map(d => d.slug),
          stage: setData.stage,
          date: setData.date,
          pairedWith,
        });
      }
    }
  }
}


// ═══════════════════════════════════════════════════
// Track helpers
// ═══════════════════════════════════════════════════

export function getTopTracks(n = 25, filters = {}) {
  if (!_trackIndex) return [];
  const result = [];

  for (const [key, appearances] of _trackIndex) {
    let filtered = appearances;
    if (filters.year) filtered = filtered.filter(a => a.year === filters.year);
    if (filters.stage) filtered = filtered.filter(a => a.stage === filters.stage);
    if (filters.djSlug) filtered = filtered.filter(a => a.djSlugs.includes(filters.djSlug));

    if (filtered.length === 0) continue;

    const years = [...new Set(filtered.map(a => a.year))].sort();
    const djs = [...new Set(filtered.map(a => a.dj))];
    const tlIds = [...new Set(filtered.map(a => a.tlId))];

    result.push({
      artist: filtered[0].artist,
      title: filtered[0].title,
      remix: filtered[0].remix,
      key,
      playCount: filtered.length,
      years,
      djs,
      tlIds,
      label: filtered[0].label,
    });
  }

  result.sort((a, b) => b.playCount - a.playCount || a.artist.localeCompare(b.artist));
  return result.slice(0, n);
}

export function getTrackHistory(artist, title) {
  if (!_trackIndex) return [];
  const key = trackKey(artist, title);
  const appearances = _trackIndex.get(key) || [];
  return [...appearances].sort((a, b) => b.date.localeCompare(a.date));
}

export function getTrackStreak(artist, title) {
  if (!_trackIndex) return { streak: 0, startYear: null, endYear: null, totalYears: 0, orbitByYear: {} };
  const key = trackKey(artist, title);
  const appearances = _trackIndex.get(key) || [];
  const years = [...new Set(appearances.map(a => a.year))].sort((a, b) => a - b);

  if (years.length === 0) return { streak: 0, startYear: null, endYear: null, totalYears: 0, orbitByYear: {} };

  // Longest consecutive run
  let best = 1, cur = 1, bestStart = years[0], curStart = years[0];
  for (let i = 1; i < years.length; i++) {
    if (years[i] === years[i - 1] + 1) {
      cur++;
      if (cur > best) {
        best = cur;
        bestStart = curStart;
      }
    } else {
      cur = 1;
      curStart = years[i];
    }
  }

  // Orbit = unique DJs per year
  const orbitByYear = {};
  for (const a of appearances) {
    if (!orbitByYear[a.year]) orbitByYear[a.year] = new Set();
    orbitByYear[a.year].add(a.dj);
  }
  const orbit = {};
  for (const [y, s] of Object.entries(orbitByYear)) orbit[y] = s.size;

  return {
    streak: best,
    startYear: bestStart,
    endYear: bestStart + best - 1,
    totalYears: years.length,
    years,
    orbitByYear: orbit,
  };
}

export function getBlendAppearances(artist, title) {
  if (!_blendIndex) return [];
  const key = trackKey(artist, title);
  return _blendIndex.get(key) || [];
}


// ═══════════════════════════════════════════════════
// DJ helpers
// ═══════════════════════════════════════════════════

export function getDJHistory(slug) {
  if (!_index) return [];
  // Build set of slugs to match: the slug itself + any alias that references it
  const matchSlugs = _getDJSlugsWithAliases(slug);
  return _index.sets
    .filter(s => s.djs.some(d => matchSlugs.has(d.slug)))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Get all slugs that represent the same person/act
function _getDJSlugsWithAliases(slug) {
  if (!_index) return new Set([slug]);
  const result = new Set([slug]);
  // Find any DJ entry with this slug and collect its aliases
  for (const s of _index.sets) {
    for (const d of s.djs) {
      if (d.slug === slug && d.aliases) {
        for (const a of d.aliases) result.add(a);
      }
      // Also check if any DJ lists this slug as an alias
      if (d.aliases && d.aliases.includes(slug)) {
        result.add(d.slug);
      }
    }
  }
  return result;
}

export function getDJStats(slug) {
  const history = getDJHistory(slug);
  if (history.length === 0) return null;

  const name = history[0].djs.find(d => d.slug === slug)?.name || slug;
  const years = [...new Set(history.map(s => s.year))].sort((a, b) => a - b);
  const stages = {};
  for (const s of history) {
    stages[s.stage] = (stages[s.stage] || 0) + 1;
  }

  // Streak
  const streak = _longestConsecutive(years);

  // Identification rate
  const withTracks = history.filter(s => s.tracksTotal > 0);
  const idRate = withTracks.length > 0
    ? withTracks.reduce((sum, s) => sum + (s.tracksIdentified / s.tracksTotal), 0) / withTracks.length
    : 0;

  // B2B partners
  const b2bPartners = new Map();
  for (const s of history) {
    if (s.djs.length > 1) {
      for (const d of s.djs) {
        if (d.slug === slug) continue;
        if (!b2bPartners.has(d.slug)) {
          b2bPartners.set(d.slug, { slug: d.slug, name: d.name, count: 0, years: [] });
        }
        const p = b2bPartners.get(d.slug);
        p.count++;
        if (!p.years.includes(s.year)) p.years.push(s.year);
      }
    }
  }

  // Anthems (tracks played in 2+ different years) — requires loaded sets
  let anthems = [];
  if (_trackIndex) {
    const djTracks = new Map();
    for (const [key, appearances] of _trackIndex) {
      const djApps = appearances.filter(a => a.djSlugs.includes(slug));
      if (djApps.length === 0) continue;
      const trackYears = [...new Set(djApps.map(a => a.year))];
      if (trackYears.length >= 2) {
        anthems.push({
          key,
          artist: djApps[0].artist,
          title: djApps[0].title,
          years: trackYears.sort((a, b) => a - b),
          count: djApps.length,
        });
      }
    }
    anthems.sort((a, b) => b.years.length - a.years.length || b.count - a.count);
  }

  return {
    name,
    slug,
    firstYear: years[0],
    lastYear: years[years.length - 1],
    totalSets: history.length,
    uniqueYears: years.length,
    years,
    stageBreakdown: stages,
    identificationRate: idRate,
    streakYears: streak.streak,
    streakStart: streak.startYear,
    streakEnd: streak.endYear,
    gapYears: streak.gapYears,
    b2bPartners: [...b2bPartners.values()].sort((a, b) => b.count - a.count),
    anthems: anthems.slice(0, 20),
  };
}

export function getDJStreak(slug) {
  const history = getDJHistory(slug);
  const years = [...new Set(history.map(s => s.year))].sort((a, b) => a - b);
  return _longestConsecutive(years);
}

function _longestConsecutive(years) {
  if (years.length === 0) return { streak: 0, startYear: null, endYear: null, allYears: [], gapYears: [] };

  let best = 1, cur = 1, bestStart = years[0], curStart = years[0];
  for (let i = 1; i < years.length; i++) {
    if (years[i] === years[i - 1] + 1) {
      cur++;
      if (cur > best) {
        best = cur;
        bestStart = curStart;
      }
    } else {
      cur = 1;
      curStart = years[i];
    }
  }

  const allYears = years;
  const gapYears = [];
  if (years.length >= 2) {
    for (let y = years[0]; y <= years[years.length - 1]; y++) {
      if (!years.includes(y)) gapYears.push(y);
    }
  }

  return {
    streak: best,
    startYear: bestStart,
    endYear: bestStart + best - 1,
    allYears,
    gapYears,
  };
}

export function getDJRepeatRate(slug) {
  if (!_trackIndex) return { repeatedTracks: 0, totalUniqueTracks: 0, repeatRate: 0 };

  const trackSets = new Map(); // trackKey -> Set<tlId>
  for (const [key, appearances] of _trackIndex) {
    const djApps = appearances.filter(a => a.djSlugs.includes(slug));
    if (djApps.length > 0) {
      trackSets.set(key, new Set(djApps.map(a => a.tlId)));
    }
  }

  const total = trackSets.size;
  const repeated = [...trackSets.values()].filter(s => s.size > 1).length;

  return {
    repeatedTracks: repeated,
    totalUniqueTracks: total,
    repeatRate: total > 0 ? repeated / total : 0,
  };
}

export function getDJPopularTracks(slug, djName) {
  if (!_trackIndex) return [];
  const nameLower = djName.toLowerCase();
  const results = [];

  for (const [key, appearances] of _trackIndex) {
    // Check if the artist field contains this DJ's name
    const artistLower = appearances[0].artist.toLowerCase();
    if (!artistLower.includes(nameLower)) continue;

    // Count plays by OTHER DJs (not this slug)
    const otherDJPlays = appearances.filter(a => !a.djSlugs.includes(slug));
    if (otherDJPlays.length === 0) continue;

    const otherDJs = [...new Set(otherDJPlays.map(a => a.dj))];
    results.push({
      artist: appearances[0].artist,
      title: appearances[0].title,
      key,
      totalPlays: appearances.length,
      otherDJPlays: otherDJPlays.length,
      otherDJCount: otherDJs.length,
      otherDJs,
    });
  }

  results.sort((a, b) => b.otherDJPlays - a.otherDJPlays);
  return results.slice(0, 20);
}

export function getTastemakers(n = 20) {
  if (!_trackIndex) return [];

  // For each track with 3+ total plays, find the DJ who played it earliest
  const djFirstPlays = new Map(); // slug -> { count, examples }

  for (const [key, appearances] of _trackIndex) {
    if (appearances.length < 3) continue;

    // Find earliest appearance
    const sorted = [...appearances].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0];
    const firstYear = first.year;

    // Did others play it later?
    const laterDJs = new Set();
    for (const a of sorted.slice(1)) {
      if (a.year > firstYear) {
        for (const s of a.djSlugs) {
          if (!first.djSlugs.includes(s)) laterDJs.add(s);
        }
      }
    }

    if (laterDJs.size === 0) continue;

    for (const firstSlug of first.djSlugs) {
      if (!djFirstPlays.has(firstSlug)) {
        djFirstPlays.set(firstSlug, { count: 0, examples: [] });
      }
      const entry = djFirstPlays.get(firstSlug);
      entry.count++;
      if (entry.examples.length < 5) {
        entry.examples.push({ artist: first.artist, title: first.title, year: firstYear, key });
      }
    }
  }

  // Find DJ names
  const result = [];
  for (const [slug, data] of djFirstPlays) {
    const djName = _getDJName(slug);
    result.push({
      slug,
      name: djName,
      firstPlays: data.count,
      examples: data.examples,
    });
  }

  result.sort((a, b) => b.firstPlays - a.firstPlays);
  return result.slice(0, n);
}

function _getDJName(slug) {
  if (!_index) return slug;
  for (const s of _index.sets) {
    const dj = s.djs.find(d => d.slug === slug);
    if (dj) return dj.name;
  }
  return slug;
}


// ═══════════════════════════════════════════════════
// B2B helpers
// ═══════════════════════════════════════════════════

export function getB2BSets() {
  if (!_index) return [];
  const pairs = new Map();

  for (const s of _index.sets) {
    if (s.djs.length < 2) continue;
    // Create sorted slug pair for grouping
    const slugs = s.djs.map(d => d.slug).sort();
    const pairKey = slugs.join('|||');

    if (!pairs.has(pairKey)) {
      pairs.set(pairKey, {
        djs: s.djs.sort((a, b) => a.slug.localeCompare(b.slug)),
        sets: [],
        years: new Set(),
      });
    }
    const p = pairs.get(pairKey);
    p.sets.push(s);
    p.years.add(s.year);
  }

  return [...pairs.values()]
    .map(p => ({
      ...p,
      count: p.sets.length,
      years: [...p.years].sort((a, b) => a - b),
    }))
    .sort((a, b) => b.count - a.count);
}

export function getB2BDetail(slug1, slug2) {
  if (!_index) return null;
  const slugs = [slug1, slug2].sort();
  const all = _index.sets;

  const jointSets = all.filter(s =>
    s.djs.some(d => d.slug === slugs[0]) && s.djs.some(d => d.slug === slugs[1])
  );

  const soloSets1 = all.filter(s =>
    s.djs.length === 1 && s.djs[0].slug === slugs[0]
  );
  const soloSets2 = all.filter(s =>
    s.djs.length === 1 && s.djs[0].slug === slugs[1]
  );

  // If sets loaded, find common tracks
  let tracksInCommon = [];
  let uniqueToJoint = [];

  if (_trackIndex) {
    const jointTracks = new Set();
    const solo1Tracks = new Set();
    const solo2Tracks = new Set();

    for (const [key, appearances] of _trackIndex) {
      for (const a of appearances) {
        const inJoint = jointSets.some(s => s.tlId === a.tlId);
        const inSolo1 = soloSets1.some(s => s.tlId === a.tlId);
        const inSolo2 = soloSets2.some(s => s.tlId === a.tlId);

        if (inJoint) jointTracks.add(key);
        if (inSolo1) solo1Tracks.add(key);
        if (inSolo2) solo2Tracks.add(key);
      }
    }

    tracksInCommon = [...solo1Tracks].filter(k => solo2Tracks.has(k)).map(k => {
      const a = _trackIndex.get(k)?.[0];
      return a ? { key: k, artist: a.artist, title: a.title } : null;
    }).filter(Boolean);

    uniqueToJoint = [...jointTracks].filter(k => !solo1Tracks.has(k) && !solo2Tracks.has(k)).map(k => {
      const a = _trackIndex.get(k)?.[0];
      return a ? { key: k, artist: a.artist, title: a.title } : null;
    }).filter(Boolean);
  }

  return { jointSets, soloSets1, soloSets2, tracksInCommon, uniqueToJoint };
}


// ═══════════════════════════════════════════════════
// Year / Stage / Label helpers
// ═══════════════════════════════════════════════════

export function getYearStats(year) {
  if (!_index) return null;
  const sets = _index.sets.filter(s => s.year === year);
  const djSlugs = new Set();
  const stages = {};

  for (const s of sets) {
    for (const d of s.djs) djSlugs.add(d.slug);
    stages[s.stage] = (stages[s.stage] || 0) + 1;
  }

  let topTracks = [];
  let totalBlends = 0;
  let totalTracks = 0;

  if (_trackIndex) {
    topTracks = getTopTracks(10, { year });

    for (const [, setData] of _setCache) {
      if (setData.year !== year) continue;
      if (!setData.tracks) continue;
      for (const t of setData.tracks) {
        if (t.type === 'normal' || t.type === 'blend') totalTracks++;
        if (t.type === 'blend') totalBlends++;
      }
    }
  }

  return {
    year,
    setCount: sets.length,
    uniqueDJs: djSlugs.size,
    stageCount: Object.keys(stages).length,
    stages,
    topTracks,
    totalBlends,
    totalTracks,
    blendRate: totalTracks > 0 ? totalBlends / (totalTracks + totalBlends) : 0,
    sets,
  };
}

export function getStageHistory() {
  if (!_index) return [];
  const stages = new Map();

  for (const s of _index.sets) {
    if (!stages.has(s.stage)) {
      stages.set(s.stage, {
        stage: s.stage,
        years: new Set(),
        totalSets: 0,
      });
    }
    const st = stages.get(s.stage);
    st.years.add(s.year);
    st.totalSets++;
  }

  return [...stages.values()].map(st => {
    const years = [...st.years].sort((a, b) => a - b);
    const firstYear = years[0];
    const lastYear = years[years.length - 1];
    const missingYears = [];
    for (let y = firstYear; y <= lastYear; y++) {
      if (!st.years.has(y)) missingYears.push(y);
    }

    return {
      stage: st.stage,
      firstYear,
      lastYear,
      totalSets: st.totalSets,
      totalYears: years.length,
      appearedYears: years,
      missingYears,
    };
  }).sort((a, b) => b.totalSets - a.totalSets);
}

export function getLabelTimeline() {
  if (!_trackIndex) return [];
  const labels = new Map();

  for (const [, appearances] of _trackIndex) {
    for (const a of appearances) {
      if (!a.label) continue;
      if (!labels.has(a.label)) {
        labels.set(a.label, { label: a.label, totalPlays: 0, playsByYear: {} });
      }
      const l = labels.get(a.label);
      l.totalPlays++;
      l.playsByYear[a.year] = (l.playsByYear[a.year] || 0) + 1;
    }
  }

  // Compute share per year
  const totalByYear = {};
  for (const [, l] of labels) {
    for (const [y, count] of Object.entries(l.playsByYear)) {
      totalByYear[y] = (totalByYear[y] || 0) + count;
    }
  }

  const result = [...labels.values()].map(l => {
    const shareByYear = {};
    let peakYear = null, peakPlays = 0;
    for (const [y, count] of Object.entries(l.playsByYear)) {
      shareByYear[y] = totalByYear[y] > 0 ? count / totalByYear[y] : 0;
      if (count > peakPlays) { peakPlays = count; peakYear = parseInt(y); }
    }
    return { ...l, shareByYear, peakYear, peakPlays };
  });

  result.sort((a, b) => b.totalPlays - a.totalPlays);
  return result;
}


// ═══════════════════════════════════════════════════
// Year Spotlight (for homepage)
// ═══════════════════════════════════════════════════

export function getYearSpotlight(year) {
  if (!_index) return null;

  const yearSets = _index.sets.filter(s => s.year === year);
  if (yearSets.length === 0) return null;

  // DJs this year
  const djMap = new Map();
  for (const s of yearSets) {
    for (const d of s.djs) {
      if (!djMap.has(d.slug)) djMap.set(d.slug, { name: d.name, slug: d.slug, sets: 0 });
      djMap.get(d.slug).sets++;
    }
  }

  // All DJs across all years (for determining debuts/returns)
  const djAllYears = new Map(); // slug -> Set<year>
  for (const s of _index.sets) {
    for (const d of s.djs) {
      if (!djAllYears.has(d.slug)) djAllYears.set(d.slug, new Set());
      djAllYears.get(d.slug).add(s.year);
    }
  }

  // Debuts: DJs whose only year is this year
  const debuts = [];
  for (const [slug, info] of djMap) {
    const allYears = djAllYears.get(slug);
    if (allYears && allYears.size === 1 && allYears.has(year)) {
      debuts.push(info);
    }
  }

  // Comebacks: DJs who returned after 3+ years away
  const comebacks = [];
  for (const [slug, info] of djMap) {
    const allYears = [...(djAllYears.get(slug) || [])].sort((a, b) => a - b);
    const idx = allYears.indexOf(year);
    if (idx > 0) {
      const gap = year - allYears[idx - 1];
      if (gap >= 3) {
        comebacks.push({ ...info, gap, lastSeen: allYears[idx - 1] });
      }
    }
  }
  comebacks.sort((a, b) => b.gap - a.gap);

  // Veterans: DJs with longest streak including this year
  const veterans = [];
  for (const [slug, info] of djMap) {
    const allYears = [...(djAllYears.get(slug) || [])].sort((a, b) => a - b);
    // Count consecutive years ending at `year`
    let streak = 1;
    const idx = allYears.indexOf(year);
    for (let i = idx - 1; i >= 0; i--) {
      if (allYears[i] === allYears[i + 1] - 1) streak++;
      else break;
    }
    if (streak >= 3) {
      veterans.push({ ...info, streak, since: year - streak + 1, totalYears: allYears.length });
    }
  }
  veterans.sort((a, b) => b.streak - a.streak);

  // Stages
  const stages = {};
  for (const s of yearSets) stages[s.stage] = (stages[s.stage] || 0) + 1;

  const result = {
    year,
    setCount: yearSets.length,
    djCount: djMap.size,
    stageCount: Object.keys(stages).length,
    stages,
    debuts,
    comebacks,
    veterans: veterans.slice(0, 10),
    sets: yearSets,
  };

  // Track-dependent data (requires all sets loaded)
  if (_trackIndex) {
    // Top tracks of the year
    result.topTracks = getTopTracks(10, { year });

    // DJs who repeated the most tracks from prior years
    const repeatOffenders = [];
    for (const [slug, info] of djMap) {
      const djTrackKeys = new Set();
      const repeatedFromPriorYears = [];

      for (const [key, apps] of _trackIndex) {
        const thisYearApps = apps.filter(a => a.djSlugs.includes(slug) && a.year === year);
        const priorApps = apps.filter(a => a.djSlugs.includes(slug) && a.year < year);
        if (thisYearApps.length > 0 && priorApps.length > 0) {
          const priorYears = [...new Set(priorApps.map(a => a.year))].sort((a, b) => a - b);
          repeatedFromPriorYears.push({
            key,
            artist: thisYearApps[0].artist,
            title: thisYearApps[0].title,
            priorYears,
          });
        }
        if (thisYearApps.length > 0) djTrackKeys.add(key);
      }

      if (repeatedFromPriorYears.length > 0) {
        repeatOffenders.push({
          ...info,
          repeatedTracks: repeatedFromPriorYears.sort((a, b) => b.priorYears.length - a.priorYears.length),
          totalTracksThisYear: djTrackKeys.size,
          repeatRate: djTrackKeys.size > 0 ? repeatedFromPriorYears.length / djTrackKeys.size : 0,
        });
      }
    }
    repeatOffenders.sort((a, b) => b.repeatedTracks.length - a.repeatedTracks.length);
    result.repeatOffenders = repeatOffenders.slice(0, 10);
  }

  return result;
}


// ═══════════════════════════════════════════════════
// Discoveries
// ═══════════════════════════════════════════════════

export function computeDiscoveries() {
  if (!_trackIndex || !_index) return [];

  const discoveries = [];

  // 1. The Immortal Track — played across most different years
  {
    let best = null;
    for (const [key, apps] of _trackIndex) {
      const years = [...new Set(apps.map(a => a.year))];
      if (!best || years.length > best.yearCount) {
        best = { key, artist: apps[0].artist, title: apps[0].title, yearCount: years.length, years: years.sort((a,b)=>a-b), apps };
      }
    }
    if (best) {
      const orbit = {};
      for (const a of best.apps) {
        if (!orbit[a.year]) orbit[a.year] = new Set();
        orbit[a.year].add(a.dj);
      }
      const orbitByYear = {};
      for (const [y, s] of Object.entries(orbit)) orbitByYear[y] = s.size;

      discoveries.push({
        type: 'immortal-track',
        headline: `${best.artist} — ${best.title} has been played at Ultra in ${best.yearCount} different years`,
        description: `Spanning from ${best.years[0]} to ${best.years[best.years.length-1]}, this track keeps appearing in DJ sets across generations of Ultra lineups. It's been played by ${best.apps.length} total sets.`,
        data: { ...best, orbitByYear },
      });
    }
  }

  // 2. The Ultra Anthem — highest raw play count
  {
    let best = null;
    for (const [key, apps] of _trackIndex) {
      if (!best || apps.length > best.count) {
        const djs = new Set(apps.map(a => a.dj));
        best = { key, artist: apps[0].artist, title: apps[0].title, count: apps.length, uniqueDJs: djs.size, apps };
      }
    }
    if (best) {
      discoveries.push({
        type: 'ultra-anthem',
        headline: `${best.artist} — ${best.title} has been played ${best.count} times by ${best.uniqueDJs} different DJs`,
        description: `The most-played track in Ultra Miami history. ${best.uniqueDJs} unique DJs have reached for this track across their sets.`,
        data: best,
      });
    }
  }

  // 3. The Ultra Veteran — DJ with longest consecutive streak
  {
    let bestDJ = null;
    const slugsSeen = new Set();
    for (const s of _index.sets) {
      for (const d of s.djs) {
        if (slugsSeen.has(d.slug)) continue;
        slugsSeen.add(d.slug);
        const streak = getDJStreak(d.slug);
        if (!bestDJ || streak.streak > bestDJ.streak.streak) {
          bestDJ = { slug: d.slug, name: d.name, streak };
        }
      }
    }
    if (bestDJ && bestDJ.streak.streak > 1) {
      discoveries.push({
        type: 'ultra-veteran',
        headline: `${bestDJ.name} has played Ultra for ${bestDJ.streak.streak} consecutive years (${bestDJ.streak.startYear}–${bestDJ.streak.endYear})`,
        description: `The longest unbroken streak at Ultra Miami. ${bestDJ.name} has appeared in ${bestDJ.streak.allYears.length} total years${bestDJ.streak.gapYears.length > 0 ? `, with ${bestDJ.streak.gapYears.length} gap year(s)` : ''}.`,
        data: bestDJ,
      });
    }
  }

  // 4. The Loyal DJ — highest repeat track rate
  {
    let bestDJ = null;
    const slugsSeen = new Set();
    for (const s of _index.sets) {
      for (const d of s.djs) {
        if (slugsSeen.has(d.slug)) continue;
        slugsSeen.add(d.slug);
        const history = getDJHistory(d.slug);
        const scrapedSets = history.filter(h => h.hasSetFile);
        if (scrapedSets.length < 3) continue; // need enough data
        const rate = getDJRepeatRate(d.slug);
        if (rate.totalUniqueTracks < 10) continue;
        if (!bestDJ || rate.repeatRate > bestDJ.rate) {
          bestDJ = { slug: d.slug, name: d.name, rate: rate.repeatRate, ...rate, setCount: scrapedSets.length };
        }
      }
    }
    if (bestDJ) {
      discoveries.push({
        type: 'loyal-dj',
        headline: `${bestDJ.name} replays ${(bestDJ.rate * 100).toFixed(0)}% of their tracks across Ultra appearances`,
        description: `Out of ${bestDJ.totalUniqueTracks} unique tracks played across ${bestDJ.setCount} sets, ${bestDJ.repeatedTracks} have appeared more than once. The most loyal DJ to their own catalog.`,
        data: bestDJ,
      });
    }
  }

  // 5. The Most Restless DJ — most appearances + lowest repeat rate
  {
    let bestDJ = null;
    const slugsSeen = new Set();
    for (const s of _index.sets) {
      for (const d of s.djs) {
        if (slugsSeen.has(d.slug)) continue;
        slugsSeen.add(d.slug);
        const history = getDJHistory(d.slug);
        const scrapedSets = history.filter(h => h.hasSetFile);
        if (scrapedSets.length < 4) continue;
        const rate = getDJRepeatRate(d.slug);
        if (rate.totalUniqueTracks < 20) continue;
        const score = scrapedSets.length * (1 - rate.repeatRate);
        if (!bestDJ || score > bestDJ.score) {
          bestDJ = {
            slug: d.slug, name: d.name, score,
            repeatRate: rate.repeatRate,
            totalUniqueTracks: rate.totalUniqueTracks,
            setCount: scrapedSets.length,
          };
        }
      }
    }
    if (bestDJ) {
      const uniquePct = ((1 - bestDJ.repeatRate) * 100).toFixed(0);
      discoveries.push({
        type: 'restless-dj',
        headline: `${bestDJ.name} has never played the same set twice — ${uniquePct}% unique tracks across ${bestDJ.setCount} Ultra appearances`,
        description: `With ${bestDJ.totalUniqueTracks} unique tracks across their Ultra career, almost every set brings an entirely fresh selection.`,
        data: bestDJ,
      });
    }
  }

  // 6. The Comeback — DJ or track absent 3+ years then returned
  {
    let bestComeback = null;
    const slugsSeen = new Set();

    // Check DJs
    for (const s of _index.sets) {
      for (const d of s.djs) {
        if (slugsSeen.has(d.slug)) continue;
        slugsSeen.add(d.slug);
        const years = [...new Set(getDJHistory(d.slug).map(h => h.year))].sort((a, b) => a - b);
        if (years.length < 2) continue;
        // Find biggest gap
        let maxGap = 0, gapStart = 0, gapEnd = 0;
        for (let i = 1; i < years.length; i++) {
          const gap = years[i] - years[i - 1] - 1;
          if (gap > maxGap) { maxGap = gap; gapStart = years[i - 1]; gapEnd = years[i]; }
        }
        if (maxGap >= 3 && (!bestComeback || maxGap > bestComeback.gap)) {
          bestComeback = { type: 'dj', name: d.name, slug: d.slug, gap: maxGap, lastBefore: gapStart, returnYear: gapEnd, years };
        }
      }
    }

    // Check tracks
    for (const [key, apps] of _trackIndex) {
      const years = [...new Set(apps.map(a => a.year))].sort((a, b) => a - b);
      if (years.length < 2) continue;
      let maxGap = 0, gapStart = 0, gapEnd = 0;
      for (let i = 1; i < years.length; i++) {
        const gap = years[i] - years[i - 1] - 1;
        if (gap > maxGap) { maxGap = gap; gapStart = years[i - 1]; gapEnd = years[i]; }
      }
      if (maxGap >= 3 && (!bestComeback || maxGap > bestComeback.gap)) {
        bestComeback = { type: 'track', artist: apps[0].artist, title: apps[0].title, key, gap: maxGap, lastBefore: gapStart, returnYear: gapEnd, years };
      }
    }

    if (bestComeback) {
      const label = bestComeback.type === 'dj' ? bestComeback.name : `${bestComeback.artist} — ${bestComeback.title}`;
      discoveries.push({
        type: 'comeback',
        headline: `${label} disappeared from Ultra for ${bestComeback.gap} years, then came back in ${bestComeback.returnYear}`,
        description: `Last seen in ${bestComeback.lastBefore}, ${label} went silent for ${bestComeback.gap} years before returning to Ultra in ${bestComeback.returnYear}.`,
        data: bestComeback,
      });
    }
  }

  // 7. Cultural Hijack — non-headliner artist flooding blends
  {
    // For each year, find the artist appearing most in blend groups
    // who ISN'T a headliner at Ultra that year
    const yearBlendArtists = new Map();
    for (const [, apps] of _blendIndex || new Map()) {
      for (const a of apps) {
        if (!yearBlendArtists.has(a.year)) yearBlendArtists.set(a.year, new Map());
        const ym = yearBlendArtists.get(a.year);
        for (const pw of a.pairedWith) {
          const artistLower = pw.artist.toLowerCase().trim();
          if (artistLower === 'id') continue;
          ym.set(pw.artist, (ym.get(pw.artist) || 0) + 1);
        }
      }
    }

    // Also count direct blend appearances
    for (const [key, apps] of _blendIndex || new Map()) {
      for (const a of apps) {
        const { artist } = parseTrackKey(key);
        if (!yearBlendArtists.has(a.year)) yearBlendArtists.set(a.year, new Map());
        const ym = yearBlendArtists.get(a.year);
        if (artist !== 'id') {
          const displayArtist = a.pairedWith.length > 0 ? apps[0]?.dj : artist; // use first appearance for name
          // We want the artist of the track, not the DJ
          const realArtist = _trackIndex?.get(key)?.[0]?.artist || artist;
          ym.set(realArtist, (ym.get(realArtist) || 0) + 1);
        }
      }
    }

    let bestHijack = null;
    for (const [year, artists] of yearBlendArtists) {
      // Find top blend artist who isn't a headliner
      const headliners = new Set();
      for (const s of _index.sets) {
        if (s.year === year) {
          for (const d of s.djs) headliners.add(d.name.toLowerCase());
        }
      }

      for (const [artist, count] of [...artists.entries()].sort((a, b) => b[1] - a[1])) {
        if (count < 3) break;
        if (headliners.has(artist.toLowerCase())) continue;
        if (!bestHijack || count > bestHijack.count) {
          bestHijack = { year, artist, count };
        }
        break; // only top per year
      }
    }

    if (bestHijack) {
      discoveries.push({
        type: 'cultural-hijack',
        headline: `${bestHijack.year} was the year of ${bestHijack.artist} — their music appeared in ${bestHijack.count} sets as a blend source`,
        description: `Without playing their own set at Ultra, ${bestHijack.artist}'s music was woven into ${bestHijack.count} different DJ sets through blends and mashups.`,
        data: bestHijack,
      });
    }
  }

  // 8. Blend Longevity — track used in blends across most years/DJs
  {
    let bestBlend = null;
    for (const [key, apps] of _blendIndex || new Map()) {
      const years = new Set(apps.map(a => a.year));
      const djs = new Set(apps.map(a => a.dj));
      const score = years.size * djs.size;
      if (!bestBlend || score > bestBlend.score) {
        const { artist, title } = parseTrackKey(key);
        const realArtist = apps.length > 0 ? (_trackIndex?.get(key)?.[0]?.artist || artist) : artist;
        const realTitle = apps.length > 0 ? (_trackIndex?.get(key)?.[0]?.title || title) : title;
        bestBlend = { key, artist: realArtist, title: realTitle, yearCount: years.size, djCount: djs.size, score, years: [...years].sort((a,b)=>a-b) };
      }
    }
    if (bestBlend) {
      discoveries.push({
        type: 'blend-longevity',
        headline: `${bestBlend.artist} — ${bestBlend.title} has been blended by ${bestBlend.djCount} different DJs across ${bestBlend.yearCount} years`,
        description: `Electronic music's eternal blend partner — this track keeps showing up in mashups and transitions year after year.`,
        data: bestBlend,
      });
    }
  }

  // 9. The Tastemaker — DJ who plays tracks before others
  {
    const tastemakers = getTastemakers(1);
    if (tastemakers.length > 0) {
      const tm = tastemakers[0];
      discoveries.push({
        type: 'tastemaker',
        headline: `${tm.name} played ${tm.firstPlays} tracks at Ultra before anyone else did`,
        description: `The ultimate tastemaker — ${tm.name} debuted tracks at Ultra that later became staples in other DJs' sets.`,
        data: tm,
      });
    }
  }

  // 10. Stage Story — most interesting stage lifecycle
  {
    const stageHist = getStageHistory();
    // Find newest stage, shortest-lived, or biggest growth
    const physicalStages = stageHist.filter(s =>
      s.stage !== 'Radio/Podcast' && s.stage !== 'Unknown Stage' && s.stage !== 'Virtual Audio'
    );

    let stageStory = null;

    // Biggest single-year stage
    const biggestStage = physicalStages
      .filter(s => s.totalSets >= 5)
      .sort((a, b) => b.totalSets - a.totalSets)[0];

    // Newest stage (most recent firstYear, with 3+ sets)
    const newest = physicalStages
      .filter(s => s.totalSets >= 3)
      .sort((a, b) => b.firstYear - a.firstYear)[0];

    // Longest-running
    const longestRunning = physicalStages
      .filter(s => s.totalYears >= 3)
      .sort((a, b) => b.totalYears - a.totalYears)[0];

    if (longestRunning) {
      stageStory = {
        focus: 'longest-running',
        stage: longestRunning,
        headline: `${longestRunning.stage} has hosted ${longestRunning.totalSets} sets across ${longestRunning.totalYears} years of Ultra (${longestRunning.firstYear}–${longestRunning.lastYear})`,
        description: `The most enduring stage at Ultra Miami${longestRunning.missingYears.length > 0 ? `, surviving ${longestRunning.missingYears.length} gap year(s)` : ''}.`,
      };
    }

    if (stageStory) {
      discoveries.push({
        type: 'stage-story',
        headline: stageStory.headline,
        description: stageStory.description,
        data: stageStory,
      });
    }
  }

  return discoveries;
}
