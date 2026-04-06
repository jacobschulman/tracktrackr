'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
}

interface Props {
  allDJs: DJAggregate[];
  years: number[];
  allStages: string[];
  djYearCounts: Record<string, Record<number, number>>;
  djStages: Record<string, string[]>;
  stageFilteredData: Record<string, Record<string, Record<number, number>>>;
}

type SortMode = 'years' | 'sets' | 'streak';

export function DJsPageClient({ allDJs, years, allStages, djYearCounts, djStages, stageFilteredData }: Props) {
  const router = useRouter();
  const [sortMode, setSortMode] = useState<SortMode>('years');
  const [stageFilter, setStageFilter] = useState('');
  const [minApps, setMinApps] = useState(2);
  const heatmapRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // Spotlight cards
  const topByYears = [...allDJs].sort((a, b) => b.yearsCount - a.yearsCount);
  const topByStreak = [...allDJs].sort((a, b) => b.streak - a.streak);
  const mostYears = topByYears[0];
  const longestStreak = topByStreak[0];

  // Sorted leaderboard
  let sorted: DJAggregate[];
  if (sortMode === 'sets') {
    sorted = [...allDJs].sort((a, b) => b.totalSets - a.totalSets || b.yearsCount - a.yearsCount);
  } else if (sortMode === 'streak') {
    sorted = [...allDJs].sort((a, b) => b.streak - a.streak || b.yearsCount - a.yearsCount);
  } else {
    sorted = [...allDJs].sort((a, b) => b.yearsCount - a.yearsCount || b.totalSets - a.totalSets);
  }
  const top50 = sorted.slice(0, 50);

  let maxVal = 1;
  if (top50.length > 0) {
    if (sortMode === 'sets') maxVal = top50[0].totalSets;
    else if (sortMode === 'streak') maxVal = top50[0].streak;
    else maxVal = top50[0].yearsCount;
  }

  // Compute heatmap data
  const computeHeatmapData = useCallback(() => {
    let sourceCounts: Record<string, Record<number, number>>;
    if (stageFilter && stageFilteredData[stageFilter]) {
      sourceCounts = stageFilteredData[stageFilter];
    } else {
      sourceCounts = djYearCounts;
    }

    const djList: { name: string; slug: string; yearCounts: Record<number, number>; total: number }[] = [];
    const slugToName = new Map(allDJs.map(d => [d.slug, d.name]));

    for (const [slug, yCounts] of Object.entries(sourceCounts)) {
      const total = Object.values(yCounts).reduce((s, v) => s + v, 0);
      if (total >= minApps) {
        djList.push({
          name: slugToName.get(slug) || slug,
          slug,
          yearCounts: yCounts,
          total,
        });
      }
    }

    djList.sort((a, b) => b.total - a.total);
    return djList.slice(0, 80);
  }, [stageFilter, minApps, allDJs, djYearCounts, stageFilteredData]);

  // D3 heatmap rendering
  useEffect(() => {
    const gridEl = heatmapRef.current;
    if (!gridEl) return;

    // Dynamically import d3
    import('d3').then((d3) => {
      gridEl.innerHTML = '';

      const djList = computeHeatmapData();

      if (djList.length === 0) {
        gridEl.innerHTML = '<div class="empty-state"><div class="empty-state-text">No DJs match the current filters.</div></div>';
        return;
      }

      // Create tooltip
      if (!tooltipRef.current) {
        const tip = document.createElement('div');
        tip.className = 'heatmap-tooltip';
        tip.style.display = 'none';
        document.body.appendChild(tip);
        tooltipRef.current = tip;
      }
      const tooltip = tooltipRef.current;

      const cellSize = 20;
      const cellGap = 1;
      const step = cellSize + cellGap;
      const labelWidth = 160;
      const headerHeight = 40;

      const width = labelWidth + years.length * step + 20;
      const height = headerHeight + djList.length * step + 10;

      const svg = d3.select(gridEl)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('display', 'block');

      // Year labels (x axis)
      const yearGroup = svg.append('g')
        .attr('transform', `translate(${labelWidth}, 0)`);

      yearGroup.selectAll('text')
        .data(years)
        .enter()
        .append('text')
        .attr('x', (_d: number, i: number) => i * step + cellSize / 2)
        .attr('y', headerHeight - 6)
        .attr('text-anchor', 'middle')
        .attr('fill', '#94a3b8')
        .attr('font-size', years.length > 20 ? '8px' : '10px')
        .attr('font-family', "'Inter', system-ui, sans-serif")
        .text((d: number) => {
          if (years.length > 20) {
            return d % 2 === 0 ? String(d).slice(2) : '';
          }
          return String(d).slice(2);
        });

      // DJ rows
      const rowGroup = svg.append('g')
        .attr('transform', `translate(0, ${headerHeight})`);

      djList.forEach((dj, rowIdx) => {
        const y = rowIdx * step;

        // DJ name label
        const label = rowGroup.append('text')
          .attr('x', labelWidth - 8)
          .attr('y', y + cellSize / 2 + 4)
          .attr('text-anchor', 'end')
          .attr('fill', '#e2e8f0')
          .attr('font-size', '11px')
          .attr('font-family', "'Inter', system-ui, sans-serif")
          .attr('cursor', 'pointer')
          .text(dj.name.length > 20 ? dj.name.substring(0, 18) + '...' : dj.name);

        label.on('click', () => {
          router.push(`/dj/${dj.slug}`);
        });

        label.on('mouseover', function (this: SVGTextElement) {
          d3.select(this).attr('fill', '#8b5cf6');
        });

        label.on('mouseout', function (this: SVGTextElement) {
          d3.select(this).attr('fill', '#e2e8f0');
        });

        // Year cells
        years.forEach((year, colIdx) => {
          const count = dj.yearCounts[year] || 0;
          const x = labelWidth + colIdx * step;

          let fill: string;
          if (count === 0) {
            fill = 'rgba(30, 30, 46, 0.2)';
          } else if (count === 1) {
            fill = 'rgba(139, 92, 246, 0.35)';
          } else {
            fill = 'rgba(139, 92, 246, 0.8)';
          }

          const rect = rowGroup.append('rect')
            .attr('x', x)
            .attr('y', y)
            .attr('width', cellSize)
            .attr('height', cellSize)
            .attr('rx', 2)
            .attr('fill', fill)
            .attr('cursor', count > 0 ? 'pointer' : 'default');

          rect.on('mousemove', function (event: MouseEvent) {
            if (!tooltip) return;
            tooltip.style.display = 'block';
            tooltip.textContent = `${dj.name} \u2014 ${year}: ${count} set${count !== 1 ? 's' : ''}`;
            tooltip.style.left = (event.clientX + 12) + 'px';
            tooltip.style.top = (event.clientY - 8) + 'px';
          });

          rect.on('mouseout', function () {
            if (!tooltip) return;
            tooltip.style.display = 'none';
          });

          if (count > 0) {
            rect.on('click', () => {
              router.push(`/dj/${dj.slug}`);
            });
          }
        });
      });
    });

    return () => {
      if (tooltipRef.current && tooltipRef.current.parentNode) {
        tooltipRef.current.parentNode.removeChild(tooltipRef.current);
        tooltipRef.current = null;
      }
    };
  }, [computeHeatmapData, years, router]);

  return (
    <>
      <h2 style={{ marginBottom: 16 }}>DJs</h2>

      {/* Insight Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {mostYears && (
          <Link
            href={`/dj/${mostYears.slug}`}
            className="card"
            style={{
              borderLeft: '3px solid var(--purple-lt)',
              padding: '16px 20px',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            <div style={{ fontSize: '0.6875rem', color: 'var(--purple-lt)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 }}>
              Most Tenured
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-bright)', marginBottom: 2 }}>
              {mostYears.name}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--muted-lt)' }}>
              {mostYears.yearsCount} years at Ultra ({mostYears.firstYear}&ndash;{mostYears.lastYear})
            </div>
          </Link>
        )}
        {longestStreak && longestStreak.streak > 1 && (
          <Link
            href={`/dj/${longestStreak.slug}`}
            className="card"
            style={{
              borderLeft: '3px solid var(--green)',
              padding: '16px 20px',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            <div style={{ fontSize: '0.6875rem', color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 }}>
              Longest Streak
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-bright)', marginBottom: 2 }}>
              {longestStreak.name}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--muted-lt)' }}>
              {longestStreak.streak} consecutive years &middot; {longestStreak.totalSets} total sets
            </div>
          </Link>
        )}
      </div>

      {/* Leaderboard */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">DJ Leaderboard</div>
          <div className="sort-pills">
            {(['years', 'sets', 'streak'] as SortMode[]).map((mode) => (
              <button
                key={mode}
                className={`pill ${sortMode === mode ? 'active' : ''}`}
                onClick={() => setSortMode(mode)}
              >
                {mode === 'years' ? 'Most Years' : mode === 'sets' ? 'Most Sets' : 'Longest Streak'}
              </button>
            ))}
          </div>
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

      {/* Heatmap */}
      <div className="card" style={{ marginTop: 32 }}>
        <div className="card-header">
          <div className="card-title">DJ Continuity Heatmap</div>
        </div>

        <div className="filters" style={{ padding: '0 20px 12px' }}>
          <div>
            <div className="filter-label">Stage</div>
            <select
              className="filter-select"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
            >
              <option value="">All Stages</option>
              {allStages.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="filter-label">Min Appearances</div>
            <input
              type="range"
              min="1"
              max="10"
              value={minApps}
              onChange={(e) => setMinApps(parseInt(e.target.value))}
              style={{ width: 120, accentColor: 'var(--purple-lt)' }}
            />
            <span style={{ fontSize: '0.8125rem', color: 'var(--muted-lt)', marginLeft: 6 }}>
              {minApps}
            </span>
          </div>
        </div>

        <div ref={heatmapRef} style={{ overflowX: 'auto', padding: '0 20px 20px' }} />
      </div>
    </>
  );
}
