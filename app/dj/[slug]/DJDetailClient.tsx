'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface TimelineBar {
  year: number;
  active: boolean;
  stages: string[];
  setCount: number;
  tracks: number;
}

interface YearInfo {
  sets: { tlId: string; date: string; stage: string; duration: string }[];
  stages: string[];
  tracks: number;
}

interface SetForFilter {
  tlId: string;
  year: number;
  date: string;
  stage: string;
  duration: string;
  tracksIdentified: number;
  tracksTotal: number;
  hasSetFile: boolean;
}

interface TrackPreview {
  artist: string;
  title: string;
  remix: string;
  isID: boolean;
}

interface Props {
  timelineBars: TimelineBar[];
  yearInfoMap: Record<number, YearInfo>;
  allSets: SetForFilter[];
  allStages: string[];
  sortedYears: string[];
  totalSets: number;
  setTrackPreviews: Record<string, { tracks: TrackPreview[]; totalTracks: number }>;
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

export function DJDetailClient({ timelineBars, yearInfoMap, allSets, allStages, sortedYears, totalSets, setTrackPreviews }: Props) {
  const [activeVtYear, setActiveVtYear] = useState<number | null>(null);
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterStage, setFilterStage] = useState<string>('all');

  // Close timeline on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.visual-timeline-card')) {
        setActiveVtYear(null);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const vtInfo = activeVtYear ? yearInfoMap[activeVtYear] : null;

  // Filtered sets
  const filteredSets = allSets.filter(s => {
    if (filterYear !== 'all' && String(s.year) !== filterYear) return false;
    if (filterStage !== 'all' && s.stage !== filterStage) return false;
    return true;
  });

  return (
    <>
      {/* Visual Timeline */}
      <div className="card visual-timeline-card" style={{ marginBottom: 24 }}>
        <div className="card-header"><div className="card-title">Timeline</div></div>
        <div className="visual-timeline">
          {timelineBars.map(bar => {
            const isActive = bar.active;
            const isSelected = activeVtYear === bar.year;
            return (
              <div
                key={bar.year}
                className={`vt-year${!isActive ? ' vt-gap' : ''}${isSelected ? ' active' : ''}`}
                data-year={bar.year}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isActive) return;
                  setActiveVtYear(activeVtYear === bar.year ? null : bar.year);
                }}
              >
                <div
                  className={`vt-bar${!isActive ? ' vt-bar-empty' : ''}`}
                  style={isActive ? { background: bar.stages.length === 1 ? undefined : undefined } : undefined}
                  title={isActive ? `${bar.year}: ${bar.setCount} set${bar.setCount > 1 ? 's' : ''} \u2014 ${bar.stages.join(', ')}` : undefined}
                />
                <span className="vt-label">{String(bar.year).slice(-2)}</span>
              </div>
            );
          })}
        </div>
        <div className={`vt-expanded${vtInfo ? ' open' : ''}`}>
          {vtInfo && (
            <div style={{ padding: '12px 0', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-bright)', width: '100%', marginBottom: 4 }}>
                {activeVtYear}: {vtInfo.sets.length} set{vtInfo.sets.length > 1 ? 's' : ''}, {vtInfo.tracks} tracks ID&apos;d
              </div>
              {vtInfo.sets.map(s => (
                <div
                  key={s.tlId}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    background: 'var(--surface)',
                    borderRadius: 8,
                    fontSize: '0.8125rem',
                  }}
                >
                  <span style={{ color: 'var(--muted-lt)' }}>{formatDate(s.date)}</span>
                  <span className="pill" style={{ fontSize: '0.6875rem' }}>{s.stage}</span>
                  {s.duration && <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>{s.duration}</span>}
                  <Link href={`/set/${s.tlId}`} style={{ color: 'var(--purple-lt)', fontSize: '0.75rem' }}>
                    View set &rarr;
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* All Sets (filterable) */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">Sets</div>
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>{totalSets} total</span>
        </div>
        <div className="sets-filters">
          <div className="sets-filter-row">
            <button
              className={`filter-chip${filterYear === 'all' ? ' active' : ''}`}
              onClick={() => setFilterYear('all')}
            >
              All Years
            </button>
            {sortedYears.map(y => (
              <button
                key={y}
                className={`filter-chip${filterYear === y ? ' active' : ''}`}
                onClick={() => setFilterYear(y)}
              >
                {y}
              </button>
            ))}
          </div>
          {allStages.length > 1 && (
            <div className="sets-filter-row">
              <button
                className={`filter-chip${filterStage === 'all' ? ' active' : ''}`}
                onClick={() => setFilterStage('all')}
              >
                All Stages
              </button>
              {allStages.map(s => (
                <button
                  key={s}
                  className={`filter-chip${filterStage === s ? ' active' : ''}`}
                  onClick={() => setFilterStage(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
        {filteredSets.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: '0.8125rem', padding: '12px 0' }}>No sets match these filters.</div>
        ) : (
          <div>
            {filteredSets.map(s => {
              const dateStr = formatDate(s.date);
              const preview = setTrackPreviews[s.tlId];
              return (
                <div key={s.tlId} className="set-card">
                  <div className="set-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--purple-lt)' }}>{s.year}</span>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--muted-lt)' }}>{dateStr}</span>
                      <span className="pill" style={{ fontSize: '0.6875rem' }}>{s.stage}</span>
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
                            <span className="track-link" style={{ fontSize: '0.8125rem' }}>
                              <span style={{ fontWeight: 500 }}>{t.artist}</span>
                              <span style={{ color: 'var(--muted-lt)' }}> &mdash; {t.title}</span>
                              {t.remix && <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}> ({t.remix})</span>}
                            </span>
                          </div>
                        );
                      })}
                      {preview.totalTracks > 5 && (
                        <Link href={`/set/${s.tlId}`} style={{ display: 'inline-block', marginTop: 6, fontSize: '0.75rem', color: 'var(--purple-lt)' }}>
                          + {preview.totalTracks - 5} more tracks &mdash; View full set &rarr;
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
