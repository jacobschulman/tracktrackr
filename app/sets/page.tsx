import { loadIndex, loadAllSets, loadSet, getFestivalSummaries, fmt } from '@/lib/data';
import { getStageColor } from '@/lib/festivals';
import { SetsPageClient } from './SetsPageClient';

function formatDateShort(dateStr: string): string {
  if (!dateStr) return '\u2014';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function isIDTrack(artist: string, title: string): boolean {
  const a = (artist || '').toLowerCase().trim();
  const t = (title || '').toLowerCase().trim();
  return a === 'id' || t === 'id' || a === '' || t === '' ||
    t.startsWith('id (') || t === 'id?' || a === 'id?';
}

export default function SetsPage() {
  const index = loadIndex();
  loadAllSets();

  const festivalSummaries = getFestivalSummaries();
  const festivalLabels = festivalSummaries.map(f => ({ slug: f.slug, shortName: f.shortName, accent: f.accent }));
  const allYears = [...index.years].sort((a, b) => b - a);

  // Sort all sets by date descending
  const allSets = [...index.sets].sort((a, b) => b.date.localeCompare(a.date));

  // Build enrichment data for sets (track previews + recordings)
  const setEnrich: Record<string, {
    tracks: { artist: string; title: string; remix: string }[];
    totalTracks: number;
    hasYouTube: boolean;
    hasSoundCloud: boolean;
    ytUrl?: string;
    scUrl?: string;
  }> = {};
  for (const s of allSets) {
    if (!s.hasSetFile) continue;
    const setData = loadSet(s.tlId);
    if (!setData) continue;
    const tracks = (setData.tracks || []).filter(
      t => (t.type === 'normal' || t.type === 'blend') && !isIDTrack(t.artist, t.title)
    );
    const recordings = setData.recordings || [];
    const ytRec = recordings.find(r => r.platform === 'youtube');
    const scRec = recordings.find(r => r.platform === 'soundcloud');
    setEnrich[s.tlId] = {
      totalTracks: tracks.length,
      tracks: tracks.slice(0, 2).map(t => ({
        artist: t.artist,
        title: t.title,
        remix: t.remix || '',
      })),
      hasYouTube: !!ytRec,
      hasSoundCloud: !!scRec,
      ytUrl: ytRec?.url,
      scUrl: scRec?.url,
    };
  }

  const setCards = allSets.map(s => {
    const enrich = setEnrich[s.tlId];
    return {
      tlId: s.tlId,
      djName: s.djs.map(d => d.name).join(' & '),
      stage: s.stage,
      stageColor: getStageColor(s.festival || 'ultra-miami', s.stage),
      festival: s.festival,
      year: s.year,
      date: s.date,
      dateFormatted: formatDateShort(s.date),
      duration: s.duration || '',
      tracksIdentified: s.tracksIdentified || 0,
      hasYouTube: enrich?.hasYouTube || false,
      hasSoundCloud: enrich?.hasSoundCloud || false,
      ytUrl: enrich?.ytUrl,
      scUrl: enrich?.scUrl,
      tracks: enrich?.tracks || [],
      totalTracks: enrich?.totalTracks || 0,
    };
  });

  return (
    <SetsPageClient
      sets={setCards}
      festivalLabels={festivalLabels}
      years={allYears}
      totalSets={allSets.length}
    />
  );
}
