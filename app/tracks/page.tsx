import { loadAllSets, getTopTracks, loadIndex, getFestivalSummaries } from '@/lib/data';
import { trackSlug } from '@/lib/slugs';
import { TracksPageClient } from './TracksPageClient';

export default function TracksPage() {
  const index = loadIndex();
  loadAllSets();

  const allTracks = getTopTracks(500);
  const allYears = index.years;
  const festivalSummaries = getFestivalSummaries();
  const festivalLabels = festivalSummaries.map(f => ({ slug: f.slug, shortName: f.shortName, accent: f.accent }));

  const tracksWithSlugs = allTracks.map((t) => ({
    ...t,
    slug: trackSlug(t.artist, t.title),
    yearCounts: t.yearCounts || {},
    festivalCounts: t.festivalCounts || {},
  }));

  return (
    <TracksPageClient
      tracks={tracksWithSlugs}
      years={allYears}
      festivalLabels={festivalLabels}
    />
  );
}
