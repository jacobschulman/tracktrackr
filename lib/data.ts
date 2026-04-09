import fs from 'fs';
import path from 'path';
import { FESTIVALS } from './festivals';
import type { FestivalIndex, SetData, SetMeta, TopTrack, TrackAppearance, BlendAppearance } from './types';

const DATA_ROOT = path.join(process.cwd(), 'data');

// Cached data (merged across all festivals)
let _loaded = false;
let _allSets: SetMeta[] = [];
let _festivalIndexes: Map<string, FestivalIndex> = new Map();
let _setCache: Map<string, SetData> = new Map();
let _tlIdToFestival: Map<string, string> = new Map();
let _trackIndex: Map<string, TrackAppearance[]> | null = null;
let _blendIndex: Map<string, BlendAppearance[]> | null = null;

// Track key helpers
export function trackKey(artist: string, title: string): string {
  return (artist || '').toLowerCase().trim() + '|||' + (title || '').toLowerCase().trim();
}

export function parseTrackKey(key: string): { artist: string; title: string } {
  const [artist, title] = key.split('|||');
  return { artist: artist || '', title: title || '' };
}

function isIDTrack(artist: string, title: string): boolean {
  const a = (artist || '').toLowerCase().trim();
  const t = (title || '').toLowerCase().trim();
  return a === 'id' || t === 'id' || a === '' || t === '' ||
    t.startsWith('id (') || t === 'id?' || a === 'id?';
}

// Canonical track grouping
function stripRemix(title: string): string {
  const stripped = title
    .replace(/\s*[\(\[][^\)\]]*\b(remix|edit|bootleg|mashup|flip|mix|rework|version|vip|dub|re-?edit|tribute|instrumental|intro|original|feat\.?|ft\.?|featuring)\b[^\)\]]*[\)\]]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return stripped || title;
}

function stripFeaturing(artist: string): string {
  const stripped = artist
    .replace(/\s+(?:ft\.?|feat\.?|featuring)\s+.*/i, '')
    .trim();
  return stripped || artist;
}

function expandTrack(artist: string, title: string): { artist: string; title: string; key: string; titleOnly: string | null }[] {
  const cleanTitle = stripRemix(title);
  const titleParts = cleanTitle.split(/\s+vs\.?\s+/i);

  if (titleParts.length > 1) {
    const artistParts = artist.split(/\s+vs\.?\s+/i);
    return titleParts.map((tp, i) => {
      const a = stripFeaturing((artistParts[i] || artistParts[0]).trim());
      const t = tp.trim();
      return { artist: a, title: t, key: trackKey(a, t), titleOnly: t.toLowerCase().trim() };
    }).filter(p => !isIDTrack(p.artist, p.title));
  }

  const canonArtist = stripFeaturing(artist);
  return [{ artist: canonArtist, title: cleanTitle, key: trackKey(canonArtist, cleanTitle), titleOnly: null }];
}

function collectDJSlugs(djs: { slug: string; aliases?: string[] }[]): string[] {
  if (!djs) return [];
  const slugs = new Set<string>();
  for (const d of djs) {
    slugs.add(d.slug);
    if (d.aliases) {
      for (const a of d.aliases) slugs.add(a);
    }
  }
  return [...slugs];
}

// Discover which festival directories exist under data/
function discoverFestivalDirs(): { slug: string; dir: string; festivalName: string }[] {
  const results: { slug: string; dir: string; festivalName: string }[] = [];
  try {
    const entries = fs.readdirSync(DATA_ROOT, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const indexPath = path.join(DATA_ROOT, entry.name, 'index.json');
      if (fs.existsSync(indexPath)) {
        const config = FESTIVALS[entry.name];
        results.push({
          slug: entry.name,
          dir: path.join(DATA_ROOT, entry.name),
          festivalName: config?.shortName || entry.name,
        });
      }
    }
  } catch {
    // data dir doesn't exist yet
  }
  return results;
}

// Load blocklist of hidden set tlIds
let _blocklist: { sets: Set<string>; festivals: Set<string> } | null = null;
function loadBlocklist(): { sets: Set<string>; festivals: Set<string> } {
  if (_blocklist) return _blocklist;
  _blocklist = { sets: new Set(), festivals: new Set() };
  try {
    const raw = fs.readFileSync(path.join(DATA_ROOT, 'blocklist.json'), 'utf-8');
    const data = JSON.parse(raw);
    if (Array.isArray(data.sets)) {
      for (const id of data.sets) _blocklist.sets.add(String(id));
    }
    if (Array.isArray(data.festivals)) {
      for (const id of data.festivals) _blocklist.festivals.add(String(id));
    }
  } catch {
    // no blocklist file
  }
  return _blocklist;
}

// Load all festival indexes and merge
export function loadIndex(): FestivalIndex {
  if (_loaded) {
    // Return a merged view
    return {
      festival: 'all',
      festivalName: 'All Festivals',
      years: [...new Set(_allSets.map(s => s.year))].sort((a, b) => a - b),
      totalSets: _allSets.length,
      scrapedSets: _allSets.filter(s => s.hasSetFile).length,
      stages: [...new Set(_allSets.map(s => s.stage))],
      sets: _allSets,
    };
  }

  _loaded = true;
  _allSets = [];
  _festivalIndexes.clear();
  _tlIdToFestival.clear();

  const blocklist = loadBlocklist();
  const festivalDirs = discoverFestivalDirs();
  for (const { slug, dir, festivalName } of festivalDirs) {
    // Skip hidden festivals
    if (blocklist.festivals.has(slug)) continue;

    try {
      const raw = fs.readFileSync(path.join(dir, 'index.json'), 'utf-8');
      const index = JSON.parse(raw) as FestivalIndex;

      // Filter out blocklisted sets
      index.sets = index.sets.filter(s => !blocklist.sets.has(s.tlId));

      // Stamp festival metadata onto each set
      for (const s of index.sets) {
        s.festival = slug;
        s.festivalName = festivalName;
        _tlIdToFestival.set(s.tlId, slug);
      }

      _festivalIndexes.set(slug, index);
      _allSets.push(...index.sets);
    } catch {
      // skip festivals with bad data
    }
  }

  return {
    festival: 'all',
    festivalName: 'All Festivals',
    years: [...new Set(_allSets.map(s => s.year))].sort((a, b) => a - b),
    totalSets: _allSets.length,
    scrapedSets: _allSets.filter(s => s.hasSetFile).length,
    stages: [...new Set(_allSets.map(s => s.stage))],
    sets: _allSets,
  };
}

// Load index for a specific festival
export function loadFestivalIndex(festivalSlug: string): FestivalIndex | null {
  loadIndex(); // ensure loaded
  return _festivalIndexes.get(festivalSlug) || null;
}

// Get summary info for all festivals (for the festivals overview page)
export function getFestivalSummaries() {
  loadIndex();
  const summaries: {
    slug: string;
    name: string;
    shortName: string;
    accent: string;
    totalSets: number;
    scrapedSets: number;
    years: number[];
    djCount: number;
    stageCount: number;
  }[] = [];

  for (const [slug, index] of _festivalIndexes) {
    const config = FESTIVALS[slug];
    const djSlugs = new Set<string>();
    const stages = new Set<string>();
    for (const s of index.sets) {
      for (const d of s.djs) djSlugs.add(d.slug);
      stages.add(s.stage);
    }

    summaries.push({
      slug,
      name: config?.name || index.festivalName,
      shortName: config?.shortName || slug,
      accent: config?.accent || '#64748b',
      totalSets: index.totalSets,
      scrapedSets: index.scrapedSets,
      years: index.years,
      djCount: djSlugs.size,
      stageCount: stages.size,
    });
  }

  summaries.sort((a, b) => b.totalSets - a.totalSets);
  return summaries;
}

// Load a single set (auto-detects festival from tlId)
export function loadSet(tlId: string): SetData | null {
  if (_setCache.has(tlId)) return _setCache.get(tlId)!;

  loadIndex(); // ensure tlId map is built
  const festivalSlug = _tlIdToFestival.get(tlId);
  if (!festivalSlug) return null;

  // Find the set's year from the index to narrow the search
  const setMeta = _allSets.find(s => s.tlId === tlId);
  if (!setMeta) return null;

  const yearDir = path.join(DATA_ROOT, festivalSlug, String(setMeta.year));
  try {
    const files = fs.readdirSync(yearDir).filter((f: string) => f.endsWith('.json'));
    for (const file of files) {
      const filePath = path.join(yearDir, file);
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw) as SetData;
        if (data.tlId === tlId) {
          const config = FESTIVALS[festivalSlug];
          data.festival = festivalSlug;
          data.festivalName = config?.shortName || festivalSlug;
          _setCache.set(tlId, data);
          return data;
        }
      } catch {
        continue;
      }
    }
  } catch {
    // year dir doesn't exist
  }

  return null;
}

// Load all sets and build indexes
export function loadAllSets(): void {
  if (_trackIndex) return;
  const index = loadIndex();
  const scraped = index.sets.filter(s => s.hasSetFile);
  for (const s of scraped) {
    loadSet(s.tlId);
  }
  buildTrackIndex();
  buildBlendIndex();
}

// Build track index
function buildTrackIndex(): void {
  _trackIndex = new Map();
  const pendingTitleLookups: { key: string; titleOnly: string; tlId: string; seenCanonical: Set<string>; appearance: TrackAppearance }[] = [];

  for (const [tlId, setData] of _setCache) {
    if (!setData || !setData.tracks) continue;
    const seenCanonical = new Set<string>();
    const djSlugs = collectDJSlugs(setData.djs);

    for (const t of setData.tracks) {
      if (t.type !== 'normal' && t.type !== 'blend') continue;
      if (isIDTrack(t.artist, t.title)) continue;

      const expanded = expandTrack(t.artist, t.title);
      const appearance: Omit<TrackAppearance, 'artist' | 'title'> = {
        tlId, pos: t.pos, year: setData.year, dj: setData.dj,
        djSlugs, stage: setData.stage, date: setData.date,
        label: t.label || '', remix: t.remix || '',
        festival: setData.festival, festivalName: setData.festivalName,
      };

      for (const { artist, title, key, titleOnly } of expanded) {
        const dedupKey = `${tlId}|||${key}`;
        if (seenCanonical.has(dedupKey)) continue;
        seenCanonical.add(dedupKey);

        if (!_trackIndex!.has(key)) _trackIndex!.set(key, []);
        _trackIndex!.get(key)!.push({ ...appearance, artist, title });

        if (titleOnly) {
          pendingTitleLookups.push({ key, titleOnly, tlId, seenCanonical, appearance: { ...appearance, artist, title } });
        }
      }
    }
  }

  // Second pass: resolve mashup sub-tracks
  const titleToCanonical = new Map<string, string[]>();
  for (const [key] of _trackIndex!) {
    const title = key.split('|||')[1];
    if (!title) continue;
    if (!titleToCanonical.has(title)) titleToCanonical.set(title, []);
    titleToCanonical.get(title)!.push(key);
  }

  const artistWords = (a: string): Set<string> => {
    const words = new Set<string>();
    for (const w of a.toLowerCase().split(/[\s&,]+/)) {
      if (w.length > 2 && !['the', 'and', 'vs', 'feat', 'ft'].includes(w)) words.add(w);
    }
    return words;
  };

  const artistsOverlap = (a1: string, a2: string): boolean => {
    const w1 = artistWords(a1);
    const w2 = artistWords(a2);
    for (const w of w1) { if (w2.has(w)) return true; }
    return false;
  };

  for (const { key, titleOnly, tlId, seenCanonical, appearance } of pendingTitleLookups) {
    const mashupArtist = key.split('|||')[0];
    const candidates = titleToCanonical.get(titleOnly) || [];

    const eligible: { key: string; count: number }[] = [];
    for (const ck of candidates) {
      if (ck === key) continue;
      const apps = _trackIndex!.get(ck);
      if (!apps || apps.length < 2) continue;
      if (artistsOverlap(mashupArtist, ck.split('|||')[0])) {
        eligible.push({ key: ck, count: apps.length });
      }
    }
    if (eligible.length === 0) continue;

    eligible.sort((a, b) => b.count - a.count);
    const best = eligible[0];
    const second = eligible[1];

    if (second && best.count < second.count * 2) {
      const allOverlap = eligible.every((a, i) =>
        eligible.every((b, j) => i === j || artistsOverlap(a.key.split('|||')[0], b.key.split('|||')[0]))
      );
      if (!allOverlap) continue;
    }

    const dedupKey = `${tlId}|||${best.key}`;
    if (seenCanonical.has(dedupKey)) continue;
    seenCanonical.add(dedupKey);

    const canonApps = _trackIndex!.get(best.key);
    if (canonApps) {
      canonApps.push({ ...appearance, artist: canonApps[0].artist, title: canonApps[0].title, matchType: 'mashup-inferred' });
    }
  }
}

// Build blend index
function buildBlendIndex(): void {
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
        if (!_blendIndex!.has(key)) _blendIndex!.set(key, []);
        _blendIndex!.get(key)!.push({
          tlId,
          year: setData.year,
          dj: setData.dj,
          djSlugs: (setData.djs || []).map(d => d.slug),
          stage: setData.stage,
          date: setData.date,
          pairedWith,
          festival: setData.festival,
          festivalName: setData.festivalName,
        });
      }
    }
  }
}

// Helper to filter appearances by festival
function filterByFestival<T extends { festival: string }>(items: T[], festival?: string): T[] {
  if (!festival) return items;
  return items.filter(a => a.festival === festival);
}

// Query functions

export function getTopTracks(n: number = 25, filters: { year?: number; stage?: string; djSlug?: string; festival?: string } = {}): TopTrack[] {
  if (!_trackIndex) return [];
  const result: TopTrack[] = [];

  for (const [key, appearances] of _trackIndex) {
    let filtered = appearances;
    if (filters.year) filtered = filtered.filter(a => a.year === filters.year);
    if (filters.stage) filtered = filtered.filter(a => a.stage === filters.stage);
    if (filters.djSlug) filtered = filtered.filter(a => a.djSlugs.includes(filters.djSlug!));
    if (filters.festival) filtered = filtered.filter(a => a.festival === filters.festival);

    if (filtered.length === 0) continue;

    const years = [...new Set(filtered.map(a => a.year))].sort();
    const djs = [...new Set(filtered.map(a => a.dj))];
    const tlIds = [...new Set(filtered.map(a => a.tlId))];
    const festivals = [...new Set(filtered.map(a => a.festival))];

    // Per-year and per-festival play counts for client-side re-ranking
    const yearCounts: Record<number, number> = {};
    const festivalCounts: Record<string, number> = {};
    for (const a of filtered) {
      yearCounts[a.year] = (yearCounts[a.year] || 0) + 1;
      festivalCounts[a.festival] = (festivalCounts[a.festival] || 0) + 1;
    }

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
      festivals,
      yearCounts,
      festivalCounts,
    });
  }

  result.sort((a, b) => b.playCount - a.playCount || a.artist.localeCompare(b.artist));
  return result.slice(0, n);
}

export function getTrackHistory(artist: string, title: string, festival?: string): TrackAppearance[] {
  if (!_trackIndex) return [];
  const key = trackKey(artist, title);
  const appearances = _trackIndex.get(key) || [];
  const filtered = filterByFestival(appearances, festival);
  return [...filtered].sort((a, b) => b.date.localeCompare(a.date));
}

export function getTrackStreak(artist: string, title: string, festival?: string) {
  if (!_trackIndex) return { streak: 0, startYear: null as number | null, endYear: null as number | null, totalYears: 0, years: [] as number[], orbitByYear: {} as Record<number, number> };
  const key = trackKey(artist, title);
  let appearances = _trackIndex.get(key) || [];
  appearances = filterByFestival(appearances, festival);
  const years = [...new Set(appearances.map(a => a.year))].sort((a, b) => a - b);

  if (years.length === 0) return { streak: 0, startYear: null, endYear: null, totalYears: 0, years: [], orbitByYear: {} };

  let best = 1, cur = 1, bestStart = years[0], curStart = years[0];
  for (let i = 1; i < years.length; i++) {
    if (years[i] === years[i - 1] + 1) {
      cur++;
      if (cur > best) { best = cur; bestStart = curStart; }
    } else { cur = 1; curStart = years[i]; }
  }

  const orbitByYear: Record<number, number> = {};
  const orbitSets: Record<number, Set<string>> = {};
  for (const a of appearances) {
    if (!orbitSets[a.year]) orbitSets[a.year] = new Set();
    orbitSets[a.year].add(a.dj);
  }
  for (const [y, s] of Object.entries(orbitSets)) {
    orbitByYear[Number(y)] = s.size;
  }

  return { streak: best, startYear: bestStart, endYear: bestStart + best - 1, totalYears: years.length, years, orbitByYear };
}

export function getBlendAppearances(artist: string, title: string, festival?: string): BlendAppearance[] {
  if (!_blendIndex) return [];
  const key = trackKey(artist, title);
  const appearances = _blendIndex.get(key) || [];
  return filterByFestival(appearances, festival);
}

// DJ helpers

function getDJSlugsWithAliases(slug: string): Set<string> {
  const index = loadIndex();
  const result = new Set([slug]);
  for (const s of index.sets) {
    for (const d of s.djs) {
      if (d.slug === slug && d.aliases) {
        for (const a of d.aliases) result.add(a);
      }
      if (d.aliases && d.aliases.includes(slug)) {
        result.add(d.slug);
      }
    }
  }
  return result;
}

export function getDJHistory(slug: string, festival?: string): SetMeta[] {
  const index = loadIndex();
  const matchSlugs = getDJSlugsWithAliases(slug);
  let sets = index.sets.filter(s => s.djs.some(d => matchSlugs.has(d.slug)));
  if (festival) sets = sets.filter(s => s.festival === festival);
  return sets.sort((a, b) => a.date.localeCompare(b.date));
}

export function getDJStats(slug: string, festival?: string) {
  const history = getDJHistory(slug, festival);
  if (history.length === 0) return null;

  const name = history[0].djs.find(d => d.slug === slug)?.name || slug;
  const years = [...new Set(history.map(s => s.year))].sort((a, b) => a - b);
  const stages: Record<string, number> = {};
  for (const s of history) {
    stages[s.stage] = (stages[s.stage] || 0) + 1;
  }

  // Streak
  let best = 1, cur = 1;
  for (let i = 1; i < years.length; i++) {
    if (years[i] === years[i - 1] + 1) { cur++; if (cur > best) best = cur; }
    else cur = 1;
  }

  // B2B partners
  const b2bPartners: Record<string, string> = {};
  for (const s of history) {
    if (s.djs.length > 1) {
      for (const d of s.djs) {
        if (d.slug !== slug) b2bPartners[d.slug] = d.name;
      }
    }
  }

  // Festivals this DJ has played
  const festivals = [...new Set(history.map(s => s.festival))];

  return { name, slug, years, stages, streak: years.length >= 1 ? best : 0, totalSets: history.length, b2bPartners, festivals };
}

export function getDJStreak(slug: string, festival?: string): number {
  const history = getDJHistory(slug, festival);
  const years = [...new Set(history.map(s => s.year))].sort((a, b) => a - b);
  if (years.length === 0) return 0;
  let best = 1, cur = 1;
  for (let i = 1; i < years.length; i++) {
    if (years[i] === years[i - 1] + 1) { cur++; if (cur > best) best = cur; }
    else cur = 1;
  }
  return best;
}

// Year spotlight (for home page)
export function getYearSpotlight(year: number, festival?: string) {
  const index = loadIndex();
  let allSets = index.sets;
  if (festival) allSets = allSets.filter(s => s.festival === festival);

  const yearSets = allSets.filter(s => s.year === year);
  if (yearSets.length === 0) return null;

  const djSet = new Set<string>();
  const stageSet = new Set<string>();
  for (const s of yearSets) {
    for (const d of s.djs) djSet.add(d.slug);
    stageSet.add(s.stage);
  }

  // Debuts: DJs whose first year is this year
  const allDJFirstYear = new Map<string, number>();
  for (const s of allSets) {
    for (const d of s.djs) {
      const existing = allDJFirstYear.get(d.slug);
      if (!existing || s.year < existing) allDJFirstYear.set(d.slug, s.year);
    }
  }
  const debuts: { name: string; slug: string }[] = [];
  for (const s of yearSets) {
    for (const d of s.djs) {
      if (allDJFirstYear.get(d.slug) === year && !debuts.find(x => x.slug === d.slug)) {
        debuts.push({ name: d.name, slug: d.slug });
      }
    }
  }

  // Comebacks: DJs who were absent for 2+ years
  const allDJYears = new Map<string, number[]>();
  for (const s of allSets) {
    for (const d of s.djs) {
      if (!allDJYears.has(d.slug)) allDJYears.set(d.slug, []);
      allDJYears.get(d.slug)!.push(s.year);
    }
  }
  const comebacks: { name: string; slug: string; gap: number }[] = [];
  for (const s of yearSets) {
    for (const d of s.djs) {
      const yrs = [...new Set(allDJYears.get(d.slug) || [])].sort((a, b) => a - b);
      const idx = yrs.indexOf(year);
      if (idx > 0) {
        const gap = year - yrs[idx - 1];
        if (gap >= 3 && !comebacks.find(x => x.slug === d.slug)) {
          comebacks.push({ name: d.name, slug: d.slug, gap });
        }
      }
    }
  }
  comebacks.sort((a, b) => b.gap - a.gap);

  // Veterans: longest active streaks ending in this year
  const veterans: { name: string; slug: string; streak: number; since: number }[] = [];
  for (const s of yearSets) {
    for (const d of s.djs) {
      if (veterans.find(x => x.slug === d.slug)) continue;
      const yrs = [...new Set(allDJYears.get(d.slug) || [])].sort((a, b) => a - b);
      if (!yrs.includes(year)) continue;
      let streak = 1;
      const yearIdx = yrs.indexOf(year);
      for (let i = yearIdx - 1; i >= 0; i--) {
        if (yrs[i] === yrs[i + 1] - 1) streak++;
        else break;
      }
      if (streak >= 3) {
        veterans.push({ name: d.name, slug: d.slug, streak, since: year - streak + 1 });
      }
    }
  }
  veterans.sort((a, b) => b.streak - a.streak);

  // Track data
  let topTracks: TopTrack[] = [];
  let repeatOffenders: { name: string; slug: string; repeatedTracks: { artist: string; title: string; key: string; priorYears: number[] }[]; totalTracksThisYear: number }[] = [];

  if (_trackIndex) {
    topTracks = getTopTracks(10, { year, festival });

    // Repeat offenders: DJs who played tracks they'd played in prior years
    const djRepeats = new Map<string, { name: string; repeats: Map<string, number[]>; totalTracks: number }>();

    for (const [key, appearances] of _trackIndex) {
      const relevantApps = festival ? appearances.filter(a => a.festival === festival) : appearances;
      const thisYearApps = relevantApps.filter(a => a.year === year);
      const priorApps = relevantApps.filter(a => a.year < year);

      if (thisYearApps.length === 0 || priorApps.length === 0) continue;

      for (const app of thisYearApps) {
        for (const djSlug of app.djSlugs) {
          const priorByDJ = priorApps.filter(a => a.djSlugs.includes(djSlug));
          if (priorByDJ.length === 0) continue;

          if (!djRepeats.has(djSlug)) {
            const djName = app.dj;
            djRepeats.set(djSlug, { name: djName, repeats: new Map(), totalTracks: 0 });
          }
          const entry = djRepeats.get(djSlug)!;
          if (!entry.repeats.has(key)) {
            entry.repeats.set(key, [...new Set(priorByDJ.map(a => a.year))].sort());
          }
        }
      }
    }

    // Count total tracks per DJ this year
    for (const [, appearances] of _trackIndex) {
      const relevantApps = festival ? appearances.filter(a => a.festival === festival) : appearances;
      const thisYearApps = relevantApps.filter(a => a.year === year);
      for (const app of thisYearApps) {
        for (const djSlug of app.djSlugs) {
          const entry = djRepeats.get(djSlug);
          if (entry) entry.totalTracks++;
        }
      }
    }

    repeatOffenders = [...djRepeats.entries()]
      .map(([slug, data]) => ({
        name: data.name,
        slug,
        repeatedTracks: [...data.repeats.entries()].map(([key, priorYears]) => {
          const parts = key.split('|||');
          return { artist: parts[0], title: parts[1], key, priorYears };
        }),
        totalTracksThisYear: data.totalTracks,
      }))
      .filter(d => d.repeatedTracks.length >= 2)
      .sort((a, b) => b.repeatedTracks.length - a.repeatedTracks.length);
  }

  return {
    year,
    sets: yearSets,
    setCount: yearSets.length,
    djCount: djSet.size,
    stageCount: stageSet.size,
    debuts,
    comebacks: comebacks.slice(0, 10),
    veterans: veterans.slice(0, 10),
    topTracks,
    repeatOffenders,
  };
}

// Get all track keys
export function getAllTrackKeys(): string[] {
  if (!_trackIndex) return [];
  return [..._trackIndex.keys()];
}

// Stage history
export function getStageHistory(festival?: string) {
  const index = loadIndex();
  let sets = index.sets;
  if (festival) sets = sets.filter(s => s.festival === festival);

  const stages = new Map<string, { stage: string; years: Set<number>; totalSets: number; festival: string }>();

  for (const s of sets) {
    if (!stages.has(s.stage)) {
      stages.set(s.stage, { stage: s.stage, years: new Set(), totalSets: 0, festival: s.festival });
    }
    const st = stages.get(s.stage)!;
    st.years.add(s.year);
    st.totalSets++;
  }

  return [...stages.values()].map(st => {
    const years = [...st.years].sort((a, b) => a - b);
    const firstYear = years[0];
    const lastYear = years[years.length - 1];
    const missingYears: number[] = [];
    for (let y = firstYear; y <= lastYear; y++) {
      if (!st.years.has(y)) missingYears.push(y);
    }
    return {
      stage: st.stage, firstYear, lastYear, totalSets: st.totalSets,
      totalYears: years.length, appearedYears: years, missingYears,
      festival: st.festival,
    };
  }).sort((a, b) => b.totalSets - a.totalSets);
}

// Year stats
export function getYearStats(year: number, festival?: string) {
  const index = loadIndex();
  let sets = index.sets.filter(s => s.year === year);
  if (festival) sets = sets.filter(s => s.festival === festival);

  const djSlugs = new Set<string>();
  const stages: Record<string, number> = {};

  for (const s of sets) {
    for (const d of s.djs) djSlugs.add(d.slug);
    stages[s.stage] = (stages[s.stage] || 0) + 1;
  }

  let topTracks: TopTrack[] = [];
  if (_trackIndex) {
    topTracks = getTopTracks(10, { year, festival });
  }

  return {
    year, setCount: sets.length, uniqueDJs: djSlugs.size,
    stageCount: Object.keys(stages).length, stages, topTracks, sets,
  };
}

// B2B sets
export function getB2BSets(festival?: string) {
  const index = loadIndex();
  let sets = index.sets;
  if (festival) sets = sets.filter(s => s.festival === festival);

  const pairs = new Map<string, { djs: { slug: string; name: string }[]; sets: SetMeta[]; years: Set<number>; festivals: Set<string> }>();

  for (const s of sets) {
    if (s.djs.length < 2) continue;
    const slugs = s.djs.map(d => d.slug).sort();
    const pairKey = slugs.join('|||');

    if (!pairs.has(pairKey)) {
      pairs.set(pairKey, {
        djs: s.djs.map(d => ({ slug: d.slug, name: d.name })).sort((a, b) => a.slug.localeCompare(b.slug)),
        sets: [], years: new Set(), festivals: new Set(),
      });
    }
    const p = pairs.get(pairKey)!;
    p.sets.push(s);
    p.years.add(s.year);
    p.festivals.add(s.festival);
  }

  return [...pairs.values()]
    .map(p => ({ ...p, count: p.sets.length, years: [...p.years].sort((a, b) => a - b), festivals: [...p.festivals] }))
    .sort((a, b) => b.count - a.count);
}

// B2B detail
export function getB2BDetail(slug1: string, slug2: string, festival?: string) {
  const index = loadIndex();
  const slugs = [slug1, slug2].sort();
  let all = index.sets;
  if (festival) all = all.filter(s => s.festival === festival);

  const jointSets = all.filter(s =>
    s.djs.some(d => d.slug === slugs[0]) && s.djs.some(d => d.slug === slugs[1])
  );

  const soloSets1 = all.filter(s => s.djs.length === 1 && s.djs[0].slug === slugs[0]);
  const soloSets2 = all.filter(s => s.djs.length === 1 && s.djs[0].slug === slugs[1]);

  let tracksInCommon: { key: string; artist: string; title: string }[] = [];
  let uniqueToJoint: { key: string; artist: string; title: string }[] = [];

  if (_trackIndex) {
    const jointTracks = new Set<string>();
    const solo1Tracks = new Set<string>();
    const solo2Tracks = new Set<string>();

    for (const [key, appearances] of _trackIndex) {
      const filtered = festival ? appearances.filter(a => a.festival === festival) : appearances;
      for (const a of filtered) {
        if (jointSets.some(s => s.tlId === a.tlId)) jointTracks.add(key);
        if (soloSets1.some(s => s.tlId === a.tlId)) solo1Tracks.add(key);
        if (soloSets2.some(s => s.tlId === a.tlId)) solo2Tracks.add(key);
      }
    }

    tracksInCommon = [...solo1Tracks].filter(k => solo2Tracks.has(k)).map(k => {
      const a = _trackIndex!.get(k)?.[0];
      return a ? { key: k, artist: a.artist, title: a.title } : null;
    }).filter(Boolean) as { key: string; artist: string; title: string }[];

    uniqueToJoint = [...jointTracks].filter(k => !solo1Tracks.has(k) && !solo2Tracks.has(k)).map(k => {
      const a = _trackIndex!.get(k)?.[0];
      return a ? { key: k, artist: a.artist, title: a.title } : null;
    }).filter(Boolean) as { key: string; artist: string; title: string }[];
  }

  return { jointSets, soloSets1, soloSets2, tracksInCommon, uniqueToJoint };
}

// DJ repeat rate
export function getDJRepeatRate(slug: string, festival?: string) {
  if (!_trackIndex) return { repeatedTracks: 0, totalUniqueTracks: 0, repeatRate: 0 };

  const trackSets = new Map<string, Set<string>>();
  for (const [key, appearances] of _trackIndex) {
    const filtered = festival ? appearances.filter(a => a.festival === festival) : appearances;
    const djApps = filtered.filter(a => a.djSlugs.includes(slug));
    if (djApps.length > 0) {
      trackSets.set(key, new Set(djApps.map(a => a.tlId)));
    }
  }

  const total = trackSets.size;
  const repeated = [...trackSets.values()].filter(s => s.size > 1).length;

  return { repeatedTracks: repeated, totalUniqueTracks: total, repeatRate: total > 0 ? repeated / total : 0 };
}

// Most supported tracks: tracks BY a DJ (as artist) that other DJs play the most
export function getMostSupportedTracks(slug: string, limit: number = 20): { artist: string; title: string; key: string; playedByCount: number; playedBy: string[]; totalPlays: number }[] {
  if (!_trackIndex) return [];
  const matchSlugs = getDJSlugsWithAliases(slug);

  // Get DJ display names for matching against artist field
  const index = loadIndex();
  const djNames = new Set<string>();
  for (const s of index.sets) {
    for (const d of s.djs) {
      if (matchSlugs.has(d.slug)) {
        djNames.add(d.name.toLowerCase());
      }
    }
  }

  const results: { artist: string; title: string; key: string; playedByCount: number; playedBy: string[]; totalPlays: number }[] = [];

  for (const [key, appearances] of _trackIndex) {
    const artistLower = appearances[0].artist.toLowerCase();
    // Check if this DJ is the artist (or one of the artists)
    const isDJTrack = [...djNames].some(name =>
      artistLower === name ||
      artistLower.startsWith(name + ' ') ||
      artistLower.includes(' ' + name) ||
      artistLower.includes(name + ',') ||
      artistLower.includes(', ' + name)
    );
    if (!isDJTrack) continue;

    // Count OTHER DJs who played this track
    const otherDJs = new Set<string>();
    for (const a of appearances) {
      for (const ds of a.djSlugs) {
        if (!matchSlugs.has(ds)) otherDJs.add(a.dj);
      }
    }
    if (otherDJs.size === 0) continue;

    results.push({
      artist: appearances[0].artist,
      title: appearances[0].title,
      key,
      playedByCount: otherDJs.size,
      playedBy: [...otherDJs].slice(0, 10),
      totalPlays: appearances.length,
    });
  }

  results.sort((a, b) => b.playedByCount - a.playedByCount || b.totalPlays - a.totalPlays);
  return results.slice(0, limit);
}

// Label timeline
export function getLabelTimeline(festival?: string) {
  if (!_trackIndex) return [];
  const labels = new Map<string, { label: string; totalPlays: number; playsByYear: Record<number, number> }>();

  for (const [, appearances] of _trackIndex) {
    const filtered = festival ? appearances.filter(a => a.festival === festival) : appearances;
    for (const a of filtered) {
      if (!a.label) continue;
      if (!labels.has(a.label)) {
        labels.set(a.label, { label: a.label, totalPlays: 0, playsByYear: {} });
      }
      const l = labels.get(a.label)!;
      l.totalPlays++;
      l.playsByYear[a.year] = (l.playsByYear[a.year] || 0) + 1;
    }
  }

  const totalByYear: Record<number, number> = {};
  for (const [, l] of labels) {
    for (const [y, count] of Object.entries(l.playsByYear)) {
      totalByYear[Number(y)] = (totalByYear[Number(y)] || 0) + count;
    }
  }

  const result = [...labels.values()].map(l => {
    const shareByYear: Record<number, number> = {};
    let peakYear: number | null = null, peakPlays = 0;
    for (const [y, count] of Object.entries(l.playsByYear)) {
      const yn = Number(y);
      shareByYear[yn] = totalByYear[yn] > 0 ? count / totalByYear[yn] : 0;
      if (count > peakPlays) { peakPlays = count; peakYear = yn; }
    }
    return { ...l, shareByYear, peakYear, peakPlays };
  });

  result.sort((a, b) => b.totalPlays - a.totalPlays);
  return result;
}

// Utility
export function fmt(n: number | null | undefined): string {
  if (n == null) return '0';
  return Number(n).toLocaleString();
}
