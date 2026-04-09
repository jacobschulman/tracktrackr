import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadIndex, loadAllSets, getYearSpotlight, getStageHistory, fmt } from '@/lib/data';
import { getFestival } from '@/lib/festivals';
import { trackSlug } from '@/lib/slugs';
import { getStageColor } from '@/lib/festivals';
import { Heatmap } from '@/components/Heatmap';
import { SpotifyButton } from '@/components/SpotifyButton';

export function generateStaticParams() {
  return [];
}

export default async function FestivalDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = getFestival(slug);
  if (!config) notFound();

  const index = loadIndex();
  loadAllSets();

  // Get festival-specific sets
  const festivalSets = index.sets.filter(s => s.festival === slug);
  if (festivalSets.length === 0) notFound();

  const years = [...new Set(festivalSets.map(s => s.year))].sort((a, b) => a - b);
  const latestYear = years[years.length - 1];
  const spotlight = getYearSpotlight(latestYear, slug);

  // DJ stats
  const djSlugs = new Set<string>();
  const stages = new Set<string>();
  for (const s of festivalSets) {
    for (const d of s.djs) djSlugs.add(d.slug);
    stages.add(s.stage);
  }

  // Stage history for this festival
  const stageData = getStageHistory(slug)
    .filter(s => s.stage !== 'Radio/Podcast' && s.stage !== 'Unknown Stage')
    .sort((a, b) => a.firstYear - b.firstYear || b.totalSets - a.totalSets);

  const minYear = years[0];
  const maxYear = years[years.length - 1];

  // DJ insight cards: most tenured + longest streak at this festival
  const djStats = new Map<string, { name: string; slug: string; years: Set<number>; totalSets: number }>();
  for (const s of festivalSets) {
    for (const d of s.djs) {
      if (!djStats.has(d.slug)) {
        djStats.set(d.slug, { name: d.name, slug: d.slug, years: new Set(), totalSets: 0 });
      }
      const entry = djStats.get(d.slug)!;
      entry.years.add(s.year);
      entry.totalSets++;
    }
  }
  let mostTenured: { name: string; slug: string; yearsCount: number; firstYear: number; lastYear: number } | null = null;
  let longestStreak: { name: string; slug: string; streak: number; totalSets: number } | null = null;
  for (const dj of djStats.values()) {
    const sortedYears = [...dj.years].sort((a, b) => a - b);
    const yearsCount = sortedYears.length;
    const firstYear = sortedYears[0];
    const lastYear = sortedYears[sortedYears.length - 1];
    if (!mostTenured || yearsCount > mostTenured.yearsCount) {
      mostTenured = { name: dj.name, slug: dj.slug, yearsCount, firstYear, lastYear };
    }
    let best = 1, cur = 1;
    for (let i = 1; i < sortedYears.length; i++) {
      if (sortedYears[i] === sortedYears[i - 1] + 1) { cur++; if (cur > best) best = cur; }
      else cur = 1;
    }
    if (!longestStreak || best > longestStreak.streak) {
      longestStreak = { name: dj.name, slug: dj.slug, streak: best, totalSets: dj.totalSets };
    }
  }

  // Convert accent hex to rgb for heatmap
  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}`;
  };
  const accentRgb = hexToRgb(config.accent);

  // DJ heatmap data
  const djYearCounts = new Map<string, { name: string; yearCounts: Record<number, number>; total: number }>();
  for (const s of festivalSets) {
    for (const d of s.djs) {
      if (!djYearCounts.has(d.slug)) {
        djYearCounts.set(d.slug, { name: d.name, yearCounts: {}, total: 0 });
      }
      const entry = djYearCounts.get(d.slug)!;
      entry.yearCounts[s.year] = (entry.yearCounts[s.year] || 0) + 1;
      entry.total++;
    }
  }
  const djHeatmapRows = [...djYearCounts.entries()]
    .filter(([, d]) => d.total >= 2)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 60)
    .map(([slug, d]) => ({ name: d.name, slug, yearCounts: d.yearCounts, total: d.total }));

  // Stage heatmap data
  const stageYearCounts = new Map<string, Record<number, number>>();
  for (const s of festivalSets) {
    if (!stageYearCounts.has(s.stage)) stageYearCounts.set(s.stage, {});
    const entry = stageYearCounts.get(s.stage)!;
    entry[s.year] = (entry[s.year] || 0) + 1;
  }
  const stageHeatmapRows = stageData.map(s => {
    const yearCounts = stageYearCounts.get(s.stage) || {};
    const total = Object.values(yearCounts).reduce((sum, v) => sum + v, 0);
    return { name: s.stage, slug: s.stage, yearCounts, total };
  });

  return (
    <>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', background: config.accent }} />
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>
            {config.shortName}
          </h1>
        </div>
        <p className="hero-subtitle">{minYear}&ndash;{maxYear}</p>
      </div>

      {/* Coming soon banner for festivals missing current year */}
      {!years.includes(new Date().getFullYear()) && (
        <div style={{
          padding: '14px 20px',
          background: `${config.accent}12`,
          border: `1px solid ${config.accent}40`,
          borderRadius: 10,
          textAlign: 'center',
          marginBottom: 24,
          fontSize: '0.875rem',
          color: 'var(--muted-lt)',
        }}>
          Not yet updated for {new Date().getFullYear()}. Check back soon!
        </div>
      )}

      {/* Stats */}
      <div className="stat-bar" style={{ marginBottom: 32 }}>
        <div className="stat-card">
          <div className="stat-number">{fmt(festivalSets.length)}</div>
          <div className="stat-label">Sets</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{fmt(djSlugs.size)}</div>
          <div className="stat-label">DJs</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{fmt(stages.size)}</div>
          <div className="stat-label">Stages</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{fmt(years.length)}</div>
          <div className="stat-label">Years</div>
        </div>
      </div>

      {/* Insight Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {mostTenured && (
          <Link
            href={`/dj/${mostTenured.slug}`}
            className="card"
            style={{ borderLeft: `3px solid ${config.accent}`, padding: '16px 20px', textDecoration: 'none' }}
          >
            <div style={{ fontSize: '0.6875rem', color: config.accent, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 }}>
              Most Tenured
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-bright)', marginBottom: 2 }}>
              {mostTenured.name}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--muted-lt)' }}>
              {mostTenured.yearsCount} years ({mostTenured.firstYear}&ndash;{mostTenured.lastYear})
            </div>
          </Link>
        )}
        {longestStreak && longestStreak.streak > 1 && (
          <Link
            href={`/dj/${longestStreak.slug}`}
            className="card"
            style={{ borderLeft: '3px solid var(--green)', padding: '16px 20px', textDecoration: 'none' }}
          >
            <div style={{ fontSize: '0.6875rem', color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 }}>
              Longest Streak
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-bright)', marginBottom: 2 }}>
              {longestStreak.name}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--muted-lt)' }}>
              {longestStreak.streak} consecutive years &middot; {longestStreak.totalSets} total sets
            </div>
          </Link>
        )}
      </div>

      {/* Latest Year Spotlight */}
      {spotlight && (
        <>
          <div className="section-title" style={{ marginBottom: 16 }}>
            {config.shortName} {latestYear}
          </div>

          {/* Fresh Faces */}
          {spotlight.debuts.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <div className="card-title">Fresh Faces</div>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                  {spotlight.debuts.length} debut{spotlight.debuts.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {spotlight.debuts.slice(0, 20).map(d => (
                  <Link key={d.slug} href={`/dj/${d.slug}`} className="pill pill-green dj-link" style={{ textDecoration: 'none' }}>
                    {d.name}
                  </Link>
                ))}
                {spotlight.debuts.length > 20 && (
                  <span className="pill" style={{ opacity: 0.6 }}>+{spotlight.debuts.length - 20} more</span>
                )}
              </div>
            </div>
          )}

          {/* Welcome Back */}
          {spotlight.comebacks.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <div className="card-title">Welcome Back</div>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                  {spotlight.comebacks.length} comeback{spotlight.comebacks.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {spotlight.comebacks.map(d => (
                  <div key={d.slug} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Link href={`/dj/${d.slug}`} className="dj-link" style={{ fontWeight: 600, textDecoration: 'none', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.name}
                    </Link>
                    <span className="pill pill-yellow" style={{ flexShrink: 0, fontSize: '0.7rem' }}>
                      back after {d.gap} yr{d.gap !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Veterans */}
          {spotlight.veterans.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <div className="card-title">The Veterans</div>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Longest active streaks</span>
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {spotlight.veterans.map(d => (
                  <div key={d.slug} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Link href={`/dj/${d.slug}`} className="dj-link" style={{ fontWeight: 600, textDecoration: 'none', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.name}
                    </Link>
                    <span className="pill pill-purple" style={{ flexShrink: 0, fontSize: '0.7rem' }}>
                      {d.streak} yr streak
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted)', flexShrink: 0 }}>since {d.since}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Track of the Festival */}
          {spotlight.topTracks.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <div className="card-title">Top Tracks &mdash; {latestYear}</div>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Top 10</span>
              </div>
              {spotlight.topTracks.map((t, i) => {
                const rank = i + 1;
                const maxPlay = spotlight.topTracks[0]?.playCount ?? 1;
                const pct = (t.playCount / maxPlay) * 100;
                return (
                  <Link key={t.key} href={`/track/${trackSlug(t.artist, t.title)}`} className="leaderboard-row" style={{ textDecoration: 'none', cursor: 'pointer' }}>
                    <div className={`leaderboard-rank ${rank <= 3 ? 'top3' : ''}`}>{rank}</div>
                    <div className="leaderboard-info">
                      <div className="leaderboard-name">{t.artist} &mdash; {t.title}</div>
                      <div className="leaderboard-meta"><span>{t.djs.length} DJ{t.djs.length !== 1 ? 's' : ''}</span></div>
                      <div className="leaderboard-bar"><div className="leaderboard-bar-fill" style={{ width: `${pct}%` }} /></div>
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
          )}

          {/* Biggest Repeater */}
          {spotlight.repeatOffenders.length > 0 && (() => {
            const top = spotlight.repeatOffenders[0];
            return (
              <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header">
                  <div className="card-title">Who Recycled the Most</div>
                </div>
                <div style={{ padding: '24px 20px' }}>
                  <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <Link href={`/dj/${top.slug}`} className="dj-link" style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--purple-lt)', textDecoration: 'none' }}>
                      {top.name}
                    </Link>
                    <div style={{ marginTop: 8, color: 'var(--muted)', fontSize: '0.9rem' }}>
                      Brought back <strong style={{ color: 'var(--purple-lt)' }}>{top.repeatedTracks.length}</strong> track{top.repeatedTracks.length !== 1 ? 's' : ''} from prior years
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {top.repeatedTracks.slice(0, 5).map(tr => (
                      <div key={tr.key} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: '0.85rem' }}>
                        <Link href={`/track/${trackSlug(tr.artist, tr.title)}`} className="track-link" style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: 'none' }}>
                          {tr.artist} &mdash; {tr.title}
                        </Link>
                        <span className="pill pill-purple" style={{ flexShrink: 0, fontSize: '0.7rem' }}>{tr.priorYears.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* DJ Continuity Heatmap */}
      {djHeatmapRows.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div className="card-title">DJ Continuity</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Top {djHeatmapRows.length} by appearances</span>
          </div>
          <Heatmap rows={djHeatmapRows} years={years} linkPrefix="/dj/" accentColor={accentRgb} />
        </div>
      )}

      {/* Stage Heatmap */}
      {stageHeatmapRows.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div className="card-title">Stages</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{stageHeatmapRows.length} stages</span>
          </div>
          <Heatmap rows={stageHeatmapRows} years={years} linkPrefix="" accentColor={accentRgb} />
        </div>
      )}

      {/* Year pills */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Years</div>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {years.map(y => (
            <Link key={y} href={`/year/${y}`} className="pill" style={{ textDecoration: 'none' }}>
              {y}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
