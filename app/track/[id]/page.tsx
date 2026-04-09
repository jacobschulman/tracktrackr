import {
  loadIndex,
  loadAllSets,
  getTrackHistory,
  getTrackStreak,
  getBlendAppearances,
  getAllTrackKeys,
  parseTrackKey,
  fmt,
} from '@/lib/data';
import { trackSlug, buildTrackSlugMap } from '@/lib/slugs';

import { StageBadge } from '@/components/StageBadge';
import Link from 'next/link';

// Only pre-build top tracks; rest rendered on-demand by Vercel
export function generateStaticParams() {
  return [];
}

function titleCase(str: string): string {
  if (!str) return '';
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '\u2014';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default async function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  loadAllSets();

  // Reverse lookup: slug -> trackKey
  const keys = getAllTrackKeys();
  const { slugToKey } = buildTrackSlugMap(keys);
  const internalKey = slugToKey.get(id);

  if (!internalKey) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">?</div>
        <div className="empty-state-text">Track not found.</div>
      </div>
    );
  }

  const { artist, title } = parseTrackKey(internalKey);
  const history = getTrackHistory(artist, title);
  const streak = getTrackStreak(artist, title);
  const blends = getBlendAppearances(artist, title);

  if (history.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">?</div>
        <div className="empty-state-text">Track not found in any set.</div>
      </div>
    );
  }

  const displayArtist = titleCase(artist);
  const displayTitle = titleCase(title);
  const spotifySearch = encodeURIComponent(`${displayArtist} ${displayTitle}`);

  const mashupPlays = history.filter(
    (a) => a.matchType === 'mashup-inferred'
  ).length;
  const playCountText =
    mashupPlays > 0
      ? `${history.length} plays (${mashupPlays} via mashup)`
      : `${history.length} play${history.length !== 1 ? 's' : ''}`;

  const yearSpan =
    streak.years && streak.years.length > 0
      ? `${Math.min(...streak.years)}\u2013${Math.max(...streak.years)}`
      : '';

  // Orbit Timeline
  const index = loadIndex();
  const minYear = Math.min(...index.years);
  const maxYear = Math.max(...index.years);
  const orbitByYear = streak.orbitByYear || {};
  const activeYears = new Set(streak.years || []);
  const maxOrbit = Math.max(1, ...Object.values(orbitByYear));

  // DJ play counts
  const djPlayCounts: Record<string, number> = {};
  const djSlugMap: Record<string, string> = {};
  const djYearsMap: Record<string, Set<number>> = {};
  for (const a of history) {
    const djName = a.dj;
    djPlayCounts[djName] = (djPlayCounts[djName] || 0) + 1;
    if (a.djSlugs && a.djSlugs[0]) {
      djSlugMap[djName] = a.djSlugs[0];
    }
    if (!djYearsMap[djName]) djYearsMap[djName] = new Set();
    djYearsMap[djName].add(a.year);
  }

  const sortedDJs = Object.entries(djPlayCounts).sort((a, b) => b[1] - a[1]);
  const uniqueDJCount = sortedDJs.length;

  // Champion
  const topDJ = sortedDJs[0];
  const topName = topDJ[0];
  const topCount = topDJ[1];
  const topSlug = djSlugMap[topName] || '';
  const topYears = djYearsMap[topName]
    ? [...djYearsMap[topName]].sort()
    : [];
  const topYearsStr = topYears.join(', ');
  const hasChampion = topCount > 1;
  const otherDJCount = uniqueDJCount - 1;

  // DJ Cloud
  const cloudDJs = hasChampion ? sortedDJs.slice(1) : sortedDJs;

  return (
    <>
      {/* Header */}
      <div className="detail-header">
        <h1 className="detail-name">
          {displayArtist} &mdash; {displayTitle}
        </h1>
        <div className="detail-meta">
          <span className="pill pill-purple">{playCountText}</span>
          <a
            href={`https://open.spotify.com/search/${spotifySearch}`}
            target="_blank"
            rel="noopener"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 12px',
              background: 'var(--green-dim)',
              borderRadius: '100px',
              fontSize: '0.75rem',
              color: 'var(--green)',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
            Spotify
          </a>
          {yearSpan && <span className="pill">{yearSpan}</span>}
        </div>
      </div>

      {/* Stats Row */}
      <div className="stats-row" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-number">{history.length}</div>
          <div className="stat-label">Plays</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{streak.totalYears}</div>
          <div className="stat-label">Years</div>
        </div>
        {streak.streak > 1 && (
          <div className="stat-card">
            <div className="stat-number">{streak.streak}</div>
            <div className="stat-label">Year Streak</div>
          </div>
        )}
        <div className="stat-card">
          <div className="stat-number">{uniqueDJCount}</div>
          <div className="stat-label">Unique DJs</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{blends.length}</div>
          <div className="stat-label">Blends</div>
        </div>
      </div>

      {/* Orbit Timeline */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div className="card-title">Orbit Timeline</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              minWidth: 'max-content',
              padding: '8px 0',
            }}
          >
            {Array.from(
              { length: maxYear - minYear + 1 },
              (_, i) => minYear + i
            ).map((y) => {
              const active = activeYears.has(y);
              const djCount = orbitByYear[y] || 0;
              const size = active
                ? Math.max(10, Math.round(8 + 20 * (djCount / maxOrbit)))
                : 6;
              return (
                <div
                  key={y}
                  className="timeline-dot"
                  style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    background: active ? 'var(--green)' : 'transparent',
                    border: active ? 'none' : '1.5px solid var(--border-lt)',
                  }}
                  title={
                    active
                      ? `${y}: ${djCount} DJ${djCount !== 1 ? 's' : ''}`
                      : `${y}`
                  }
                />
              );
            })}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '4px',
              minWidth: 'max-content',
            }}
          >
            {Array.from(
              { length: maxYear - minYear + 1 },
              (_, i) => minYear + i
            ).map((y) => {
              const active = activeYears.has(y);
              const djCount = orbitByYear[y] || 0;
              const size = active
                ? Math.max(10, Math.round(8 + 20 * (djCount / maxOrbit)))
                : 6;
              const showLabel = y % 5 === 0 || y === minYear || y === maxYear;
              return (
                <div
                  key={y}
                  style={{
                    width: `${size}px`,
                    textAlign: 'center',
                    fontSize: '0.5625rem',
                    color: 'var(--muted)',
                    flexShrink: 0,
                  }}
                >
                  {showLabel ? y : ''}
                </div>
              );
            })}
          </div>
        </div>
        <div
          style={{
            marginTop: '12px',
            display: 'flex',
            gap: '16px',
            fontSize: '0.75rem',
            color: 'var(--muted)',
          }}
        >
          <span>
            <strong style={{ color: 'var(--text)' }}>{streak.totalYears}</strong>{' '}
            years played
          </span>
          {streak.streak > 1 && (
            <span>
              <strong style={{ color: 'var(--text)' }}>{streak.streak}</strong>
              -year streak ({streak.startYear}&ndash;{streak.endYear})
            </span>
          )}
        </div>
      </div>

      {/* Champion */}
      {hasChampion && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <div className="card-title">The Champion</div>
          </div>
          <div style={{ padding: '8px 0 4px' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, lineHeight: 1.2 }}>
              {topSlug ? (
                <Link
                  href={`/dj/${topSlug}`}
                  style={{ color: 'var(--green)', textDecoration: 'none' }}
                >
                  {topName}
                </Link>
              ) : (
                <span style={{ color: 'var(--green)' }}>{topName}</span>
              )}
            </div>
            <div
              style={{
                fontSize: '0.875rem',
                color: 'var(--muted)',
                marginTop: '6px',
              }}
            >
              played it{' '}
              <strong style={{ color: 'var(--text)' }}>{topCount} times</strong>{' '}
              across {topYearsStr}
            </div>
            {otherDJCount > 0 && (
              <div
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--muted-lt)',
                  marginTop: '12px',
                }}
              >
                and {otherDJCount} other DJ{otherDJCount !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      )}

      {/* DJ Cloud */}
      {cloudDJs.length > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <div className="card-title">
              {hasChampion ? 'Also Played By' : 'Played By'}
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              justifyContent: 'center',
              padding: '8px 0',
            }}
          >
            {cloudDJs.map(([name, count]) => {
              const slug = djSlugMap[name] || '';
              const years = djYearsMap[name]
                ? [...djYearsMap[name]].sort()
                : [];
              let fontSize: string;
              let color: string;
              if (count >= 3) {
                fontSize = '1.125rem';
                color = 'var(--green)';
              } else if (count === 2) {
                fontSize = '1rem';
                color = 'var(--text)';
              } else {
                fontSize = '0.8125rem';
                color = 'var(--muted-lt)';
              }
              const fontWeight = count >= 2 ? 700 : 400;

              return (
                <div key={name} style={{ textAlign: 'center' }}>
                  {slug ? (
                    <Link
                      href={`/dj/${slug}`}
                      style={{
                        color,
                        textDecoration: 'none',
                        fontSize,
                        fontWeight,
                      }}
                    >
                      {name}
                    </Link>
                  ) : (
                    <span style={{ color, fontSize, fontWeight }}>{name}</span>
                  )}
                  <div
                    style={{
                      fontSize: '0.5625rem',
                      color: 'var(--muted)',
                      marginTop: '2px',
                    }}
                  >
                    {years.join(', ')}
                    {count > 1 ? ` (${count}x)` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Play History */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div className="card-title">Play History</div>
          <div className="text-muted" style={{ fontSize: '0.75rem' }}>
            {history.length} appearance{history.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>DJ</th>
                <th>Stage</th>
                <th>Date</th>
                <th>Set</th>
              </tr>
            </thead>
            <tbody>
              {history.map((a, i) => {
                const djSlugVal =
                  a.djSlugs && a.djSlugs[0] ? a.djSlugs[0] : '';
                const dateFormatted = formatDate(a.date);
                return (
                  <tr key={`${a.tlId}-${i}`}>
                    <td>{a.year}</td>
                    <td>
                      {djSlugVal ? (
                        <Link href={`/dj/${djSlugVal}`} className="dj-link">
                          {a.dj}
                        </Link>
                      ) : (
                        a.dj
                      )}
                      {a.matchType === 'mashup-inferred' && (
                        <span
                          title="Inferred from a mashup/medley entry on 1001Tracklists"
                          style={{
                            fontSize: '0.625rem',
                            color: 'var(--muted)',
                            cursor: 'help',
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                            padding: '1px 4px',
                            marginLeft: '4px',
                          }}
                        >
                          via mashup
                        </span>
                      )}
                    </td>
                    <td>
                      <StageBadge stage={a.stage} />
                    </td>
                    <td>{dateFormatted}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {a.tlId ? (
                        <Link
                          href={`/set/${a.tlId}`}
                          className="track-link"
                          style={{ fontSize: '0.8125rem' }}
                        >
                          Set
                        </Link>
                      ) : (
                        '\u2014'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Blend Appearances */}
      {blends.length > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <div className="card-title">Blend Appearances</div>
            <div className="text-muted" style={{ fontSize: '0.75rem' }}>
              {blends.length} blend{blends.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>DJ</th>
                  <th>Blended With</th>
                  <th>Set</th>
                </tr>
              </thead>
              <tbody>
                {blends.map((b, i) => {
                  const djSlugVal =
                    b.djSlugs && b.djSlugs[0] ? b.djSlugs[0] : '';
                  return (
                    <tr key={`${b.tlId}-${i}`}>
                      <td>{b.year}</td>
                      <td>
                        {djSlugVal ? (
                          <Link href={`/dj/${djSlugVal}`} className="dj-link">
                            {b.dj}
                          </Link>
                        ) : (
                          b.dj
                        )}
                      </td>
                      <td>
                        {b.pairedWith.map((p, pi) => (
                          <span key={pi}>
                            {pi > 0 && ', '}
                            <Link
                              href={`/track/${trackSlug(p.artist, p.title)}`}
                              className="track-link"
                              style={{ fontSize: '0.8125rem' }}
                            >
                              {p.artist} &mdash; {p.title}
                              {p.remix ? ` (${p.remix})` : ''}
                            </Link>
                          </span>
                        ))}
                      </td>
                      <td>
                        {b.tlId ? (
                          <Link
                            href={`/set/${b.tlId}`}
                            className="track-link"
                            style={{ fontSize: '0.8125rem' }}
                          >
                            View Set
                          </Link>
                        ) : (
                          '\u2014'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
