import { loadIndex, loadAllSets, loadSet, getDJHistory, getDJStats, getDJStreak, getDJRepeatRate, getTopTracks, trackKey, parseTrackKey } from '@/lib/data';
import { CONFIG, getStageColor } from '@/lib/config';
import { fmt } from '@/lib/data';
import { trackSlug } from '@/lib/slugs';
import { StageBadge } from '@/components/StageBadge';
import Link from 'next/link';
import type { SetMeta } from '@/lib/types';
import { DJDetailClient } from './DJDetailClient';

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

  const withTracks = history.filter(s => s.tracksTotal > 0 && s.hasSetFile);
  const avgIdRate = withTracks.length > 0
    ? withTracks.reduce((sum, s) => sum + (s.tracksIdentified / s.tracksTotal), 0) / withTracks.length
    : 0;

  // -- Repeat rate + unique tracks --
  const repeatData = getDJRepeatRate(slug);

  // -- Stage breakdown --
  const stageCounts: Record<string, number> = {};
  for (const s of history) {
    stageCounts[s.stage] = (stageCounts[s.stage] || 0) + 1;
  }
  const sortedStages = Object.entries(stageCounts).sort((a, b) => b[1] - a[1]);

  // -- Visual timeline data --
  const yearInfoMap: Record<number, { sets: SetMeta[]; stages: string[]; tracks: number }> = {};
  for (const s of history) {
    if (!yearInfoMap[s.year]) yearInfoMap[s.year] = { sets: [], stages: [], tracks: 0 };
    yearInfoMap[s.year].sets.push(s);
    if (!yearInfoMap[s.year].stages.includes(s.stage)) yearInfoMap[s.year].stages.push(s.stage);
    yearInfoMap[s.year].tracks += (s.tracksTotal || s.tracksIdentified || 0);
  }

  // Build visual timeline bars from first to last year (with gaps)
  const timelineBars: { year: number; active: boolean; stages: string[]; setCount: number; tracks: number }[] = [];
  for (let y = firstYear; y <= lastYear; y++) {
    const info = yearInfoMap[y];
    if (info) {
      timelineBars.push({ year: y, active: true, stages: info.stages, setCount: info.sets.length, tracks: info.tracks });
    } else {
      timelineBars.push({ year: y, active: false, stages: [], setCount: 0, tracks: 0 });
    }
  }

  // -- B2B partners --
  const b2bMap = new Map<string, { slug: string; name: string; count: number; years: number[] }>();
  for (const s of history) {
    if (s.djs.length > 1) {
      for (const d of s.djs) {
        if (d.slug === slug) continue;
        if (!b2bMap.has(d.slug)) {
          b2bMap.set(d.slug, { slug: d.slug, name: d.name, count: 0, years: [] });
        }
        const p = b2bMap.get(d.slug)!;
        p.count++;
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
  const mostRecentYear = sortedYearsDesc[0];
  const allSetsSorted = [...history].sort((a, b) => b.date.localeCompare(a.date));
  const allStages = [...new Set(history.map(s => s.stage))].sort();

  // -- Most Recent Set track previews --
  const recentSets = setsByYear[mostRecentYear] || [];
  const recentSetPreviews: Record<string, { tracks: { artist: string; title: string; remix: string; isID: boolean }[]; totalTracks: number }> = {};
  for (const s of recentSets) {
    if (!s.hasSetFile) continue;
    const setData = loadSet(s.tlId);
    if (!setData || !setData.tracks) continue;
    const tracks = setData.tracks.filter(t => t.type === 'normal' || t.type === 'blend');
    recentSetPreviews[s.tlId] = {
      totalTracks: tracks.length,
      tracks: tracks.slice(0, 8).map(t => ({
        artist: t.artist,
        title: t.title,
        remix: t.remix || '',
        isID: isIDTrack(t.artist, t.title),
      })),
    };
  }

  // -- All set track previews (5 per set) --
  const setTrackPreviews: Record<string, { tracks: { artist: string; title: string; remix: string; isID: boolean }[]; totalTracks: number }> = {};
  for (const s of history) {
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

  // -- Signature Tracks (anthems): played across 2+ years --
  const djTopTracks = getTopTracks(100, { djSlug: slug });
  const anthems: { artist: string; title: string; key: string; count: number; years: number[] }[] = [];
  for (const t of djTopTracks) {
    if (t.years.length >= 2) {
      anthems.push({ artist: t.artist, title: t.title, key: t.key, count: t.playCount, years: t.years });
    }
  }

  // Serialize yearInfoMap for client component
  const yearInfoSerialized: Record<number, { sets: { tlId: string; date: string; stage: string; duration: string }[]; stages: string[]; tracks: number }> = {};
  for (const [y, info] of Object.entries(yearInfoMap)) {
    yearInfoSerialized[Number(y)] = {
      sets: info.sets.map(s => ({ tlId: s.tlId, date: s.date, stage: s.stage, duration: s.duration })),
      stages: info.stages,
      tracks: info.tracks,
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
  }));

  return (
    <>
      {/* 1. Hero: Name + Topline */}
      <div className="dj-hero">
        <h1>{djName}</h1>
        <div className="dj-hero-subtitle">
          {yearSpan > 0 ? `${yearSpan} year span at ${CONFIG.festivalShort}` : CONFIG.festivalShort}
          <span className="dj-hero-years">{firstYear} &rarr; {lastYear}</span>
        </div>
        <div className="dj-hero-meta">
          <span className="dj-hero-pill"><strong>{fmt(totalSets)}</strong> set{totalSets !== 1 ? 's' : ''}</span>
          <span className="dj-hero-pill"><strong>{uniqueYears}</strong> year{uniqueYears !== 1 ? 's' : ''}</span>
          {streak > 1 && (
            <span className="dj-hero-pill accent"><strong>{streak}</strong>-year streak</span>
          )}
        </div>
      </div>

      {/* 2. Visual Timeline */}
      <DJDetailClient
        timelineBars={timelineBars}
        yearInfoMap={yearInfoSerialized}
        allSets={allSetsForClient}
        allStages={allStages}
        sortedYears={sortedYearsDesc.map(String)}
        totalSets={totalSets}
        setTrackPreviews={setTrackPreviews}
      />

      {/* 3. Most Recent Set */}
      <div className="card dj-recent-set-card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">Most Recent Set</div>
          <span className="pill pill-purple">{mostRecentYear}</span>
        </div>
        {recentSets.map(s => {
          const dateStr = formatDate(s.date);
          const preview = recentSetPreviews[s.tlId];
          return (
            <div key={s.tlId} className="set-card set-card-prominent">
              <div className="set-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--muted-lt)' }}>{dateStr}</span>
                  <StageBadge stage={s.stage} />
                  {s.duration && <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{s.duration}</span>}
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                    {s.tracksIdentified > 0 ? `${s.tracksIdentified}/${s.tracksTotal} tracks` : s.hasSetFile ? 'tracks available' : 'no data'}
                  </span>
                </div>
                <Link href={`/set/${s.tlId}`} style={{ color: 'var(--purple-lt)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                  View full set &rarr;
                </Link>
              </div>
              {preview && preview.tracks.length > 0 && (
                <div className="set-card-tracks">
                  {preview.tracks.map((t, i) => {
                    if (t.isID) {
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0' }}>
                          <span style={{ color: 'var(--muted)', fontSize: '0.6875rem', width: 18, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>ID &mdash; ID</span>
                        </div>
                      );
                    }
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0' }}>
                        <span style={{ color: 'var(--muted)', fontSize: '0.6875rem', width: 18, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                        <Link href={`/track/${trackSlug(t.artist, t.title)}`} className="track-link" style={{ fontSize: '0.8125rem' }}>
                          <span style={{ fontWeight: 500 }}>{t.artist}</span>
                          <span style={{ color: 'var(--muted-lt)' }}> &mdash; {t.title}</span>
                          {t.remix && <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}> ({t.remix})</span>}
                        </Link>
                      </div>
                    );
                  })}
                  {preview.totalTracks > 8 && (
                    <Link href={`/set/${s.tlId}`} style={{ display: 'inline-block', marginTop: 6, fontSize: '0.75rem', color: 'var(--purple-lt)' }}>
                      + {preview.totalTracks - 8} more tracks &mdash; View full set &rarr;
                    </Link>
                  )}
                </div>
              )}
              {!preview && s.hasSetFile && (
                <div style={{ color: 'var(--muted)', fontSize: '0.75rem', fontStyle: 'italic', padding: '8px 0' }}>
                  No track data available.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 4. Stats Row (compact) */}
      <div className="stats-row" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-number">{fmt(repeatData.totalUniqueTracks)}</div>
          <div className="stat-label">Unique Tracks</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{(avgIdRate * 100).toFixed(0)}%</div>
          <div className="stat-label">ID Rate</div>
        </div>
        <div className="stat-card" title="% of tracks this DJ has played more than once across their Ultra sets">
          <div className="stat-number">{(repeatData.repeatRate * 100).toFixed(0)}%</div>
          <div className="stat-label">Repeat Rate</div>
        </div>
      </div>

      {/* 5. Stages + B2B side by side */}
      <div className="detail-grid" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header"><div className="card-title">Stages</div></div>
          <div style={{ display: 'flex', gap: 3, borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
            {sortedStages.map(([stage, count]) => {
              const color = getStageColor(stage);
              const pct = ((count / totalSets) * 100).toFixed(1);
              return (
                <div
                  key={stage}
                  style={{
                    flex: count,
                    background: color,
                    minWidth: 4,
                    height: 28,
                    borderRadius: 4,
                    position: 'relative',
                    cursor: 'default',
                  }}
                  title={`${stage}: ${count} sets (${pct}%)`}
                />
              );
            })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
            {sortedStages.map(([stage, count]) => {
              const color = getStageColor(stage);
              const pct = ((count / totalSets) * 100).toFixed(1);
              return (
                <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--muted-lt)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  {stage} <span style={{ color: 'var(--muted)' }}>{count} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>

        {b2bPartners.length > 0 && (
          <div className="card">
            <div className="card-header"><div className="card-title">B2B Partners</div></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {b2bPartners.map(p => (
                <Link
                  key={p.slug}
                  href={`/dj/${p.slug}`}
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
                  <span className="count-badge">{p.count}x</span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--muted)' }}>{p.years.join(', ')}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 6. Signature Tracks */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">Signature Tracks</div>
          <div className="text-muted" style={{ fontSize: '0.75rem' }}>Played across 2+ years</div>
        </div>
        {anthems.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: '0.875rem', padding: '8px 0' }}>
            No tracks found that were played across multiple years.
          </div>
        ) : (
          anthems.map((a, i) => (
            <div
              key={a.key}
              className={`track-row${i < anthems.length - 1 ? '' : ' last'}`}
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
          ))
        )}
      </div>
    </>
  );
}
