import { loadIndex, loadAllSets, loadSet, getTopTracks, getYearStats, getYearSpotlight, getFestivalSummaries, fmt } from '@/lib/data';
import { getStageColor } from '@/lib/festivals';
import { trackSlug } from '@/lib/slugs';
import Link from 'next/link';
import { YearSelect, FilterableSetGrid } from './YearPageClient';
import { SpotifyButton } from '@/components/SpotifyButton';

export function generateStaticParams() {
  const index = loadIndex();
  return index.years.map((y) => ({ year: String(y) }));
}

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

export default async function YearDetailPage({ params }: { params: Promise<{ year: string }> }) {
  const { year: yearStr } = await params;
  const year = parseInt(yearStr);
  const index = loadIndex();
  loadAllSets();

  const stats = getYearStats(year);
  if (!stats) {
    return (
      <div className="empty-state">
        <div className="empty-state-text">No data for this year.</div>
      </div>
    );
  }

  const yearSets = stats.sets;
  const tracksIDd = yearSets.reduce(
    (sum, s) => sum + (s.tracksIdentified || 0),
    0
  );

  // Stages breakdown
  const stageCountMap: Record<string, number> = {};
  const setsByStage: Record<string, typeof yearSets> = {};
  for (const s of yearSets) {
    stageCountMap[s.stage] = (stageCountMap[s.stage] || 0) + 1;
    if (!setsByStage[s.stage]) setsByStage[s.stage] = [];
    setsByStage[s.stage].push(s);
  }
  const stageNames = Object.keys(stageCountMap).sort(
    (a, b) => stageCountMap[b] - stageCountMap[a]
  );

  // DJ highlights
  const djMap = new Map<
    string,
    { name: string; slug: string; sets: number; tracksIdentified: number }
  >();
  for (const s of yearSets) {
    for (const d of s.djs) {
      if (!djMap.has(d.slug)) {
        djMap.set(d.slug, {
          name: d.name,
          slug: d.slug,
          sets: 0,
          tracksIdentified: 0,
        });
      }
      const entry = djMap.get(d.slug)!;
      entry.sets++;
      entry.tracksIdentified += s.tracksIdentified || 0;
    }
  }
  const allDJs = [...djMap.values()];
  const topByTracks = [...allDJs]
    .sort((a, b) => b.tracksIdentified - a.tracksIdentified)
    .slice(0, 5);
  const topBySets = [...allDJs]
    .filter((d) => d.sets >= 2)
    .sort((a, b) => b.sets - a.sets);

  const topTracks = stats.topTracks || [];
  const sortedSets = [...yearSets].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // Build set enrichment data (track previews + recordings)
  const setEnrich: Record<string, {
    tracks: { artist: string; title: string; remix: string }[];
    totalTracks: number;
    hasYouTube: boolean;
    hasSoundCloud: boolean;
    ytUrl?: string;
    scUrl?: string;
  }> = {};
  for (const s of yearSets) {
    if (!s.hasSetFile) continue;
    const setData = loadSet(s.tlId);
    if (!setData) continue;
    const tracks = (setData.tracks || []).filter(
      t => (t.type === 'normal' || t.type === 'blend') && !isIDTrack(t.artist, t.title)
    );
    const recordings = (setData as any).recordings || [];
    const ytRec = recordings.find((r: any) => r.platform === 'youtube');
    const scRec = recordings.find((r: any) => r.platform === 'soundcloud');
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

  // Festival labels for filter
  const festivalSummaries = getFestivalSummaries();
  const festivalLabels = festivalSummaries
    .filter(f => yearSets.some(s => s.festival === f.slug))
    .map(f => ({ slug: f.slug, shortName: f.shortName, accent: f.accent }));

  // Build data for client grid
  const setCards = sortedSets.map(s => {
    const enrich = setEnrich[s.tlId];
    return {
      tlId: s.tlId,
      djName: s.djs.map(d => d.name).join(' & '),
      stage: s.stage,
      stageColor: getStageColor(s.festival || 'ultra-miami', s.stage),
      festival: s.festival,
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
    <>
      {/* Year selector toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <YearSelect years={index.years} current={year} />
      </div>

      {/* Stats bar */}
      <div className="stat-bar">
        <div className="stat-card">
          <div className="stat-number">{fmt(stats.setCount)}</div>
          <div className="stat-label">Sets</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{fmt(stats.uniqueDJs)}</div>
          <div className="stat-label">DJs</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{fmt(stats.stageCount)}</div>
          <div className="stat-label">Stages</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{fmt(tracksIDd)}</div>
          <div className="stat-label">Tracks ID&apos;d</div>
        </div>
      </div>

      {/* Top Tracks */}
      {topTracks.length > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <div className="card-title">Top Tracks</div>
            <Link href="/tracks" style={{ fontSize: '0.75rem', color: 'var(--purple-lt)' }}>View all &rarr;</Link>
          </div>
          <div className="leaderboard">
            {topTracks.slice(0, 3).map((t, i) => {
              const rank = i + 1;
              const slug = trackSlug(t.artist, t.title);
              return (
                <Link
                  key={t.key}
                  href={`/track/${slug}`}
                  className="leaderboard-row"
                  style={{ cursor: 'pointer', textDecoration: 'none' }}
                >
                  <div className="leaderboard-rank top3">{rank}</div>
                  <div className="leaderboard-info">
                    <div className="leaderboard-name">
                      {t.artist} &mdash; {t.title}
                    </div>
                    <div className="leaderboard-meta">
                      <span>{t.djs.length} DJs played this</span>
                    </div>
                  </div>
                  <div>
                    <div className="leaderboard-count">{t.playCount}</div>
                    <div className="leaderboard-count-label">plays</div>
                  </div>
                  <SpotifyButton artist={t.artist} title={t.title} />
                </Link>
              );
            })}
          </div>
        </div>
      )}


      {/* All Sets Grid — filterable */}
      <div className="section-title">Sets &mdash; {year}</div>
      <FilterableSetGrid sets={setCards} festivalLabels={festivalLabels} />
    </>
  );
}
