import Link from 'next/link';
import { loadIndex, loadAllSets, getTopTracks, getFestivalSummaries, fmt } from '@/lib/data';
import { trackSlug } from '@/lib/slugs';
import { FestivalBadge } from '@/components/FestivalBadge';
import { SpotifyButton } from '@/components/SpotifyButton';

export default function HomePage() {
  const index = loadIndex();
  loadAllSets();

  const totalSets = index.sets.length;
  const totalDJs = new Set(index.sets.flatMap(s => s.djs.map(d => d.slug))).size;
  const totalFestivals = getFestivalSummaries().length;
  const festivalSummaries = getFestivalSummaries();

  // Find most recent festival (by max date)
  const recentFestival = festivalSummaries
    .map(f => {
      const fSets = index.sets.filter(s => s.festival === f.slug);
      const maxDate = fSets.reduce((max, s) => s.date > max ? s.date : max, '');
      const maxYear = fSets.reduce((max, s) => s.year > max ? s.year : max, 0);
      return { ...f, maxDate, maxYear, setCount: fSets.filter(s => s.year === maxYear).length };
    })
    .sort((a, b) => b.maxDate.localeCompare(a.maxDate))[0];

  // Top tracks across all festivals this year
  const latestYear = Math.max(...index.years);
  const topTracks = getTopTracks(5, { year: latestYear });
  const maxPlayCount = topTracks[0]?.playCount ?? 1;

  // Up Next: Coachella (if it exists in the data)
  const upNextFestival = festivalSummaries.find(f => f.slug === 'coachella') || null;

  // Top festivals by set count for the grid
  const topFestivals = festivalSummaries.slice(0, 6);

  return (
    <>
      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '40px 0 32px' }}>
        <h1 style={{ fontSize: '2.75rem', fontWeight: 900, letterSpacing: '-0.03em', margin: 0, lineHeight: 1.1 }}>
          TrackTrackr
        </h1>
        <p style={{ fontSize: '1.0625rem', color: 'var(--muted-lt)', marginTop: 12, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
          Listen to festival sets. Dive deep into tracklists. Discover your next favorite track.
        </p>
      </div>

      {/* Global stats */}
      <div className="stat-bar" style={{ marginBottom: 32 }}>
        <div className="stat-card">
          <div className="stat-number">{fmt(totalFestivals)}</div>
          <div className="stat-label">Festivals</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{fmt(totalDJs)}</div>
          <div className="stat-label">DJs</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{fmt(index.years.length)}</div>
          <div className="stat-label">Years</div>
        </div>
      </div>

      {/* Latest festival spotlight */}
      {recentFestival && (
        <Link
          href={`/festivals/${recentFestival.slug}`}
          className="card"
          style={{
            display: 'block',
            marginBottom: 12,
            textDecoration: 'none',
            color: 'inherit',
            borderLeft: `4px solid ${recentFestival.accent}`,
          }}
        >
          <div style={{ padding: '28px 24px' }}>
            <div style={{ fontSize: '0.6875rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 10 }}>
              Latest Festival
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <FestivalBadge festival={recentFestival.slug} size="md" />
              <span style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
                {recentFestival.shortName} {recentFestival.maxYear}
              </span>
            </div>
            <div style={{ fontSize: '0.9375rem', color: 'var(--muted-lt)' }}>
              {recentFestival.setCount} sets this year &middot; {fmt(recentFestival.totalSets)} total across {recentFestival.years.length} years
            </div>
            <div style={{ marginTop: 14, fontSize: '0.875rem', color: recentFestival.accent, fontWeight: 600 }}>
              Explore {recentFestival.shortName} &rarr;
            </div>
          </div>
        </Link>
      )}

      {/* Up Next */}
      {upNextFestival && (
        <Link
          href={`/festivals/${upNextFestival.slug}`}
          className="card"
          style={{
            display: 'block',
            marginBottom: 24,
            textDecoration: 'none',
            color: 'inherit',
            borderLeft: `4px solid ${upNextFestival.accent}`,
          }}
        >

          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <FestivalBadge festival={upNextFestival.slug} size="md" />
              <div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Up Next</div>
                <div style={{ fontWeight: 700, fontSize: '1.0625rem' }}>{upNextFestival.shortName}</div>
              </div>
            </div>
            <div style={{ fontSize: '0.8125rem', color: upNextFestival.accent, fontWeight: 600 }}>
              View history &rarr;
            </div>
          </div>
        </Link>
      )}

      {/* Festivals grid */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">Explore Other Festivals</div>
          <Link href="/festivals" style={{ fontSize: '0.75rem', color: 'var(--purple-lt)', textDecoration: 'none' }}>View all &rarr;</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, padding: '4px 0' }}>
          {topFestivals.map(f => (
            <Link
              key={f.slug}
              href={`/festivals/${f.slug}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                background: 'var(--surface)',
                borderRadius: 8,
                textDecoration: 'none',
                color: 'inherit',
                borderLeft: `3px solid ${f.accent}`,
                transition: 'background 0.15s',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{f.shortName}</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--muted)' }}>
                  {fmt(f.totalSets)} sets &middot; {f.years.length} years
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Top tracks this year */}
      {topTracks.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div className="card-title">Most Played in {latestYear}</div>
            <Link href="/tracks" style={{ fontSize: '0.75rem', color: 'var(--purple-lt)', textDecoration: 'none' }}>View all &rarr;</Link>
          </div>
          {topTracks.map((t, i) => {
            const rank = i + 1;
            const pct = (t.playCount / maxPlayCount) * 100;
            return (
              <Link
                key={t.key}
                href={`/track/${trackSlug(t.artist, t.title)}`}
                className="leaderboard-row"
                style={{ textDecoration: 'none', cursor: 'pointer' }}
              >
                <div className={`leaderboard-rank ${rank <= 3 ? 'top3' : ''}`}>{rank}</div>
                <div className="leaderboard-info">
                  <div className="leaderboard-name">{t.artist} &mdash; {t.title}</div>
                  <div className="leaderboard-meta">
                    <span>{t.djs.length} DJ{t.djs.length !== 1 ? 's' : ''}</span>
                    {t.festivals.length > 1 && (
                      <>
                        <span className="sep">&middot;</span>
                        <span>{t.festivals.length} festivals</span>
                      </>
                    )}
                  </div>
                  <div className="leaderboard-bar">
                    <div className="leaderboard-bar-fill" style={{ width: `${pct}%` }} />
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
      )}

      {/* Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
        <Link href="/djs" className="card" style={{ textDecoration: 'none', color: 'inherit', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>&#9678;</div>
          <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>DJs</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Leaderboards & profiles</div>
        </Link>
        <Link href="/sets" className="card" style={{ textDecoration: 'none', color: 'inherit', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>&#9719;</div>
          <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Sets</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Browse & listen</div>
        </Link>
        <Link href="/tracks" className="card" style={{ textDecoration: 'none', color: 'inherit', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>&#9835;</div>
          <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Tracks</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Most played & trending</div>
        </Link>
        <Link href="/festivals" className="card" style={{ textDecoration: 'none', color: 'inherit', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>&#11177;</div>
          <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Festivals</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>All {totalFestivals} festivals</div>
        </Link>
      </div>
    </>
  );
}
