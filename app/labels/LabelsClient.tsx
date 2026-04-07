'use client';

import { useState, useEffect, useRef } from 'react';

const PALETTE = [
  '#a855f7', '#22c55e', '#ec4899', '#14b8a6', '#f97316',
  '#eab308', '#6366f1', '#ef4444', '#06b6d4', '#f472b6',
  '#8b5cf6', '#84cc16', '#fb923c', '#2dd4bf', '#fbbf24',
];

interface LabelEntry {
  label: string;
  totalPlays: number;
  peakYear: number | null;
  peakPlays: number;
  playsByYear: Record<number, number>;
  shareByYear: Record<number, number>;
}

export function LabelsClient({ top15, top50, allYears }: { top15: LabelEntry[]; top50: LabelEntry[]; allYears: number[] }) {
  const [mode, setMode] = useState<'raw' | 'pct'>('raw');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    let Chart: any;
    const initChart = async () => {
      const mod = await import('chart.js/auto');
      Chart = mod.default;
      renderChart();
    };
    initChart();

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, []);

  useEffect(() => {
    renderChart();
  }, [mode]);

  function renderChart() {
    if (!canvasRef.current) return;

    import('chart.js/auto').then((mod) => {
      const Chart = mod.default;

      if (chartRef.current) chartRef.current.destroy();

      const datasets = top15.map((label, i) => {
        const color = PALETTE[i % PALETTE.length];
        const data = allYears.map(y => {
          if (mode === 'pct') return parseFloat(((label.shareByYear[y] || 0) * 100).toFixed(2));
          return label.playsByYear[y] || 0;
        });

        return {
          label: label.label,
          data,
          fill: true,
          backgroundColor: color + '33',
          borderColor: color,
          borderWidth: 1.5,
          pointRadius: 0,
          pointHitRadius: 8,
          tension: 0.3,
        };
      });

      chartRef.current = new Chart(canvasRef.current!, {
        type: 'line',
        data: { labels: allYears.map(String), datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index' as const, intersect: false },
          plugins: {
            legend: {
              display: true,
              position: 'top' as const,
              labels: { boxWidth: 12, boxHeight: 12, padding: 10, font: { size: 10 }, color: '#94a3b8' },
            },
            tooltip: {
              callbacks: {
                label: (ctx: any) => {
                  const val = ctx.parsed.y;
                  if (mode === 'pct') return `${ctx.dataset.label}: ${val.toFixed(1)}%`;
                  return `${ctx.dataset.label}: ${val} plays`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { color: '#1e1e2e' },
              ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 0, autoSkip: true },
            },
            y: {
              beginAtZero: true,
              grid: { color: '#1e1e2e' },
              ticks: {
                color: '#64748b',
                font: { size: 10 },
                callback: (val: any) => mode === 'pct' ? `${val}%` : val,
              },
              title: { display: true, text: mode === 'pct' ? '% Share' : 'Play Count', color: '#64748b', font: { size: 11 } },
            },
          },
        },
      });
    });
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">Top 15 Labels Over Time</div>
          <div>
            <button className={`year-pill ${mode === 'raw' ? 'active' : ''}`} onClick={() => setMode('raw')}>Play Count</button>
            <button className={`year-pill ${mode === 'pct' ? 'active' : ''}`} onClick={() => setMode('pct')}>% Share</button>
          </div>
        </div>
        <div className="chart-container" style={{ height: 400 }}>
          <canvas ref={canvasRef} />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Label Leaderboard</div>
          <div className="text-muted" style={{ fontSize: '0.75rem' }}>Top 50 labels by total plays</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Label</th>
                <th>Total Plays</th>
                <th>Peak Year</th>
                <th>Peak Plays</th>
              </tr>
            </thead>
            <tbody>
              {top50.map((l, i) => (
                <tr key={l.label}>
                  <td style={{ color: 'var(--muted)', fontWeight: 600 }}>{i + 1}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ background: i < 15 ? PALETTE[i % PALETTE.length] : 'var(--muted)', width: 8, height: 8, borderRadius: '50%', display: 'inline-block', flexShrink: 0 }} />
                      {l.label}
                    </span>
                  </td>
                  <td>{l.totalPlays.toLocaleString()}</td>
                  <td>{l.peakYear || '\u2014'}</td>
                  <td>{l.peakPlays.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
