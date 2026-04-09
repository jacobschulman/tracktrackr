'use client';

import { useState, useMemo } from 'react';

interface StageData {
  stage: string;
  firstYear: number;
  lastYear: number;
  totalSets: number;
  totalYears: number;
  appearedYears: number[];
  missingYears: number[];
  color: string;
  festival: string;
}

interface FestivalLabel {
  slug: string;
  shortName: string;
  accent: string;
}

interface StageTimelineProps {
  stages: StageData[];
  years: number[];
  minYear: number;
  maxYear: number;
  stageSetCounts: Record<string, Record<number, number>>;
  festivalLabels: FestivalLabel[];
}

export default function StageTimeline({ stages, years, minYear, maxYear, stageSetCounts, festivalLabels }: StageTimelineProps) {
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [festivalFilter, setFestivalFilter] = useState<string>('');

  const filteredStages = useMemo(() => {
    if (!festivalFilter) return stages;
    return stages.filter(s => s.festival === festivalFilter);
  }, [stages, festivalFilter]);

  const labelWidth = 200;
  const margin = { top: 30, right: 20, bottom: 10, left: labelWidth };
  const rowHeight = 26;
  const barHeight = 16;
  const width = 900;
  const height = margin.top + margin.bottom + filteredStages.length * rowHeight;
  const chartWidth = width - margin.left - margin.right;

  const xScale = (year: number) =>
    ((year - minYear) / (maxYear - minYear)) * chartWidth;

  const yearTicks = years.filter(y => y % 5 === 0 || y === minYear || y === maxYear);

  const stage = selectedStage ? filteredStages.find(s => s.stage === selectedStage) : null;
  const setCounts = stage ? stageSetCounts[stage.stage] || {} : {};
  const sparkYears: number[] = [];
  const sparkCounts: number[] = [];
  if (stage) {
    for (let y = stage.firstYear; y <= stage.lastYear; y++) {
      sparkYears.push(y);
      sparkCounts.push(setCounts[y] || 0);
    }
  }
  const maxSparkCount = Math.max(1, ...sparkCounts);

  return (
    <>
      {/* Festival filter */}
      {festivalLabels.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          <button
            className={`filter-chip${festivalFilter === '' ? ' active' : ''}`}
            onClick={() => { setFestivalFilter(''); setSelectedStage(null); }}
          >
            All Festivals
          </button>
          {festivalLabels.map(f => (
            <button
              key={f.slug}
              className={`filter-chip${festivalFilter === f.slug ? ' active' : ''}`}
              onClick={() => { setFestivalFilter(f.slug); setSelectedStage(null); }}
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

      {/* Desktop SVG timeline */}
      <div className="viz-container stage-desktop" style={{ overflowX: 'auto' }}>
        <svg width={width} height={height} style={{ display: 'block' }}>
          <g transform={`translate(${margin.left},${margin.top})`}>
            {/* Year labels */}
            {yearTicks.map(y => (
              <text
                key={`label-${y}`}
                x={xScale(y)}
                y={-10}
                textAnchor="middle"
                fill="#64748b"
                fontSize="10px"
                fontFamily="'Inter', system-ui, sans-serif"
              >
                {y}
              </text>
            ))}
            {/* Grid lines */}
            {yearTicks.map(y => (
              <line
                key={`grid-${y}`}
                x1={xScale(y)}
                x2={xScale(y)}
                y1={0}
                y2={filteredStages.length * rowHeight}
                stroke="#1e1e2e"
                strokeDasharray="2,3"
              />
            ))}
            {/* Stage rows */}
            {filteredStages.map((s, i) => {
              const y = i * rowHeight;
              const yearWidth = xScale(1) - xScale(0);
              return (
                <g key={s.stage}>
                  {/* Hover background */}
                  <rect
                    x={0}
                    y={y}
                    width={chartWidth}
                    height={rowHeight}
                    fill="transparent"
                    cursor="pointer"
                    onClick={() => setSelectedStage(selectedStage === s.stage ? null : s.stage)}
                  />
                  {/* Active year bars */}
                  {s.appearedYears.map(yr => {
                    const barX = xScale(yr) - yearWidth / 2 + 1;
                    const barW = Math.max(yearWidth - 2, 3);
                    return (
                      <rect
                        key={yr}
                        x={barX}
                        y={y + (rowHeight - barHeight) / 2}
                        width={barW}
                        height={barHeight}
                        rx={2}
                        fill={s.color}
                        opacity={0.85}
                        cursor="pointer"
                        onClick={() => setSelectedStage(selectedStage === s.stage ? null : s.stage)}
                      />
                    );
                  })}
                </g>
              );
            })}
          </g>
          {/* Stage name labels (outside chart area) */}
          {filteredStages.map((s, i) => {
            const y = i * rowHeight;
            const label = s.stage.length > 24 ? s.stage.substring(0, 22) + '...' : s.stage;
            return (
              <text
                key={`name-${s.stage}`}
                x={margin.left - 10}
                y={margin.top + y + rowHeight / 2}
                textAnchor="end"
                dominantBaseline="central"
                fill="#94a3b8"
                fontSize="11px"
                fontFamily="'Inter', system-ui, sans-serif"
                cursor="pointer"
                onClick={() => setSelectedStage(selectedStage === s.stage ? null : s.stage)}
              >
                {label}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Mobile card list */}
      <div className="stage-card-list">
        {filteredStages.map(s => (
          <div
            key={s.stage}
            className="stage-card"
            onClick={() => setSelectedStage(selectedStage === s.stage ? null : s.stage)}
            style={{ cursor: 'pointer' }}
          >
            <div className="stage-card-header">
              <span
                className="dot"
                style={{
                  background: s.color,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  display: 'inline-block',
                }}
              />
              <span className="stage-card-name">{s.stage}</span>
            </div>
            <div className="stage-card-meta">
              Active: {s.firstYear}&ndash;{s.lastYear} &middot; {s.totalYears} years &middot; {s.totalSets} sets
            </div>
            <div className="stage-card-years">
              {s.appearedYears.map(y => (
                <span key={y} className="year-pill">{y}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Detail panel */}
      {stage && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                className="dot"
                style={{
                  background: stage.color,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  display: 'inline-block',
                }}
              />
              {stage.stage}
            </div>
            <button
              onClick={() => setSelectedStage(null)}
              style={{
                fontSize: '1.25rem',
                color: 'var(--muted)',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
              }}
            >
              &times;
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div className="section-title">Overview</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text)', marginBottom: 8 }}>
                <strong>{stage.totalSets.toLocaleString()}</strong> total sets across{' '}
                <strong>{stage.totalYears}</strong> years
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--muted-lt)', marginBottom: 8 }}>
                Active: {stage.firstYear} &ndash; {stage.lastYear}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginBottom: 4 }}>
                Active years:
              </div>
              <div className="year-pills" style={{ marginBottom: 12 }}>
                {stage.appearedYears.map(y => (
                  <span key={y} className="year-pill" style={{ cursor: 'default' }}>{y}</span>
                ))}
              </div>
              {stage.missingYears.length > 0 && (
                <>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginBottom: 4 }}>
                    Gap years:
                  </div>
                  <div className="year-pills">
                    {stage.missingYears.map(y => (
                      <span key={y} className="year-pill" style={{ cursor: 'default', opacity: 0.5 }}>{y}</span>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div>
              <div className="section-title">Sets per Year</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 100 }}>
                {sparkYears.map((y, i) => (
                  <div
                    key={y}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      height: '100%',
                    }}
                    title={`${y}: ${sparkCounts[i]} sets`}
                  >
                    <div
                      style={{
                        width: '100%',
                        maxWidth: 20,
                        height: `${(sparkCounts[i] / maxSparkCount) * 100}%`,
                        minHeight: sparkCounts[i] > 0 ? 2 : 0,
                        background: stage.color,
                        borderRadius: 2,
                      }}
                    />
                    {sparkYears.length <= 15 && (
                      <div style={{ fontSize: '0.5rem', color: '#64748b', marginTop: 2 }}>{y}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
