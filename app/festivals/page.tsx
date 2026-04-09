import Link from 'next/link';
import { loadIndex, getFestivalSummaries, fmt } from '@/lib/data';

export default function FestivalsPage() {
  loadIndex();
  const summaries = getFestivalSummaries();

  if (summaries.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-text">No festival data available.</div>
      </div>
    );
  }

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>
          Festivals
        </h1>
        <p className="hero-subtitle">{summaries.length} festival{summaries.length !== 1 ? 's' : ''} tracked</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {summaries.map(f => {
          const yearRange = f.years.length > 0
            ? `${f.years[0]}\u2013${f.years[f.years.length - 1]}`
            : 'No data';

          return (
            <Link
              key={f.slug}
              href={`/festivals/${f.slug}`}
              className="card"
              style={{
                borderLeft: `4px solid ${f.accent}`,
                display: 'flex',
                flexDirection: 'column',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'border-color 0.15s',
              }}
            >
              <div style={{ padding: '20px 20px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: f.accent,
                      flexShrink: 0,
                    }}
                  />
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
                    {f.shortName}
                  </h2>
                </div>
                {f.name !== f.shortName && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 12 }}>
                    {f.name}
                  </div>
                )}
                <div style={{ fontSize: '0.8125rem', color: 'var(--muted-lt)', marginBottom: 16 }}>
                  {yearRange}
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{fmt(f.totalSets)}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--muted)' }}>Sets</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{fmt(f.scrapedSets)}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--muted)' }}>Scraped</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{fmt(f.djCount)}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--muted)' }}>DJs</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{fmt(f.stageCount)}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--muted)' }}>Stages</div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
