import { loadIndex, loadSet, getDJHistory, getSetRecordings, loadDJIndex } from '@/lib/data';
import { FESTIVALS } from '@/lib/festivals';
import { fmt } from '@/lib/data';
import { trackSlug } from '@/lib/slugs';
import { FestivalBadge } from '@/components/FestivalBadge';
import Link from 'next/link';
import { DJDetailClient } from './DJDetailClient';
import { AnimatedNumber } from '@/components/AnimatedNumber';

// Only pre-build top DJs; rest rendered on-demand by Vercel
export function generateStaticParams() {
  return [];
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

function isIDTrack(artist: string, title: string): boolean {
  const a = (artist || '').toLowerCase().trim();
  const t = (title || '').toLowerCase().trim();
  return a === 'id' || t === 'id' || a === '' || t === '' ||
    t.startsWith('id (') || t === 'id?' || a === 'id?';
}

export default async function DJPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const index = loadIndex();

  // Try pre-built DJ index first (fast path - no loadAllSets needed)
  const djIdx = loadDJIndex(slug);
  const history = getDJHistory(slug);

  if (history.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">?</div>
        <div className="empty-state-text">DJ not found.</div>
      </div>
    );
  }

  // -- Basic info (from pre-built index or computed) --
  const djEntry = history[0].djs.find(d => d.slug === slug);
  const djName = djIdx?.name || (djEntry ? djEntry.name : slug);
  const years = djIdx?.years || [...new Set(history.map(s => s.year))].sort((a: number, b: number) => a - b);
  const firstYear = years[0];
  const lastYear = years[years.length - 1];
  const totalSets = djIdx?.totalSets || history.length;
  const uniqueYears = djIdx?.uniqueYears || years.length;
  const yearSpan = lastYear - firstYear;
  const streak = djIdx?.streak || 0;
  const festivals: string[] = djIdx?.festivals || [...new Set(history.map(s => s.festival))];
  const avgIdRate = djIdx ? djIdx.idRate / 100 : 0;
  const repeatData = djIdx
    ? { totalUniqueTracks: djIdx.totalUniqueTracks, repeatRate: djIdx.repeatRate / 100 }
    : { totalUniqueTracks: 0, repeatRate: 0 };

  // -- Timeline from pre-built index or computed --
  const timelineBars: { year: number; active: boolean; stages: string[]; setCount: number; tracks: number; festivals: string[] }[] = [];
  if (djIdx?.timeline) {
    for (let y = firstYear; y <= lastYear; y++) {
      const info = djIdx.timeline[y];
      if (info) {
        timelineBars.push({ year: y, active: true, stages: [], setCount: info.sets, tracks: 0, festivals: info.festivals });
      } else {
        timelineBars.push({ year: y, active: false, stages: [], setCount: 0, tracks: 0, festivals: [] });
      }
    }
  } else {
    for (let y = firstYear; y <= lastYear; y++) {
      const ySets = history.filter(s => s.year === y);
      if (ySets.length > 0) {
        timelineBars.push({ year: y, active: true, stages: [], setCount: ySets.length, tracks: 0, festivals: [...new Set(ySets.map(s => s.festival))] });
      } else {
        timelineBars.push({ year: y, active: false, stages: [], setCount: 0, tracks: 0, festivals: [] });
      }
    }
  }

  // -- B2B partners --
  const b2bMap = new Map<string, { slug: string; name: string; count: number; years: number[]; tlIds: string[] }>();
  for (const s of history) {
    if (s.djs.length > 1) {
      for (const d of s.djs) {
        if (d.slug === slug) continue;
        if (!b2bMap.has(d.slug)) {
          b2bMap.set(d.slug, { slug: d.slug, name: d.name, count: 0, years: [], tlIds: [] });
        }
        const p = b2bMap.get(d.slug)!;
        p.count++;
        p.tlIds.push(s.tlId);
        if (!p.years.includes(s.year)) p.years.push(s.year);
      }
    }
  }
  const b2bPartners = [...b2bMap.values()].sort((a, b) => b.count - a.count);

  // -- Sets --
  const sortedYearsDesc = [...new Set(history.map(s => s.year))].sort((a, b) => b - a);
  const allSetsSorted = [...history].sort((a, b) => b.date.localeCompare(a.date));
  const allFestivals = [...new Set(history.map(s => s.festival))].sort();

  // -- Set track previews (only first 8) + recording info (from pre-built index) --
  const setTrackPreviews: Record<string, { tracks: { artist: string; title: string; remix: string; isID: boolean }[]; totalTracks: number }> = {};
  const setRecordingsMap: Record<string, { ytUrl?: string; scUrl?: string }> = {};
  for (const s of allSetsSorted.slice(0, 8)) {
    if (!s.hasSetFile) continue;
    const setData = loadSet(s.tlId);
    if (!setData || !setData.tracks) continue;
    const tracks = setData.tracks.filter(t => t.type === 'normal' || t.type === 'blend');
    setTrackPreviews[s.tlId] = {
      totalTracks: tracks.length,
      tracks: tracks.slice(0, 5).map(t => ({
        artist: t.artist,
        title: t.title,
        remix: t.remix || '',
        isID: isIDTrack(t.artist, t.title),
      })),
    };
  }
  for (const s of allSetsSorted) {
    const rec = getSetRecordings(s.tlId);
    if (rec) setRecordingsMap[s.tlId] = rec;
  }

  // -- Signature + Supported tracks from pre-built index --
  const signatureTracks = djIdx?.signatureTracks || [];
  const supportedTracks = djIdx?.supportedTracks || [];

  // Serialize sets for client
  const allSetsForClient = allSetsSorted.map(s => ({
    tlId: s.tlId,
    year: s.year,
    date: s.date,
    stage: s.stage,
    duration: s.duration,
    tracksIdentified: s.tracksIdentified,
    tracksTotal: s.tracksTotal,
    hasSetFile: s.hasSetFile,
    festival: s.festival,
    festivalName: s.festivalName,
  }));

  return (
    <>
      {/* 1. Hero */}
      <div className="dj-hero">
        <h1>{djName}</h1>
        <div className="dj-hero-subtitle">
          <span className="dj-hero-years">{firstYear} &rarr; {lastYear}</span>
        </div>
        {festivals.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
            {festivals.map(f => (
              <FestivalBadge key={f} festival={f} size="sm" />
            ))}
          </div>
        )}
        <div className="dj-hero-stats">
          <div className="dj-hero-stat">
            <div className="dj-hero-stat-val"><AnimatedNumber value={fmt(totalSets)} /></div>
            <div className="dj-hero-stat-label">sets</div>
          </div>
          <div className="dj-hero-stat">
            <div className="dj-hero-stat-val"><AnimatedNumber value={String(uniqueYears)} /></div>
            <div className="dj-hero-stat-label">years</div>
          </div>
          {streak > 1 && (
            <div className="dj-hero-stat accent">
              <div className="dj-hero-stat-val"><AnimatedNumber value={String(streak)} /></div>
              <div className="dj-hero-stat-label">yr streak</div>
            </div>
          )}
          <div className="dj-hero-stat">
            <div className="dj-hero-stat-val"><AnimatedNumber value={fmt(repeatData.totalUniqueTracks)} /></div>
            <div className="dj-hero-stat-label">unique tracks</div>
          </div>
          <div className="dj-hero-stat">
            <div className="dj-hero-stat-val"><AnimatedNumber value={`${(avgIdRate * 100).toFixed(0)}%`} /></div>
            <div className="dj-hero-stat-label">ID rate</div>
          </div>
          <div className="dj-hero-stat">
            <div className="dj-hero-stat-val"><AnimatedNumber value={`${(repeatData.repeatRate * 100).toFixed(0)}%`} /></div>
            <div className="dj-hero-stat-label">repeat rate</div>
          </div>
        </div>
      </div>

      {/* 2. Visual Timeline + Sets (client component) */}
      <DJDetailClient
        timelineBars={timelineBars}
        allSets={allSetsForClient}
        allFestivals={allFestivals}
        festivalColors={Object.fromEntries(allFestivals.map(f => [f, FESTIVALS[f]?.accent || '#64748b']))}
        sortedYears={sortedYearsDesc.map(String)}
        totalSets={totalSets}
        setTrackPreviews={setTrackPreviews}
        setRecordings={setRecordingsMap}
        djName={djName}
      />

      {/* 3. B2B Partners */}
      {b2bPartners.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header"><div className="card-title">B2B Partners</div></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {b2bPartners.map(p => (
              <Link
                key={p.slug}
                href={p.count === 1 ? `/set/${p.tlIds[0]}` : `/dj/${p.slug}`}
                className="dj-link"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  background: 'var(--surface2)',
                  borderRadius: 8,
                  fontSize: '0.8125rem',
                  textDecoration: 'none',
                }}
              >
                {p.name}
                {p.count > 1 && <span className="count-badge">{p.count}x</span>}
                <span style={{ fontSize: '0.6875rem', color: 'var(--muted)' }}>{p.years.join(', ')}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 4. Signature Tracks */}
      <DJSignatureTracks tracks={signatureTracks} />

      {/* 5. Most Supported Tracks */}
      {supportedTracks.length > 0 && (
        <DJSupportedTracks tracks={supportedTracks} />
      )}
    </>
  );
}

// Client wrapper for expandable signature tracks
function DJSignatureTracks({ tracks }: { tracks: { artist: string; title: string; key: string; count: number; years: number[] }[] }) {
  // Server component renders top 7; client component handles expansion
  // We'll pass all data to a client wrapper
  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <div>
          <div className="card-title">Signature Tracks</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>The tracks they play most often</div>
        </div>
      </div>
      {tracks.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: '0.875rem', padding: '8px 0' }}>
          No repeated tracks found.
        </div>
      ) : (
        <SignatureTracksList tracks={tracks} />
      )}
    </div>
  );
}

function SignatureTracksList({ tracks }: { tracks: { artist: string; title: string; key: string; count: number; years: number[] }[] }) {
  // This is a server component - we render all but hide extras with CSS/client toggle
  // Actually we need client interactivity for expand, so we pass to DJDetailClient
  // For now render all with a data attribute the client can use
  return (
    <div className="signature-tracks-list" data-default-show="7">
      {tracks.map((a, i) => (
        <div
          key={a.key}
          className={`track-row${i < tracks.length - 1 ? '' : ' last'}${i >= 7 ? ' signature-hidden' : ''}`}
          data-idx={i}
        >
          <span className="track-row-num">{i + 1}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Link
              href={`/track/${trackSlug(a.artist, a.title)}`}
              className="track-link"
              style={{ fontSize: '0.875rem' }}
            >
              <span style={{ fontWeight: 600 }}>{a.artist}</span>
              <span style={{ color: 'var(--muted-lt)' }}> &mdash; {a.title}</span>
            </Link>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
              {a.years.map(y => (
                <span key={y} className="year-tag">{y}</span>
              ))}
            </div>
          </div>
          <span className="count-badge">{a.count}x</span>
        </div>
      ))}
      {tracks.length > 7 && (
        <button
          className="expand-btn signature-expand-btn"
          data-expand-target="signature-tracks-list"
        >
          Show all {tracks.length} tracks
        </button>
      )}
    </div>
  );
}

function DJSupportedTracks({ tracks }: { tracks: { artist: string; title: string; key: string; playedByCount: number; playedBy: string[]; totalPlays: number }[] }) {
  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <div>
          <div className="card-title">Their Most Supported Tracks</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>Their tracks that other DJs play the most</div>
        </div>
      </div>
      <div className="signature-tracks-list" data-default-show="7">
        {tracks.map((t, i) => (
          <div
            key={t.key}
            className={`track-row${i < tracks.length - 1 ? '' : ' last'}${i >= 7 ? ' signature-hidden' : ''}`}
            data-idx={i}
          >
            <span className="track-row-num">{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link
                href={`/track/${trackSlug(t.artist, t.title)}`}
                className="track-link"
                style={{ fontSize: '0.875rem' }}
              >
                <span style={{ fontWeight: 600 }}>{t.artist}</span>
                <span style={{ color: 'var(--muted-lt)' }}> &mdash; {t.title}</span>
              </Link>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 3 }}>
                Played by {t.playedByCount} other DJ{t.playedByCount !== 1 ? 's' : ''}
              </div>
            </div>
            <span className="count-badge" title={`${t.playedByCount} other DJs`}>{t.playedByCount} DJs</span>
          </div>
        ))}
        {tracks.length > 7 && (
          <button
            className="expand-btn signature-expand-btn"
            data-expand-target="signature-tracks-list"
          >
            Show all {tracks.length} tracks
          </button>
        )}
      </div>
    </div>
  );
}
