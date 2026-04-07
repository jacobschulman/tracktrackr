import Link from 'next/link';
import { loadIndex, loadAllSets, getYearSpotlight } from '@/lib/data';
import { fmt } from '@/lib/data';
import { trackSlug } from '@/lib/slugs';

function djDisplayName(slug: string, spotlight: ReturnType<typeof getYearSpotlight>): string {
  if (!spotlight) return slug;
  for (const s of spotlight.sets) {
    for (const d of s.djs) {
      if (d.slug === slug) return d.name;
    }
  }
  return slug;
}

export default function HomePage() {
  const index = loadIndex();
  loadAllSets();
  const latestYear = Math.max(...index.years);
  const spotlight = getYearSpotlight(latestYear);

  if (!spotlight) {
    return (
      <div className="empty-state">
        <div className="empty-state-text">No data available.</div>
      </div>
    );
  }

  const topTrack = spotlight.topTracks?.[0];
  const topRecycler = spotlight.repeatOffenders?.[0];
  const maxPlayCount = spotlight.topTracks?.[0]?.playCount ?? 1;

  return (
    <>
      {/* Hero */}
      <div className="hero-welcome" style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>
          Ultra {latestYear}
        </h1>
        <p className="hero-subtitle">The year at a glance</p>
      </div>

      {/* Stat Cards */}
      <div className="stat-bar" style={{ marginBottom: 32 }}>
        <div className="stat-card">
          <div className="stat-number">{fmt(spotlight.setCount)}</div>
          <div className="stat-label">Sets</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{fmt(spotlight.djCount)}</div>
          <div className="stat-label">DJs</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{fmt(spotlight.stageCount)}</div>
          <div className="stat-label">Stages</div>
        </div>
      </div>

      {/* Fresh Faces (Debuts) */}
      {spotlight.debuts.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div className="card-title">Fresh Faces</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
              {spotlight.debuts.length} debut{spotlight.debuts.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {spotlight.debuts.map((d) => (
              <Link
                key={d.slug}
                href={`/dj/${d.slug}`}
                className="pill pill-green dj-link"
                style={{ textDecoration: 'none' }}
              >
                {d.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Welcome Back (Comebacks) */}
      {spotlight.comebacks.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div className="card-title">Welcome Back</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
              {spotlight.comebacks.length} comeback{spotlight.comebacks.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {spotlight.comebacks.map((d) => (
              <div key={d.slug} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Link
                  href={`/dj/${d.slug}`}
                  className="dj-link"
                  style={{
                    fontWeight: 600,
                    textDecoration: 'none',
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
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

      {/* The Veterans */}
      {spotlight.veterans.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div className="card-title">The Veterans</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Longest active streaks</span>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {spotlight.veterans.map((d) => (
              <div key={d.slug} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Link
                  href={`/dj/${d.slug}`}
                  className="dj-link"
                  style={{
                    fontWeight: 600,
                    textDecoration: 'none',
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {d.name}
                </Link>
                <span className="pill pill-purple" style={{ flexShrink: 0, fontSize: '0.7rem' }}>
                  {d.streak} yr streak
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--muted)', flexShrink: 0 }}>
                  since {d.since}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Track of the Festival */}
      {topTrack && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div className="card-title">Track of the Festival</div>
          </div>
          <div style={{ padding: '24px 20px', textAlign: 'center' }}>
            <Link
              href={`/track/${trackSlug(topTrack.artist, topTrack.title)}`}
              className="track-link"
              style={{
                fontSize: '1.75rem',
                fontWeight: 900,
                color: 'var(--green)',
                textDecoration: 'none',
                lineHeight: 1.3,
                display: 'block',
              }}
            >
              {topTrack.artist} &mdash; {topTrack.title}
            </Link>
            <div style={{ marginTop: 12, color: 'var(--muted)', fontSize: '0.9rem' }}>
              Played{' '}
              <strong style={{ color: 'var(--green)' }}>{topTrack.playCount}</strong>{' '}
              time{topTrack.playCount !== 1 ? 's' : ''} across{' '}
              {topTrack.tlIds ? topTrack.tlIds.length : topTrack.djs.length}{' '}
              set{(topTrack.tlIds ? topTrack.tlIds.length : topTrack.djs.length) !== 1 ? 's' : ''}
            </div>
            <div
              style={{
                marginTop: 14,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
                justifyContent: 'center',
              }}
            >
              {topTrack.tlIds
                ? topTrack.tlIds.slice(0, 8).map((tlId: string) => {
                    const setObj = spotlight.sets.find((s) => s.tlId === tlId);
                    if (!setObj) return null;
                    const name = setObj.dj || setObj.djs.map((d: any) => d.name).join(' & ');
                    return (
                      <Link
                        key={tlId}
                        href={`/set/${tlId}`}
                        className="pill pill-purple dj-link"
                        style={{ textDecoration: 'none' }}
                      >
                        {name}
                      </Link>
                    );
                  })
                : topTrack.djs.slice(0, 8).map((djSlugVal: string) => (
                    <Link
                      key={djSlugVal}
                      href={`/dj/${djSlugVal}`}
                      className="pill pill-purple dj-link"
                      style={{ textDecoration: 'none' }}
                    >
                      {djDisplayName(djSlugVal, spotlight)}
                    </Link>
                  ))
              }
              {(topTrack.tlIds ? topTrack.tlIds.length : topTrack.djs.length) > 8 && (
                <span className="pill" style={{ opacity: 0.6 }}>
                  +{(topTrack.tlIds ? topTrack.tlIds.length : topTrack.djs.length) - 8} more
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Who Recycled the Most */}
      {topRecycler && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div className="card-title">Who Recycled the Most</div>
          </div>
          <div style={{ padding: '24px 20px' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <Link
                href={`/dj/${topRecycler.slug}`}
                className="dj-link"
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 900,
                  color: 'var(--purple-lt)',
                  textDecoration: 'none',
                }}
              >
                {topRecycler.name}
              </Link>
              <div style={{ marginTop: 8, color: 'var(--muted)', fontSize: '0.9rem' }}>
                Brought back{' '}
                <strong style={{ color: 'var(--purple-lt)' }}>
                  {topRecycler.repeatedTracks.length}
                </strong>{' '}
                track{topRecycler.repeatedTracks.length !== 1 ? 's' : ''} from prior years{' '}
                <span style={{ opacity: 0.6 }}>
                  ({topRecycler.totalTracksThisYear} total in set)
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topRecycler.repeatedTracks.slice(0, 5).map((tr) => (
                <div
                  key={tr.key}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 8,
                    fontSize: '0.85rem',
                  }}
                >
                  <Link
                    href={`/track/${trackSlug(tr.artist, tr.title)}`}
                    className="track-link"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      textDecoration: 'none',
                    }}
                  >
                    {tr.artist} &mdash; {tr.title}
                  </Link>
                  <span
                    className="pill pill-purple"
                    style={{ flexShrink: 0, fontSize: '0.7rem' }}
                  >
                    {tr.priorYears.join(', ')}
                  </span>
                </div>
              ))}
              {topRecycler.repeatedTracks.length > 5 && (
                <div style={{ textAlign: 'center', marginTop: 4 }}>
                  <Link
                    href={`/dj/${topRecycler.slug}`}
                    className="dj-link"
                    style={{ fontSize: '0.8rem', color: 'var(--muted)', textDecoration: 'none' }}
                  >
                    View all {topRecycler.repeatedTracks.length} repeated tracks &rarr;
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Most Played This Year */}
      {spotlight.topTracks.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div className="card-title">Most Played This Year</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Top 10</span>
          </div>
          {spotlight.topTracks.map((t, i) => {
            const rank = i + 1;
            const top3class = rank <= 3 ? 'top3' : '';
            const pct = (t.playCount / maxPlayCount) * 100;

            return (
              <Link
                key={t.key}
                href={`/track/${trackSlug(t.artist, t.title)}`}
                className="leaderboard-row"
                style={{ textDecoration: 'none', cursor: 'pointer' }}
              >
                <div className={`leaderboard-rank ${top3class}`}>{rank}</div>
                <div className="leaderboard-info">
                  <div className="leaderboard-name">
                    {t.artist} &mdash; {t.title}
                  </div>
                  <div className="leaderboard-meta">
                    <span>
                      {t.djs.length} DJ{t.djs.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="leaderboard-bar">
                    <div
                      className="leaderboard-bar-fill"
                      style={{ width: `${pct}%` }}
                    />
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
      )}
    </>
  );
}
