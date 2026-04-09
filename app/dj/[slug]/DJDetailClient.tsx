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

interface YearInfo {
  sets: { tlId: string; date: string; stage: string; duration: string; festival: string }[];
  stages: string[];
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
  yearInfoMap: Record<number, YearInfo>;
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

export function DJDetailClient({ timelineBars, yearInfoMap, allSets, allFestivals, festivalColors, sortedYears, totalSets, setTrackPreviews, setRecordings, djName }: Props) {
  const [activeVtYear, setActiveVtYear] = useState<number | null>(null);
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterFestival, setFilterFestival] = useState<string>('all');
  const [showAllSets, setShowAllSets] = useState(false);
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
    // Store original text on mount
    document.querySelectorAll('.signature-expand-btn').forEach(btn => {
      (btn as HTMLElement).dataset.originalText = btn.textContent || '';
    });
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

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
    if (filterFestival !== 'all' && s.festival !== filterFestival) return false;
    return true;
  });

  const displayedSets = showAllSets ? filteredSets : filteredSets.slice(0, DEFAULT_SETS_SHOWN);
  const hasMoreSets = filteredSets.length > DEFAULT_SETS_SHOWN;

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
                {isActive ? (
                  <div
                    className="vt-bar vt-bar-segmented"
                    title={`${bar.year}: ${bar.setCount} set${bar.setCount > 1 ? 's' : ''} \u2014 ${bar.festivals.join(', ')}`}
                  >
                    {bar.festivals.map((f, i) => (
                      <div
                        key={f}
                        style={{
                          flex: 1,
                          background: festivalColors[f] || '#64748b',
                          borderRadius: i === 0 && bar.festivals.length === 1 ? '4px 4px 1px 1px'
                            : i === 0 ? '4px 0 0 1px'
                            : i === bar.festivals.length - 1 ? '0 4px 1px 0'
                            : '0',
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="vt-bar vt-bar-empty" />
                )}
                <span className="vt-label">{String(bar.year).slice(-2)}</span>
              </div>
            );
          })}
        </div>
        <div className={`vt-expanded${vtInfo ? ' open' : ''}`}>
          {vtInfo && (
            <div style={{ padding: '12px 0' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-bright)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span>{activeVtYear}: {vtInfo.sets.length} set{vtInfo.sets.length > 1 ? 's' : ''}</span>
                {vtInfo.festivals.map(f => (
                  <FestivalBadge key={f} festival={f} size="sm" />
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {vtInfo.sets.map(s => (
                  <Link
                    key={s.tlId}
                    href={`/set/${s.tlId}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      background: 'var(--surface)',
                      borderRadius: 8,
                      fontSize: '0.8125rem',
                      textDecoration: 'none',
                      color: 'inherit',
                      flexWrap: 'wrap',
                    }}
                  >
                    <FestivalBadge festival={s.festival} size="sm" />
                    <span style={{ color: 'var(--muted-lt)', fontSize: '0.75rem' }}>{formatDate(s.date)}</span>
                    <span style={{ color: 'var(--text)', fontWeight: 500, fontSize: '0.8125rem' }}>{s.stage}</span>
                    {s.duration && <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>{s.duration}</span>}
                    <span style={{ color: 'var(--purple-lt)', fontSize: '0.75rem', marginLeft: 'auto' }}>&rarr;</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

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
            <>
              <button
                className={`filter-chip${filterFestival === 'all' ? ' active' : ''}`}
                onClick={() => setFilterFestival('all')}
              >
                All Festivals
              </button>
              {allFestivals.map(f => (
                <button
                  key={f}
                  className={`filter-chip${filterFestival === f ? ' active' : ''}`}
                  onClick={() => setFilterFestival(f)}
                >
                  <FestivalBadge festival={f} size="sm" />
                </button>
              ))}
              <span style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
            </>
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
                      <span className="pill" style={{ fontSize: '0.6875rem' }}>{s.stage}</span>
                      {s.duration && <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{s.duration}</span>}
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                        {s.tracksIdentified > 0 ? `${s.tracksIdentified}/${s.tracksTotal} tracks` : s.hasSetFile ? 'tracks available' : 'no data'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {recordings?.ytUrl && (
                        <button
                          className="rec-btn-inline rec-btn-yt-inline"
                          onClick={() => playInBar('youtube', recordings.ytUrl!, `${djName} - ${s.stage} ${s.year}`, s.tlId)}
                          title="Play on YouTube"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                        </button>
                      )}
                      {recordings?.scUrl && (
                        <button
                          className="rec-btn-inline rec-btn-sc-inline"
                          onClick={() => playInBar('soundcloud', recordings.scUrl!, `${djName} - ${s.stage} ${s.year}`, s.tlId)}
                          title="Play on SoundCloud"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.05-.1-.1-.1m-.899.828c-.06 0-.091.037-.104.094L0 14.479l.172 1.282c.013.06.045.094.104.094.057 0 .09-.037.104-.094l.194-1.282-.194-1.332c-.014-.057-.047-.094-.104-.094m1.847-1.045c-.065 0-.105.049-.116.106l-.222 2.365.222 2.274c.011.06.051.107.116.107.063 0 .104-.047.116-.107l.25-2.274-.25-2.365c-.012-.057-.053-.106-.116-.106m.94-.392c-.073 0-.116.054-.123.115l-.209 2.757.209 2.507c.008.063.051.116.123.116.073 0 .116-.053.123-.116l.235-2.507-.235-2.757c-.008-.06-.051-.115-.123-.115m.956-.197c-.081 0-.129.058-.133.12l-.198 2.955.198 2.6c.005.067.052.123.133.123.08 0 .128-.056.133-.123l.222-2.6-.222-2.955c-.005-.062-.053-.12-.133-.12m1.025-.182c-.089 0-.139.063-.143.127l-.186 3.137.186 2.653c.004.073.054.132.143.132.088 0 .138-.06.143-.132l.209-2.653-.209-3.137c-.005-.064-.055-.127-.143-.127m1.065-.31c-.098 0-.148.07-.152.14l-.175 3.447.175 2.668c.004.076.054.14.152.14.096 0 .148-.064.152-.14l.197-2.668-.197-3.447c-.004-.07-.056-.14-.152-.14m1.078-.156c-.106 0-.155.075-.16.149l-.163 3.604.163 2.674c.005.08.054.149.16.149.104 0 .154-.07.16-.149l.183-2.674-.183-3.604c-.006-.074-.056-.149-.16-.149m1.106-.16c-.115 0-.164.08-.168.156l-.152 3.763.152 2.662c.004.085.053.157.168.157.113 0 .163-.072.168-.157l.17-2.662-.17-3.763c-.005-.077-.055-.157-.168-.157m1.152-.14c-.123 0-.174.084-.176.163l-.14 3.904.14 2.644c.002.088.053.163.176.163.122 0 .173-.075.176-.163l.157-2.644-.157-3.904c-.003-.079-.054-.163-.176-.163m1.19-.12c-.131 0-.183.089-.185.17l-.129 4.024.129 2.615c.002.093.054.17.185.17.13 0 .182-.077.185-.17l.144-2.615-.144-4.024c-.003-.081-.055-.17-.185-.17m1.225-.04c-.14 0-.192.094-.193.178l-.118 4.143.118 2.586c.001.096.053.178.193.178.139 0 .192-.082.193-.178l.132-2.586-.132-4.143c-.001-.084-.054-.178-.193-.178m1.477.793c-.04-.01-.083-.023-.125-.023-.166 0-.217.106-.218.192l-.106 3.374.106 2.553c.001.101.052.192.218.192.163 0 .218-.091.218-.192l.12-2.553-.12-3.374c-.001-.028-.007-.054-.014-.078a.56.56 0 0 0-.08-.09m.943-1.2c-.018-.007-.037-.01-.057-.01-.183 0-.234.118-.234.206l-.094 4.574.094 2.508c0 .106.051.206.234.206.167 0 .234-.1.234-.206l.106-2.508-.106-4.574c0-.028-.006-.054-.015-.077a.28.28 0 0 0-.162-.12m5.015.615c-.227 0-.443.039-.647.108a5.157 5.157 0 0 0-5.125-4.659c-.366 0-.725.044-1.074.123-.132.03-.165.06-.168.177v9.21c.003.12.087.214.203.226h6.81a2.508 2.508 0 0 0 2.5-2.507 2.508 2.508 0 0 0-2.5-2.51"/></svg>
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
