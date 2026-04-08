import { NextResponse } from 'next/server';
import { loadIndex, loadAllSets, getAllTrackKeys, parseTrackKey, getTrackHistory } from '@/lib/data';
import { trackSlug } from '@/lib/slugs';

export async function GET() {
  const index = loadIndex();
  loadAllSets();

  // Build DJ list
  const djMap = new Map<string, string>();
  for (const set of index.sets) {
    for (const dj of set.djs) {
      if (!djMap.has(dj.slug)) djMap.set(dj.slug, dj.name);
    }
  }
  const djs = [...djMap.entries()].map(([slug, name]) => ({ slug, name }));

  // Build track list
  const keys = getAllTrackKeys();
  const tracks = keys.map(key => {
    const { artist, title } = parseTrackKey(key);
    const appearances = getTrackHistory(artist, title);
    if (!appearances || appearances.length === 0) return null;
    return {
      a: artist,
      t: title,
      s: trackSlug(artist, title),
      p: appearances.length,
      y: new Set(appearances.map(a => a.year)).size,
      d: new Set(appearances.flatMap(a => a.djSlugs)).size,
    };
  }).filter(Boolean);

  return NextResponse.json({ djs, tracks });
}
