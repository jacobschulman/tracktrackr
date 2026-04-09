import { NextResponse } from 'next/server';
import { loadIndex } from '@/lib/data';
import fs from 'fs';
import path from 'path';

let _searchData: { djs: any[]; tracks: any[] } | null = null;

function loadSearchData() {
  if (_searchData) return _searchData;

  // DJs from festival indexes (fast)
  const index = loadIndex();
  const djMap = new Map<string, string>();
  for (const set of index.sets) {
    for (const dj of set.djs) {
      if (!djMap.has(dj.slug)) djMap.set(dj.slug, dj.name);
    }
  }
  const djs = [...djMap.entries()].map(([slug, name]) => ({ slug, name }));

  // Tracks from pre-built search index (fast)
  let tracks: any[] = [];
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'data', 'track-search.json'), 'utf-8');
    tracks = JSON.parse(raw);
  } catch {}

  _searchData = { djs, tracks };
  return _searchData;
}

export async function GET() {
  const data = loadSearchData();
  return NextResponse.json(data);
}
