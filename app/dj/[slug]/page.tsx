import { loadIndex, loadAllSets, loadSet, getDJHistory, getDJStats, getDJStreak, getDJRepeatRate, getTopTracks, getMostSupportedTracks, trackKey, parseTrackKey } from '@/lib/data';
import { getStageColor, FESTIVALS } from '@/lib/festivals';
import { fmt } from '@/lib/data';
import { trackSlug } from '@/lib/slugs';
import { StageBadge } from '@/components/StageBadge';
import { FestivalBadge } from '@/components/FestivalBadge';
import Link from 'next/link';
import type { SetMeta } from '@/lib/types';
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
  loadAllSets();

  const history = getDJHistory(slug);
  if (history.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">?</div>
        <div className="empty-state-text">DJ not found.</div>
      </div>
    );
  }

  // -- Basic info --
  const djEntry = history[0].djs.find(d => d.slug === slug);
  const djName = djEntry ? djEntry.name : slug;
  const years = [...new Set(history.map(s => s.year))].sort((a, b) => a - b);
  const firstYear = years[0];
  const lastYear = years[years.length - 1];
  const totalSets = history.length;
  const uniqueYears = years.length;
  const yearSpan = lastYear - firstYear;
  const streak = getDJStreak(slug);
  const festivals = [...new Set(history.map(s => s.festival))];

  const withTracks = history.filter(s => s.tracksTotal > 0 && s.hasSetFile);
  const avgIdRate = withTracks.length > 0
    ? withTracks.reduce((sum, s) => sum + (s.tracksIdentified / s.tracksTotal), 0) / withTracks.length
    : 0;

  // -- Repeat rate + unique tracks --
  const repeatData = getDJRepeatRate(slug);

  // -- Visual timeline data --
  const yearInfoMap: Record<number, { sets: SetMeta[]; stages: string[]; tracks: number; festivals: string[] }> = {};
  for (const s of history) {
    if (!yearInfoMap[s.year]) yearInfoMap[s.year] = { sets: [], stages: [], tracks: 0, festivals: [] };
    yearInfoMap[s.year].sets.push(s);
    if (!yearInfoMap[s.year].stages.includes(s.stage)) yearInfoMap[s.year].stages.push(s.stage);
    if (!yearInfoMap[s.year].festivals.includes(s.festival)) yearInfoMap[s.year].festivals.push(s.festival);
    yearInfoMap[s.year].tracks += (s.tracksTotal || s.tracksIdentified || 0);
  }

  // Build visual timeline bars from first to last year (with gaps)
  const timelineBars: { year: number; active: boolean; stages: string[]; setCount: number; tracks: number; festivals: string[] }[] = [];
  for (let y = firstYear; y <= lastYear; y++) {
    const info = yearInfoMap[y];
    if (info) {
      timelineBars.push({ year: y, active: true, stages: info.stages, setCount: info.sets.length, tracks: info.tracks, festivals: info.festivals });
    } else {
      timelineBars.push({ year: y, active: false, stages: [], setCount: 0, tracks: 0, festivals: [] });
    }
  }

  // -- B2B partners (with set links) --
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

  // -- Sets by Year --
  const setsByYear: Record<number, SetMeta[]> = {};
  for (const s of history) {
    if (!setsByYear[s.year]) setsByYear[s.year] = [];
    setsByYear[s.year].push(s);
  }
  const sortedYearsDesc = Object.keys(setsByYear).map(Number).sort((a, b) => b - a);
  const allSetsSorted = [...history].sort((a, b) => b.date.localeCompare(a.date));
  const allFestivals = [...new Set(history.map(s => s.festival))].sort();

  // -- Set track previews + recording info (only first 20 to keep load fast) --
  const setTrackPreviews: Record<string, { tracks: { artist: string; title: string; remix: string; isID: boolean }[]; totalTracks: number }> = {};
  const setRecordings: Record<string, { ytUrl?: string; scUrl?: string }> = {};
  const setsToEnrich = allSetsSorted.slice(0, 20);
  for (const s of setsToEnrich) {
    if (!s.hasSetFile) continue;
    const setData = loadSet(s.tlId);
    if (!setData) continue;
    if (setData.tracks) {
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
    const recordings = setData.recordings || [];
    const yt = recordings.find(r => r.platform === 'youtube');
    const sc = recordings.find(r => r.platform === 'soundcloud');
    if (yt || sc) {
      setRecordings[s.tlId] = {
        ytUrl: yt?.url,
        scUrl: sc?.url,
      };
    }
  }

  // -- Signature Tracks: most played by this DJ --
  const djTopTracks = getTopTracks(100, { djSlug: slug });
  const signatureTracks = djTopTracks
    .filter(t => t.playCount >= 2)
    .map(t => ({ artist: t.artist, title: t.title, key: t.key, count: t.playCount, years: t.years }));

  // -- Most Supported Tracks: tracks by this DJ played by other DJs --
  const supportedTracks = getMostSupportedTracks(slug, 20);

  // Serialize yearInfoMap for client component
  const yearInfoSerialized: Record<number, { sets: { tlId: string; date: string; stage: string; duration: string; festival: string }[]; stages: string[]; tracks: number; festivals: string[] }> = {};
  for (const [y, info] of Object.entries(yearInfoMap)) {
    yearInfoSerialized[Number(y)] = {
      sets: info.sets.map(s => ({ tlId: s.tlId, date: s.date, stage: s.stage, duration: s.duration, festival: s.festival })),
      stages: info.stages,
      tracks: info.tracks,
      festivals: info.festivals,
    };
  }

  // Serialize sets for client filter component
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
        yearInfoMap={yearInfoSerialized}
        allSets={allSetsForClient}
        allFestivals={allFestivals}
        festivalColors={Object.fromEntries(allFestivals.map(f => [f, FESTIVALS[f]?.accent || '#64748b']))}
        sortedYears={sortedYearsDesc.map(String)}
        totalSets={totalSets}
        setTrackPreviews={setTrackPreviews}
        setRecordings={setRecordings}
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
                Played by {t.playedBy.slice(0, 5).join(', ')}{t.playedByCount > 5 ? ` + ${t.playedByCount - 5} more` : ''}
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
