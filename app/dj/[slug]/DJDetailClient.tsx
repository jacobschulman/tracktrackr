'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FestivalBadge } from '@/components/FestivalBadge';
import { playInBar } from '@/components/PlayerBar';

interface TimelineBar {
  year: number;
  active: boolean;
  stages: string[];
  setCount: number;
  tracks: number;
  festivals: string[];
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
  festival: string;
  festivalName: string;
}

interface TrackPreview {
  artist: string;
  title: string;
  remix: string;
  isID: boolean;
}

interface Props {
  timelineBars: TimelineBar[];
  allSets: SetForFilter[];
  allFestivals: string[];
  festivalColors: Record<string, string>;
  sortedYears: string[];
  totalSets: number;
  setTrackPreviews: Record<string, { tracks: TrackPreview[]; totalTracks: number }>;
  setRecordings: Record<string, { ytUrl?: string; scUrl?: string }>;
  djName: string;
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

export function DJDetailClient({ timelineBars, allSets, allFestivals, festivalColors, sortedYears, totalSets, setTrackPreviews, setRecordings, djName }: Props) {
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterFestival, setFilterFestival] = useState<string>('all');
  const [showAllSets, setShowAllSets] = useState(false);
  const [showAllTimeline, setShowAllTimeline] = useState(false);
  const DEFAULT_SETS_SHOWN = 4;

  // Expand toggles for signature/supported track lists
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest('.signature-expand-btn');
      if (!btn) return;
      const list = btn.closest('.signature-tracks-list');
      if (!list) return;
      list.classList.toggle('expanded');
      const isExpanded = list.classList.contains('expanded');
      btn.textContent = isExpanded ? 'Show less' : (btn as HTMLElement).dataset.originalText || 'Show all';
    };
    document.querySelectorAll('.signature-expand-btn').forEach(btn => {
      (btn as HTMLElement).dataset.originalText = btn.textContent || '';
    });
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Filtered sets
  const filteredSets = allSets.filter(s => {
    if (filterYear !== 'all' && String(s.year) !== filterYear) return false;
    if (filterFestival !== 'all' && s.festival !== filterFestival) return false;
    return true;
  });

  const displayedSets = showAllSets ? filteredSets : filteredSets.slice(0, DEFAULT_SETS_SHOWN);
  const hasMoreSets = filteredSets.length > DEFAULT_SETS_SHOWN;

  return (
    <>
      {/* Vertical Timeline */}
      {(() => {
        const activeBars = timelineBars.filter(b => b.active).reverse();
        const maxSets = Math.max(...activeBars.map(b => b.setCount), 1);
        const DEFAULT_SHOW = 5;
        const displayBars = showAllTimeline ? activeBars : activeBars.slice(0, DEFAULT_SHOW);
        const hasMore = activeBars.length > DEFAULT_SHOW;

        return (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header"><div className="card-title">Timeline</div></div>
            <div className="vt-vertical">
              {displayBars.map(bar => {
                const barPct = Math.max(6, (bar.setCount / maxSets) * 100);
                return (
                  <div key={bar.year} className="vt-v-row">
                    <div className="vt-v-year">{bar.year}</div>
                    <div className="vt-v-bar-wrap">
                      <div className="vt-v-bar" style={{ width: `${barPct}%` }}>
                        {bar.festivals.map(f => (
                          <div
                            key={f}
                            style={{
                              flex: 1,
                              background: festivalColors[f] || '#64748b',
                              minWidth: 4,
                            }}
                          />
                        ))}
                      </div>
                      <span className="vt-v-count">{bar.setCount}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {hasMore && (
              <button
                className="expand-btn"
                onClick={() => setShowAllTimeline(!showAllTimeline)}
                style={{ width: '100%', marginTop: 8 }}
              >
                {showAllTimeline ? 'Show recent' : `Show all ${activeBars.length} years`}
              </button>
            )}
          </div>
        );
      })()}

      {/* All Sets (filterable) */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">Sets</div>
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>
            {filteredSets.length === totalSets ? `${totalSets} total` : `${filteredSets.length} of ${totalSets}`}
          </span>
        </div>
        <div className="sets-filters" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Festival filter */}
          {allFestivals.length > 1 && (
            <select
              className="filter-select"
              value={filterFestival}
              onChange={e => setFilterFestival(e.target.value)}
            >
              <option value="all">All Festivals</option>
              {allFestivals.map(f => (
                <option key={f} value={f}>{f.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}</option>
              ))}
            </select>
          )}
          {/* Year dropdown */}
          <select
            className="filter-select"
            value={filterYear}
            onChange={e => setFilterYear(e.target.value)}
          >
            <option value="all">All Years</option>
            {sortedYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        {filteredSets.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: '0.8125rem', padding: '12px 0' }}>No sets match these filters.</div>
        ) : (
          <div>
            {displayedSets.map(s => {
              const dateStr = formatDate(s.date);
              const preview = setTrackPreviews[s.tlId];
              const recordings = setRecordings[s.tlId];
              return (
                <div key={s.tlId} className="set-card">
                  <div className="set-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--purple-lt)' }}>{s.year}</span>
                      <FestivalBadge festival={s.festival} size="sm" />
                      <span style={{ fontSize: '0.8125rem', color: 'var(--muted-lt)' }}>{dateStr}</span>
                      {s.stage.toLowerCase() !== s.festivalName?.toLowerCase() && s.stage.toLowerCase() !== s.festival.replace(/-/g, ' ') && (
                        <span className="pill" style={{ fontSize: '0.6875rem' }}>{s.stage}</span>
                      )}
                      {s.duration && <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{s.duration}</span>}
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                        {s.tracksIdentified > 0 ? `${s.tracksIdentified}/${s.tracksTotal} tracks` : s.hasSetFile ? 'tracks available' : 'no data'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {recordings?.ytUrl && (
                        <button
                          className="rec-btn rec-btn-yt rec-btn-sm"
                          onClick={() => playInBar('youtube', recordings.ytUrl!, `${djName} - ${s.stage} ${s.year}`, s.tlId)}
                        >
                          &#9654; YT
                        </button>
                      )}
                      {recordings?.scUrl && (
                        <button
                          className="rec-btn rec-btn-sc rec-btn-sm"
                          onClick={() => playInBar('soundcloud', recordings.scUrl!, `${djName} - ${s.stage} ${s.year}`, s.tlId)}
                        >
                          &#9654; SC
                        </button>
                      )}
                      <Link href={`/set/${s.tlId}`} style={{ color: 'var(--purple-lt)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                        View set &rarr;
                      </Link>
                    </div>
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
            {hasMoreSets && !showAllSets && (
              <button
                className="expand-btn"
                onClick={() => setShowAllSets(true)}
                style={{ width: '100%', marginTop: 8 }}
              >
                Show all {filteredSets.length} sets
              </button>
            )}
            {showAllSets && hasMoreSets && (
              <button
                className="expand-btn"
                onClick={() => setShowAllSets(false)}
                style={{ width: '100%', marginTop: 8 }}
              >
                Show fewer
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
