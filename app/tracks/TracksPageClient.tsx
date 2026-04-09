'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { SpotifyButton } from '@/components/SpotifyButton';

interface TrackRow {
  artist: string;
  title: string;
  key: string;
  slug: string;
  playCount: number;
  years: number[];
  djs: string[];
  festivals: string[];
  yearCounts: Record<number, number>;
  festivalCounts: Record<string, number>;
}

interface FestivalLabel {
  slug: string;
  shortName: string;
  accent: string;
}

interface TracksPageClientProps {
  tracks: TrackRow[];
  years: number[];
  festivalLabels: FestivalLabel[];
}

export function TracksPageClient({ tracks, years, festivalLabels }: TracksPageClientProps) {
  const [yearFilter, setYearFilter] = useState<string>('');
  const [festivalFilter, setFestivalFilter] = useState<string>('');

  const filteredTracks = useMemo(() => {
    let result = tracks;
    if (yearFilter) {
      const y = parseInt(yearFilter);
      result = result.filter((t) => t.years.includes(y));
    }
    if (festivalFilter) {
      result = result.filter((t) => t.festivals.includes(festivalFilter));
    }
    // Re-rank by filtered play count
    const ranked = result.map(t => {
      let filteredCount = t.playCount;
      if (yearFilter && festivalFilter) {
        filteredCount = Math.min(
          t.yearCounts[parseInt(yearFilter)] || 0,
          t.festivalCounts[festivalFilter] || 0
        );
      } else if (yearFilter) {
        filteredCount = t.yearCounts[parseInt(yearFilter)] || 0;
      } else if (festivalFilter) {
        filteredCount = t.festivalCounts[festivalFilter] || 0;
      }
      return { ...t, filteredCount };
    });
    ranked.sort((a, b) => b.filteredCount - a.filteredCount || a.artist.localeCompare(b.artist));
    return ranked.slice(0, 25);
  }, [tracks, yearFilter, festivalFilter]);

  const maxPlayCount = filteredTracks.length > 0 ? filteredTracks[0].filteredCount : 1;

  const subtitle = (() => {
    const parts: string[] = [];
    if (festivalFilter) {
      const label = festivalLabels.find(f => f.slug === festivalFilter);
      parts.push(label?.shortName || festivalFilter);
    }
    if (yearFilter) parts.push(yearFilter);
    return parts.length ? `Top 25 — ${parts.join(', ')}` : 'Top 25 across all festivals';
  })();

  const sortedYears = [...years].sort((a, b) => b - a);

  return (
    <>
      <h2>Tracks</h2>

      <div className="filters" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        {/* Festival filter chips */}
        {festivalLabels.length > 1 && (
          <>
            <button
              className={`filter-chip${festivalFilter === '' ? ' active' : ''}`}
              onClick={() => setFestivalFilter('')}
            >
              All Festivals
            </button>
            {festivalLabels.map(f => (
              <button
                key={f.slug}
                className={`filter-chip${festivalFilter === f.slug ? ' active' : ''}`}
                onClick={() => setFestivalFilter(f.slug)}
                style={festivalFilter === f.slug ? {
                  borderColor: f.accent,
                  color: f.accent,
                  background: `${f.accent}15`,
                  boxShadow: `0 0 0 1px ${f.accent}, 0 1px 4px ${f.accent}40`,
                } : undefined}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: f.accent, flexShrink: 0 }} />
                {f.shortName}
              </button>
            ))}
            <span style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
          </>
        )}
        {/* Year dropdown */}
        <select
          className="filter-select"
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
        >
          <option value="">All Years</option>
          {sortedYears.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Track Leaderboard</div>
          <div className="text-muted" style={{ fontSize: '0.75rem' }}>
            {subtitle}
          </div>
        </div>

        {filteredTracks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-text">
              No tracks found for the selected filters.
            </div>
          </div>
        ) : (
          <div>
            {filteredTracks.map((t, i) => {
              const rank = i + 1;
              const rankClass = rank <= 3 ? 'text-green' : 'text-purple';
              const count = t.filteredCount;
              const pct = maxPlayCount > 0 ? (count / maxPlayCount) * 100 : 0;

              return (
                <Link
                  key={t.key}
                  href={`/track/${t.slug}`}
                  className="leaderboard-row"
                  style={{ cursor: 'pointer', textDecoration: 'none' }}
                >
                  <div
                    className={`leaderboard-rank ${rankClass}`}
                    style={{ fontWeight: 700 }}
                  >
                    {rank}
                  </div>
                  <div className="leaderboard-info">
                    <div className="leaderboard-name">
                      {t.artist} &mdash; {t.title}
                    </div>
                    <div className="leaderboard-meta">
                      <span>
                        {t.years.length} year{t.years.length !== 1 ? 's' : ''}
                      </span>
                      <span className="sep">&middot;</span>
                      <span>
                        {t.djs.length} DJ{t.djs.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="leaderboard-bar">
                      <div
                        className="leaderboard-bar-fill"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="leaderboard-count">{count}</div>
                    <div className="leaderboard-count-label">plays</div>
                  </div>
                  <SpotifyButton artist={t.artist} title={t.title} />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
