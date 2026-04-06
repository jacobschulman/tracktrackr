import { loadIndex, loadAllSets, getTopTracks, getYearStats, fmt } from '@/lib/data';
import { getStageColor } from '@/lib/config';
import { trackSlug, buildTrackSlugMap, slugify } from '@/lib/slugs';
import Link from 'next/link';

export function generateStaticParams() {
  const index = loadIndex();
  return index.years.map(y => ({ year: String(y) }));
}

function escHtml(str: string) {
  return str || '';
}

function pct(n: number, total: number) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

export default async function DNAYearPage({ params }: { params: Promise<{ year: string }> }) {
  const { year: yearStr } = await params;
  const index = loadIndex();
  loadAllSets();

  const selectedYear = parseInt(yearStr);
  const minYear = Math.min(...index.years);

  const stats = getYearStats(selectedYear);
  if (!stats) {
    return (
      <div className="empty-state">
        <div className="empty-state-text">No data for this year.</div>
      </div>
    );
  }

  // Get all tracks globally
  const allTracksGlobal = getTopTracks(99999);
  const tracksThisYear = allTracksGlobal.filter(t => t.years.includes(selectedYear));

  // Build DJ year map
  const djAllYears = new Map<string, Set<number>>();
  for (const s of index.sets) {
    for (const d of s.djs) {
      if (!djAllYears.has(d.slug)) djAllYears.set(d.slug, new Set());
      djAllYears.get(d.slug)!.add(s.year);
    }
  }

  // Unique tracks (only appeared this year)
  const uniqueTracks = tracksThisYear
    .filter(t => t.years.length === 1)
    .sort((a, b) => b.playCount - a.playCount || a.artist.localeCompare(b.artist))
    .slice(0, 15);

  // Crossover tracks (3+ years)
  const crossoverTracks = tracksThisYear
    .filter(t => t.years.length >= 3)
    .sort((a, b) => b.years.length - a.years.length || b.playCount - a.playCount)
    .slice(0, 10);

  // DJ mix: first-timers, returning, veterans
  const djsThisYear = new Set<string>();
  const djNameMap = new Map<string, string>();
  for (const s of index.sets) {
    if (s.year !== selectedYear) continue;
    for (const d of s.djs) {
      djsThisYear.add(d.slug);
      djNameMap.set(d.slug, d.name);
    }
  }

  const firstTimers: { slug: string; name: string }[] = [];
  const veterans: { slug: string; name: string; priorCount: number }[] = [];
  const returning: { slug: string; name: string; priorCount: number }[] = [];

  for (const slug of djsThisYear) {
    const allYrs = djAllYears.get(slug) || new Set();
    const priorYears = [...allYrs].filter(y => y < selectedYear);
    if (priorYears.length === 0 && allYrs.size === 1) {
      firstTimers.push({ slug, name: djNameMap.get(slug) || slug });
    } else if (priorYears.length >= 3) {
      veterans.push({ slug, name: djNameMap.get(slug) || slug, priorCount: priorYears.length });
    } else {
      returning.push({ slug, name: djNameMap.get(slug) || slug, priorCount: priorYears.length });
    }
  }
  veterans.sort((a, b) => b.priorCount - a.priorCount);
  firstTimers.sort((a, b) => a.name.localeCompare(b.name));

  const total = djsThisYear.size;
  const pctFirst = pct(firstTimers.length, total);
  const pctVet = pct(veterans.length, total);
  const pctRet = pct(returning.length, total);

  // Stage makeup
  const stageNames = Object.keys(stats.stages).sort((a, b) => stats.stages[b] - stats.stages[a]);

  // Year-over-year comparison
  let compYear: number | null = null;
  if (selectedYear > minYear) {
    if (index.years.includes(selectedYear - 1)) {
      compYear = selectedYear - 1;
    } else {
      const priorYears = index.years.filter(y => y < selectedYear).sort((a, b) => b - a);
      if (priorYears.length > 0 && selectedYear - priorYears[0] <= 3) {
        compYear = priorYears[0];
      }
    }
  }

  let yoyData: { returningDJs: number; newDJs: number; carriedOver: number; freshTracks: number } | null = null;
  if (compYear !== null) {
    const djsComp = new Set<string>();
    for (const s of index.sets) {
      if (s.year === compYear) {
        for (const d of s.djs) djsComp.add(d.slug);
      }
    }
    let returningDJs = 0, newDJs = 0;
    for (const slug of djsThisYear) {
      if (djsComp.has(slug)) returningDJs++;
      else newDJs++;
    }

    const trackKeysThisYear = new Set(tracksThisYear.map(t => t.key));
    const tracksCompYear = allTracksGlobal.filter(t => t.years.includes(compYear!));
    const trackKeysCompYear = new Set(tracksCompYear.map(t => t.key));
    let carriedOver = 0, freshTracks = 0;
    for (const key of trackKeysThisYear) {
      if (trackKeysCompYear.has(key)) carriedOver++;
      else freshTracks++;
    }
    yoyData = { returningDJs, newDJs, carriedOver, freshTracks };
  }

  const maxUniquePlay = uniqueTracks.length > 0 ? uniqueTracks[0].playCount : 1;

  return (
    <div>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 900, margin: 0 }}>Festival DNA</h2>
        <p style={{ color: 'var(--muted)', margin: '4px 0 0' }}>What made each year unique</p>
      </div>

      {/* Year pills */}
      <div
        className="year-pills"
        style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: 8, marginBottom: 24 }}
      >
        {index.years.map(y => (
          <Link
            key={y}
            href={`/dna/${y}`}
            className={`year-pill${y === selectedYear ? ' active' : ''}`}
          >
            {y}
          </Link>
        ))}
      </div>

      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: '3rem', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, color: 'var(--text)' }}>
          {selectedYear}
        </div>
        <div className="stat-bar" style={{ marginTop: 16, justifyContent: 'center' }}>
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
        </div>
      </div>

      {/* Only at Ultra {year} */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">Only at Ultra {selectedYear}</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            {uniqueTracks.length} unique track{uniqueTracks.length !== 1 ? 's' : ''}
          </span>
        </div>
        {uniqueTracks.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--muted)', fontSize: '0.875rem' }}>
            No tracks were exclusive to this year.
          </div>
        ) : (
          <div className="leaderboard">
            {uniqueTracks.map((t, i) => {
              const rank = i + 1;
              const barPct = (t.playCount / maxUniquePlay) * 100;
              return (
                <Link
                  key={t.key}
                  href={`/track/${trackSlug(t.artist, t.title)}`}
                  className="leaderboard-row"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div className={`leaderboard-rank${rank <= 3 ? ' top3' : ''}`}>{rank}</div>
                  <div className="leaderboard-info">
                    <div className="leaderboard-name">{t.artist} &mdash; {t.title}</div>
                    <div className="leaderboard-meta">
                      <span>{t.djs.length} DJ{t.djs.length !== 1 ? 's' : ''} played this</span>
                    </div>
                    <div className="leaderboard-bar">
                      <div className="leaderboard-bar-fill" style={{ width: `${barPct}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="leaderboard-count">{t.playCount}</div>
                    <div className="leaderboard-count-label">play{t.playCount !== 1 ? 's' : ''}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Crossover Hits */}
      {crossoverTracks.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div className="card-title">Crossover Hits</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
              Tracks connecting {selectedYear} to Ultra history
            </span>
          </div>
          <div>
            {crossoverTracks.map(t => (
              <Link
                key={t.key}
                href={`/track/${trackSlug(t.artist, t.title)}`}
                className="leaderboard-row"
                style={{ padding: '12px 16px', textDecoration: 'none', color: 'inherit' }}
              >
                <div className="leaderboard-info" style={{ flex: 1, minWidth: 0 }}>
                  <div className="leaderboard-name">{t.artist} &mdash; {t.title}</div>
                  <div className="leaderboard-meta">
                    <span>{t.djs.length} DJ{t.djs.length !== 1 ? 's' : ''} total</span>
                    <span style={{ marginLeft: 8 }}>{t.playCount} plays all-time</span>
                  </div>
                </div>
                <div>
                  <span className="pill pill-green" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    {t.years.length} years
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* The Regulars vs The Fresh */}
      {total > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div className="card-title">The Regulars vs The Fresh</div>
          </div>
          <div style={{ padding: 16 }}>
            {/* Stacked bar */}
            <div style={{ display: 'flex', height: 32, borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
              {firstTimers.length > 0 && (
                <div
                  style={{ flex: firstTimers.length, background: '#22c55e', minWidth: 2 }}
                  title={`First-timers: ${firstTimers.length} (${pctFirst}%)`}
                />
              )}
              {returning.length > 0 && (
                <div
                  style={{ flex: returning.length, background: '#3b82f6', minWidth: 2 }}
                  title={`Returning: ${returning.length} (${pctRet}%)`}
                />
              )}
              {veterans.length > 0 && (
                <div
                  style={{ flex: veterans.length, background: '#a855f7', minWidth: 2 }}
                  title={`Veterans: ${veterans.length} (${pctVet}%)`}
                />
              )}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16, fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                <span>First-timers: <strong>{firstTimers.length}</strong> ({pctFirst}%)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
                <span>Returning: <strong>{returning.length}</strong> ({pctRet}%)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#a855f7', display: 'inline-block' }} />
                <span>Veterans (3+ prior yrs): <strong>{veterans.length}</strong> ({pctVet}%)</span>
              </div>
            </div>

            {/* Top lists */}
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {firstTimers.slice(0, 5).length > 0 && (
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8, letterSpacing: '0.05em' }}>
                    Fresh Faces
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {firstTimers.slice(0, 5).map(d => (
                      <Link key={d.slug} href={`/dj/${d.slug}`} className="dj-link" style={{ fontSize: '0.85rem', textDecoration: 'none' }}>
                        {d.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {veterans.slice(0, 5).length > 0 && (
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8, letterSpacing: '0.05em' }}>
                    Veterans
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {veterans.slice(0, 5).map(d => (
                      <Link key={d.slug} href={`/dj/${d.slug}`} className="dj-link" style={{ fontSize: '0.85rem', textDecoration: 'none' }}>
                        {d.name} <span className="pill pill-purple" style={{ fontSize: '0.65rem', marginLeft: 4 }}>{d.priorCount} prior yrs</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stage Makeup */}
      {stageNames.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div className="card-title">Stage Makeup</div>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{stageNames.length} stage{stageNames.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ padding: 16 }}>
            {/* Stacked bar */}
            <div style={{ display: 'flex', height: 32, borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
              {stageNames.map(name => {
                const count = stats.stages[name];
                const color = getStageColor(name);
                return (
                  <div
                    key={name}
                    style={{ flex: count, background: color, minWidth: 2 }}
                    title={`${name}: ${count} sets (${pct(count, stats.setCount)}%)`}
                  />
                );
              })}
            </div>
            {/* Stage list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {stageNames.map(name => {
                const count = stats.stages[name];
                const color = getStageColor(name);
                return (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                    <span style={{ color: 'var(--muted)', flexShrink: 0, fontSize: '0.8rem' }}>{count} set{count !== 1 ? 's' : ''}</span>
                    <span style={{ color: 'var(--muted)', flexShrink: 0, fontSize: '0.75rem', minWidth: 32, textAlign: 'right' }}>{pct(count, stats.setCount)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Year-over-Year */}
      {compYear !== null && yoyData && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div className="card-title">Compared to {compYear}</div>
          </div>
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
              {/* DJ comparison */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10, letterSpacing: '0.05em' }}>
                  Lineup
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                  <div className="stat-card" style={{ flex: 1 }}>
                    <div className="stat-number" style={{ color: '#3b82f6' }}>{yoyData.returningDJs}</div>
                    <div className="stat-label">Returning DJs</div>
                  </div>
                  <div className="stat-card" style={{ flex: 1 }}>
                    <div className="stat-number" style={{ color: '#22c55e' }}>{yoyData.newDJs}</div>
                    <div className="stat-label">New Faces</div>
                  </div>
                </div>
                <div style={{ display: 'flex', height: 20, borderRadius: 4, overflow: 'hidden' }}>
                  {yoyData.returningDJs > 0 && <div style={{ flex: yoyData.returningDJs, background: '#3b82f6', minWidth: 2 }} />}
                  {yoyData.newDJs > 0 && <div style={{ flex: yoyData.newDJs, background: '#22c55e', minWidth: 2 }} />}
                </div>
              </div>
              {/* Track comparison */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10, letterSpacing: '0.05em' }}>
                  Tracklist
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                  <div className="stat-card" style={{ flex: 1 }}>
                    <div className="stat-number" style={{ color: '#a855f7' }}>{yoyData.carriedOver}</div>
                    <div className="stat-label">Carried Over</div>
                  </div>
                  <div className="stat-card" style={{ flex: 1 }}>
                    <div className="stat-number" style={{ color: '#f59e0b' }}>{yoyData.freshTracks}</div>
                    <div className="stat-label">Fresh Tracks</div>
                  </div>
                </div>
                <div style={{ display: 'flex', height: 20, borderRadius: 4, overflow: 'hidden' }}>
                  {yoyData.carriedOver > 0 && <div style={{ flex: yoyData.carriedOver, background: '#a855f7', minWidth: 2 }} />}
                  {yoyData.freshTracks > 0 && <div style={{ flex: yoyData.freshTracks, background: '#f59e0b', minWidth: 2 }} />}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
