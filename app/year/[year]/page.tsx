import { loadIndex, loadAllSets, loadSet, getTopTracks, getYearStats, getYearSpotlight, fmt } from '@/lib/data';
import { CONFIG, getStageColor } from '@/lib/config';
import { trackSlug } from '@/lib/slugs';
import { StageBadge } from '@/components/StageBadge';
import Link from 'next/link';
import { YearSelect } from './YearPageClient';

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

  // Build set enrichment data (track previews)
  const setEnrich: Record<string, { tracks: { artist: string; title: string; remix: string }[]; totalTracks: number }> = {};
  for (const s of yearSets) {
    if (!s.hasSetFile) continue;
    const setData = loadSet(s.tlId);
    if (!setData || !setData.tracks) continue;
    const tracks = setData.tracks.filter(
      t => (t.type === 'normal' || t.type === 'blend') && !isIDTrack(t.artist, t.title)
    );
    setEnrich[s.tlId] = {
      totalTracks: tracks.length,
      tracks: tracks.slice(0, 2).map(t => ({
        artist: t.artist,
        title: t.title,
        remix: t.remix || '',
      })),
    };
  }

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
                </Link>
              );
            })}
          </div>
        </div>
      )}


      {/* All Sets Grid */}
      <div className="section-title">Sets &mdash; {year}</div>
      <div className="set-grid">
        {sortedSets.map((s) => {
          const stageColor = getStageColor(s.stage);
          const enrich = setEnrich[s.tlId];
          return (
            <Link
              key={s.tlId}
              href={`/set/${s.tlId}`}
              className="set-card"
              style={{ textDecoration: 'none', color: 'inherit', borderLeft: `3px solid ${stageColor}` }}
            >
              <div className="set-card-dj">
                {s.djs.map((d) => d.name).join(' & ')}
              </div>
              <div className="set-card-meta" style={{ marginBottom: 8 }}>
                <StageBadge stage={s.stage} />
                <span className="separator">&middot;</span>
                <span>{formatDateShort(s.date)}</span>
                {s.duration && (
                  <>
                    <span className="separator">&middot;</span>
                    <span>{s.duration}</span>
                  </>
                )}
              </div>
              {enrich && enrich.tracks.length > 0 && (
                <div className="set-card-track-preview">
                  {enrich.tracks.map((t, i) => (
                    <div key={i} className="set-card-track-line">
                      {t.artist} &mdash; {t.title}{t.remix ? ` (${t.remix})` : ''}
                    </div>
                  ))}
                  {enrich.totalTracks > 2 && (
                    <div className="set-card-track-more">+ {enrich.totalTracks - 2} more tracks</div>
                  )}
                </div>
              )}
              {!enrich && (
                <div className="set-card-meta">
                  <span>{s.tracksIdentified || 0} tracks ID&apos;d</span>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </>
  );
}
