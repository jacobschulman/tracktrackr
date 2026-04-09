import { loadIndex, getFestivalSummaries } from '@/lib/data';
import { TracksPageClient } from './TracksPageClient';
import fs from 'fs';
import path from 'path';

export default function TracksPage() {
  const index = loadIndex();
  const allYears = index.years;
  const festivalSummaries = getFestivalSummaries();
  const festivalLabels = festivalSummaries.map(f => ({ slug: f.slug, shortName: f.shortName, accent: f.accent }));

  // Load pre-built track leaderboard (no loadAllSets needed)
  let tracks: any[] = [];
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'data', 'tracks-leaderboard.json'), 'utf-8');
    tracks = JSON.parse(raw);
  } catch {}

  return (
    <TracksPageClient
      tracks={tracks}
      years={allYears}
      festivalLabels={festivalLabels}
    />
  );
}
