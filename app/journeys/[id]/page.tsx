import Link from 'next/link';
import { loadAllSets, getTrackHistory, getTrackStreak, getAllTrackKeys, parseTrackKey } from '@/lib/data';
import { trackSlug, buildTrackSlugMap } from '@/lib/slugs';
import { StageBadge } from '@/components/StageBadge';

function titleCase(str: string): string {
  if (!str) return '';
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '\u2014';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function generateStaticParams() {
  loadAllSets();
  const keys = getAllTrackKeys();
  return keys.map(key => {
    const { artist, title } = parseTrackKey(key);
    return { id: trackSlug(artist, title) };
  });
}

export default async function JourneyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  loadAllSets();

  const keys = getAllTrackKeys();
  const { slugToKey } = buildTrackSlugMap(keys);
  const internalKey = slugToKey.get(resolvedParams.id);

  if (!internalKey) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">?</div>
        <div className="empty-state-text">Track not found.</div>
      </div>
    );
  }

  const { artist, title } = parseTrackKey(internalKey);
  const displayArtist = titleCase(artist);
  const displayTitle = titleCase(title);
  const history = getTrackHistory(artist, title);
  const streak = getTrackStreak(artist, title);

  if (history.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">?</div>
        <div className="empty-state-text">Track not found in any set.</div>
      </div>
    );
  }

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));

  // Group by year
  const byYear: Record<number, typeof sorted> = {};
  for (const a of sorted) {
    if (!byYear[a.year]) byYear[a.year] = [];
    byYear[a.year].push(a);
  }
  const yearKeys = Object.keys(byYear).map(Number).sort((a, b) => a - b);

  // Track DJ data
  const djFirstYear: Record<string, number> = {};
  const djPlayCounts: Record<string, number> = {};
  const djNameMap: Record<string, string> = {};
  for (const year of yearKeys) {
    for (const a of byYear[year]) {
      const slug = a.djSlugs?.[0] || a.dj;
      if (!djFirstYear[slug]) djFirstYear[slug] = year;
      djPlayCounts[slug] = (djPlayCounts[slug] || 0) + 1;
      djNameMap[slug] = a.dj;
    }
  }

  const origin = sorted[0];
  const originSlug = origin.djSlugs?.[0] || '';
  const originPlayCount = sorted.filter(a => a.dj === origin.dj).length;

  // Peak year
  let peakYear = yearKeys[0];
  let peakCount = 0;
  for (const year of yearKeys) {
    const count = new Set(byYear[year].map(a => a.djSlugs?.[0] || a.dj)).size;
    if (count > peakCount) { peakCount = count; peakYear = year; }
  }

  const totalCarriers = Object.keys(djFirstYear).length;
  const lifespanStr = yearKeys.length === 1 ? `${yearKeys[0]}` : `${yearKeys[0]} \u2014 ${yearKeys[yearKeys.length - 1]}`;

  // Build carriers sorted by first year
  const carriers = Object.entries(djFirstYear)
    .map(([slug, firstYear]) => ({ slug, name: djNameMap[slug], firstYear, totalPlays: djPlayCounts[slug], hasSlug: slug !== djNameMap[slug] }))
    .sort((a, b) => a.firstYear - b.firstYear || a.name.localeCompare(b.name));

  // Build spread timeline
  const seenForTimeline = new Set<string>();

  return (
    <>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 6 }}>
          <Link href={`/track/${trackSlug(artist, title)}`} style={{ color: 'var(--text-bright)', textDecoration: 'none' }}>
            {displayArtist} &mdash; {displayTitle}
          </Link>
        </h1>
        <span className="pill pill-purple">
          {yearKeys.length === 1 ? yearKeys[0] : `${yearKeys[0]}\u2013${yearKeys[yearKeys.length - 1]}`}
        </span>
      </div>

      {/* Origin Story */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header"><div className="card-title">The Origin Story</div></div>
        <div style={{ padding: '4px 0' }}>
          <div style={{ fontSize: '0.9375rem', lineHeight: 1.6 }}>
            First played at Ultra on <strong style={{ color: 'var(--text-bright)' }}>{formatDate(origin.date)}</strong>
            {' '}by{' '}
            {originSlug ? (
              <Link href={`/dj/${originSlug}`} className="dj-link">{origin.dj}</Link>
            ) : origin.dj}
            {' '}at <StageBadge stage={origin.stage} />
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginTop: 4 }}>
            {originPlayCount === 1
              ? 'They only played it once at Ultra.'
              : `They went on to play it ${originPlayCount} times total at Ultra.`}
          </div>
        </div>
      </div>

      {/* Spread Timeline */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header"><div className="card-title">The Spread Timeline</div></div>
        <div style={{ padding: '0 0 8px' }}>
          {yearKeys.map(year => {
            const appearances = byYear[year];
            const djsThisYear = new Map<string, { name: string; slug: string; stage: string; isNew: boolean; count: number }>();
            for (const a of appearances) {
              const slug = a.djSlugs?.[0] || a.dj;
              if (!djsThisYear.has(slug)) {
                djsThisYear.set(slug, { name: a.dj, slug: a.djSlugs?.[0] || '', stage: a.stage, isNew: !seenForTimeline.has(slug), count: 0 });
              }
              djsThisYear.get(slug)!.count++;
            }
            for (const slug of djsThisYear.keys()) seenForTimeline.add(slug);
            const djCount = djsThisYear.size;

            return (
              <div key={year} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '16px 0', borderLeft: '2px solid var(--border)', marginLeft: 40, paddingLeft: 20, position: 'relative' }}>
                <div style={{ position: 'absolute', left: -10, top: 20, width: 18, height: 18, borderRadius: '50%', background: 'var(--surface)', border: '2px solid var(--purple-lt)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--purple-lt)' }} />
                </div>
                <div style={{ minWidth: 50, flexShrink: 0 }}>
                  <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--purple-lt)' }}>{year}</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--muted)' }}>{djCount} DJ{djCount !== 1 ? 's' : ''}</div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1 }}>
                  {[...djsThisYear.values()].map(d => (
                    <div key={d.slug || d.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--surface2)', borderRadius: 8, margin: '3px 0' }}>
                      {d.slug ? (
                        <Link href={`/dj/${d.slug}`} className="dj-link" style={{ fontSize: '0.8125rem' }}>{d.name}</Link>
                      ) : (
                        <span style={{ fontSize: '0.8125rem' }}>{d.name}</span>
                      )}
                      {d.isNew ? (
                        <span style={{ background: 'var(--green-dim)', color: 'var(--green)', borderRadius: 100, padding: '2px 8px', fontSize: '0.6875rem', fontWeight: 600 }}>NEW</span>
                      ) : djPlayCounts[d.slug || d.name] > 1 ? (
                        <span className="pill pill-purple" style={{ fontSize: '0.625rem' }}>{djPlayCounts[d.slug || d.name]}x</span>
                      ) : null}
                      <span style={{ fontSize: '0.75rem' }}><StageBadge stage={d.stage} /></span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Journey Stats */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header"><div className="card-title">Journey Stats</div></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
          <div className="stat-card">
            <div className="stat-number" style={{ fontSize: '1rem' }}>
              {originSlug ? (
                <Link href={`/dj/${originSlug}`} className="dj-link">{origin.dj}</Link>
              ) : origin.dj}
            </div>
            <div className="stat-label">Patient Zero</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{peakYear}</div>
            <div className="stat-label">Peak Year ({peakCount} DJs)</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{totalCarriers}</div>
            <div className="stat-label">Total Carriers</div>
          </div>
          <div className="stat-card">
            <div className="stat-number" style={{ fontSize: '1rem' }}>{lifespanStr}</div>
            <div className="stat-label">Lifespan</div>
          </div>
        </div>
      </div>

      {/* All Carriers */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">All Carriers</div>
          <div className="text-muted" style={{ fontSize: '0.75rem' }}>{carriers.length} DJs</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>DJ</th>
                <th>First Played</th>
                <th>Total Plays</th>
              </tr>
            </thead>
            <tbody>
              {carriers.map(c => (
                <tr key={c.slug}>
                  <td>
                    {c.hasSlug ? (
                      <Link href={`/dj/${c.slug}`} className="dj-link">{c.name}</Link>
                    ) : c.name}
                  </td>
                  <td>{c.firstYear}</td>
                  <td>{c.totalPlays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Back link */}
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <Link href="/journeys" style={{ color: 'var(--purple-lt)', textDecoration: 'none', fontSize: '0.9375rem' }}>
          &larr; Explore another track
        </Link>
      </div>
    </>
  );
}
