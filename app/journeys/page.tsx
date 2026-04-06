import Link from 'next/link';
import { loadAllSets, getTopTracks, getTrackHistory } from '@/lib/data';
import { trackSlug } from '@/lib/slugs';

function titleCase(str: string): string {
  if (!str) return '';
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

export default function JourneysPage() {
  loadAllSets();
  const allTracks = getTopTracks(5000);

  // Find featured journeys: tracks played by 4+ DJs across 3+ years
  const candidates = allTracks
    .filter(t => t.djs.length >= 4 && t.years.length >= 3)
    .map(t => {
      const history = getTrackHistory(t.artist, t.title);
      const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
      return {
        ...t,
        firstPlay: sorted[0],
        sortedYears: [...t.years].sort((a, b) => a - b),
      };
    })
    .sort((a, b) => b.djs.length - a.djs.length)
    .slice(0, 12);

  return (
    <>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 }}>Journeys</h2>
      <p style={{ color: 'var(--muted)', fontSize: '0.9375rem', marginBottom: 24 }}>
        Follow a track&apos;s path through Ultra
      </p>

      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: '1rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-bright)', marginBottom: 16 }}>
          Featured Journeys
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {candidates.map(t => {
            const slug = trackSlug(t.artist, t.title);
            const firstYear = t.sortedYears[0];
            const lastYear = t.sortedYears[t.sortedYears.length - 1];
            const activeYearSet = new Set(t.sortedYears);

            return (
              <Link key={t.key} href={`/journeys/${slug}`} className="card" style={{ display: 'block', textDecoration: 'none', color: 'inherit', marginBottom: 0, cursor: 'pointer' }}>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 6, lineHeight: 1.3 }}>
                  {titleCase(t.artist)} &mdash; {titleCase(t.title)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 4 }}>
                  First played: {t.firstPlay.year} by {t.firstPlay.dj}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 8 }}>
                  Spread to {t.djs.length} DJs over {t.years.length} years
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i).map(y => (
                    <div key={y} style={{ width: 6, height: 6, borderRadius: '50%', background: activeYearSet.has(y) ? 'var(--green)' : 'var(--border-lt)', flexShrink: 0 }} title={String(y)} />
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
