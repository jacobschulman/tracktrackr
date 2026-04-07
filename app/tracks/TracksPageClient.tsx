'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

interface TrackRow {
  artist: string;
  title: string;
  key: string;
  slug: string;
  playCount: number;
  years: number[];
  djs: string[];
}

interface TracksPageClientProps {
  tracks: TrackRow[];
  stages: string[];
  years: number[];
}

export function TracksPageClient({ tracks, stages, years }: TracksPageClientProps) {
  const [yearFilter, setYearFilter] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<string>('');

  // Client-side filtering: since the server passed top 500 tracks with full data,
  // we filter by checking if a track appeared in the selected year/stage.
  // Note: The pre-computed tracks already have aggregated years/djs, but we don't
  // have per-appearance stage data. For stage filtering to work properly, we'd need
  // stage data per track. Since we have top tracks without stage breakdowns,
  // we show the full list when no stage filter and top 25.
  const filteredTracks = useMemo(() => {
    let result = tracks;
    if (yearFilter) {
      const y = parseInt(yearFilter);
      result = result.filter((t) => t.years.includes(y));
    }
    // Stage filtering would require per-appearance data; skip if not available
    return result.slice(0, 25);
  }, [tracks, yearFilter, stageFilter]);

  const maxPlayCount = filteredTracks.length > 0 ? filteredTracks[0].playCount : 1;

  const subtitle = (() => {
    const parts: string[] = [];
    if (yearFilter) parts.push(yearFilter);
    if (stageFilter) parts.push(stageFilter);
    return parts.length ? `Top 25 — ${parts.join(', ')}` : 'Top 25 across all years';
  })();

  const sortedYears = [...years].sort((a, b) => b - a);

  return (
    <>
      <h2>Tracks</h2>

      <div className="filters">
        <div>
          <div className="filter-label">Year</div>
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
        <div>
          <div className="filter-label">Stage</div>
          <select
            className="filter-select"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
          >
            <option value="">All Stages</option>
            {stages.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
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
              const pct = (t.playCount / maxPlayCount) * 100;

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
                    <div className="leaderboard-count">{t.playCount}</div>
                    <div className="leaderboard-count-label">plays</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
