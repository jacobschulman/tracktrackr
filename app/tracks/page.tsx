import { loadAllSets, getTopTracks, loadIndex } from '@/lib/data';
import { trackSlug } from '@/lib/slugs';
import { TracksPageClient } from './TracksPageClient';

export default function TracksPage() {
  const index = loadIndex();
  loadAllSets();

  const allTracks = getTopTracks(500);
  const allStages = [...new Set(index.sets.map((s) => s.stage))].sort();
  const allYears = index.years;

  const tracksWithSlugs = allTracks.map((t) => ({
    ...t,
    slug: trackSlug(t.artist, t.title),
  }));

  return (
    <TracksPageClient
      tracks={tracksWithSlugs}
      stages={allStages as string[]}
      years={allYears}
    />
  );
}
