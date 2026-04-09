'use client';

import { useState } from 'react';
import Link from 'next/link';

interface DJAggregate {
  name: string;
  slug: string;
  yearsArr: number[];
  yearsCount: number;
  firstYear: number;
  lastYear: number;
  totalSets: number;
  streak: number;
  festivals: string[];
}

interface Props {
  allDJs: DJAggregate[];
  djsByFestival: Record<string, DJAggregate[]>;
  festivalLabels: { slug: string; shortName: string; accent: string }[];
}

type SortMode = 'years' | 'sets' | 'streak';

export function DJsPageClient({ allDJs, djsByFestival, festivalLabels }: Props) {
  const [sortMode, setSortMode] = useState<SortMode>('years');
  const [festivalFilter, setFestivalFilter] = useState<string>('');

  // Pick the right DJ list
  const activeDJs = festivalFilter ? (djsByFestival[festivalFilter] || []) : allDJs;

  // Sorted leaderboard
  let sorted: DJAggregate[];
  if (sortMode === 'sets') {
    sorted = [...activeDJs].sort((a, b) => b.totalSets - a.totalSets || b.yearsCount - a.yearsCount);
  } else if (sortMode === 'streak') {
    sorted = [...activeDJs].sort((a, b) => b.streak - a.streak || b.yearsCount - a.yearsCount);
  } else {
    sorted = [...activeDJs].sort((a, b) => b.yearsCount - a.yearsCount || b.totalSets - a.totalSets);
  }
  const top50 = sorted.slice(0, 50);

  let maxVal = 1;
  if (top50.length > 0) {
    if (sortMode === 'sets') maxVal = top50[0].totalSets;
    else if (sortMode === 'streak') maxVal = top50[0].streak;
    else maxVal = top50[0].yearsCount;
  }

  return (
    <>
      <h2 style={{ marginBottom: 16 }}>DJs</h2>

      {/* Leaderboard */}
      <div className="card">
        <div className="card-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <div className="card-title">DJ Leaderboard</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['years', 'sets', 'streak'] as SortMode[]).map((mode) => (
                <button
                  key={mode}
                  className={`filter-chip${sortMode === mode ? ' active' : ''}`}
                  onClick={() => setSortMode(mode)}
                >
                  {mode === 'years' ? 'Most Years' : mode === 'sets' ? 'Most Sets' : 'Longest Streak'}
                </button>
              ))}
            </div>
          </div>

          {/* Festival filter chips */}
          {festivalLabels.length > 1 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
            </div>
          )}
        </div>

        {top50.length === 0 ? (
          <div className="empty-state" style={{ padding: 24 }}>
            <div className="empty-state-text">No DJ data available.</div>
          </div>
        ) : (
          top50.map((dj, i) => {
            const rank = i + 1;
            const top3 = rank <= 3 ? 'top3' : '';

            let pct: number, countVal: number, countLabel: string;
            if (sortMode === 'sets') {
              pct = maxVal > 0 ? (dj.totalSets / maxVal) * 100 : 0;
              countVal = dj.totalSets;
              countLabel = 'sets';
            } else if (sortMode === 'streak') {
              pct = maxVal > 0 ? (dj.streak / maxVal) * 100 : 0;
              countVal = dj.streak;
              countLabel = 'yr streak';
            } else {
              pct = maxVal > 0 ? (dj.yearsCount / maxVal) * 100 : 0;
              countVal = dj.yearsCount;
              countLabel = 'years';
            }

            return (
              <Link
                key={dj.slug}
                href={`/dj/${dj.slug}`}
                className="leaderboard-row"
                style={{ textDecoration: 'none', cursor: 'pointer' }}
              >
                <div className={`leaderboard-rank ${top3}`}>{rank}</div>
                <div className="leaderboard-info">
                  <div className="leaderboard-name">{dj.name}</div>
                  <div className="leaderboard-meta">
                    <span>{dj.firstYear}&ndash;{dj.lastYear}</span>
                    <span className="sep">&middot;</span>
                    <span>{dj.totalSets} sets</span>
                    <span className="sep">&middot;</span>
                    <span>{dj.streak}yr streak</span>
                  </div>
                  <div className="leaderboard-bar">
                    <div className="leaderboard-bar-fill" style={{ width: `${pct.toFixed(1)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="leaderboard-count">{countVal}</div>
                  <div className="leaderboard-count-label">{countLabel}</div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </>
  );
}
