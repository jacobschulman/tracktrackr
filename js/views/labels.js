/**
 * labels.js — Label Rise & Fall view
 * Route: #/labels
 */

import { getLabelTimeline, loadAllSets, isAllLoaded } from '../data.js?v=5';
import { CONFIG } from '../config.js?v=5';
import { fmt } from '../app.js?v=5';

let charts = [];

const PALETTE = [
  '#a855f7', '#22c55e', '#ec4899', '#14b8a6', '#f97316',
  '#eab308', '#6366f1', '#ef4444', '#06b6d4', '#f472b6',
  '#8b5cf6', '#84cc16', '#fb923c', '#2dd4bf', '#fbbf24',
];

export function destroy() {
  charts.forEach(c => c.destroy());
  charts = [];
}

export async function render(container, index, params) {
  container.innerHTML = `
    <div id="labels-loading">
      <div class="card" style="margin-bottom:24px;">
        <div class="card-header">
          <div class="card-title">Label Rise & Fall</div>
        </div>
        <div class="progress-label" id="labels-loading-label">Loading all sets for label analysis...</div>
        <div class="progress-bar-container">
          <div class="progress-bar" id="labels-loading-progress" style="width:0%"></div>
        </div>
      </div>
    </div>
    <div id="labels-content" style="display:none;"></div>
  `;

  // Load all sets if needed
  if (!isAllLoaded()) {
    const label = document.getElementById('labels-loading-label');
    const progress = document.getElementById('labels-loading-progress');

    await loadAllSets(null, (loaded, total) => {
      const pct = Math.round((loaded / total) * 100);
      label.textContent = `Loading ${loaded} of ${total} sets... ${pct}%`;
      progress.style.width = `${pct}%`;
    });
  }

  document.getElementById('labels-loading').style.display = 'none';
  document.getElementById('labels-content').style.display = '';

  const labelData = getLabelTimeline();
  if (!labelData || labelData.length === 0) {
    document.getElementById('labels-content').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">~</div>
        <div class="empty-state-text">No label data available.</div>
      </div>
    `;
    return;
  }

  // Determine years that have data
  const allYearsSet = new Set();
  for (const l of labelData) {
    for (const y of Object.keys(l.playsByYear)) {
      allYearsSet.add(parseInt(y));
    }
  }
  const allYears = [...allYearsSet].sort((a, b) => a - b);
  const minYear = allYears[0];
  const maxYear = allYears[allYears.length - 1];

  // Count total scraped sets
  const scrapedCount = index.scrapedSets || index.sets.filter(s => s.hasSetFile).length;

  const top15 = labelData.slice(0, 15);
  const top50 = labelData.slice(0, 50);

  document.getElementById('labels-content').innerHTML = `
    <div style="font-size:0.8125rem;color:var(--muted);margin-bottom:16px;">
      Based on ${fmt(scrapedCount)} scraped sets from years ${minYear}&ndash;${maxYear}
    </div>

    <div class="card" style="margin-bottom:24px;">
      <div class="card-header">
        <div class="card-title">Top 15 Labels Over Time</div>
        <div>
          <button class="year-pill active" id="btn-raw">Play Count</button>
          <button class="year-pill" id="btn-pct">% Share</button>
        </div>
      </div>
      <div class="chart-container" style="height:400px;">
        <canvas id="label-area-chart"></canvas>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Label Leaderboard</div>
        <div class="text-muted" style="font-size:0.75rem;">Top 50 labels by total plays</div>
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table" id="label-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Label</th>
              <th>Total Plays</th>
              <th>Peak Year</th>
              <th>Peak Plays</th>
            </tr>
          </thead>
          <tbody id="label-table-body"></tbody>
        </table>
      </div>
    </div>
  `;

  let mode = 'raw'; // 'raw' or 'pct'

  renderChart(mode);
  renderTable(top50);

  // Toggle buttons
  document.getElementById('btn-raw').addEventListener('click', () => {
    mode = 'raw';
    document.getElementById('btn-raw').classList.add('active');
    document.getElementById('btn-pct').classList.remove('active');
    renderChart(mode);
  });

  document.getElementById('btn-pct').addEventListener('click', () => {
    mode = 'pct';
    document.getElementById('btn-pct').classList.add('active');
    document.getElementById('btn-raw').classList.remove('active');
    renderChart(mode);
  });

  function renderChart(mode) {
    const canvas = document.getElementById('label-area-chart');
    if (!canvas) return;

    // Destroy existing
    const existing = charts.find(c => c.canvas === canvas);
    if (existing) {
      existing.destroy();
      charts = charts.filter(c => c !== existing);
    }

    const datasets = top15.map((label, i) => {
      const color = PALETTE[i % PALETTE.length];
      const data = allYears.map(y => {
        if (mode === 'pct') {
          return parseFloat(((label.shareByYear[y] || 0) * 100).toFixed(2));
        }
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

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: allYears.map(String),
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              boxWidth: 12,
              boxHeight: 12,
              padding: 10,
              font: { size: 10 },
              color: '#94a3b8',
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
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
            ticks: {
              color: '#64748b',
              font: { size: 10 },
              maxRotation: 0,
              autoSkip: true,
            },
          },
          y: {
            beginAtZero: true,
            stacked: false,
            grid: { color: '#1e1e2e' },
            ticks: {
              color: '#64748b',
              font: { size: 10 },
              callback: (val) => mode === 'pct' ? `${val}%` : val,
            },
            title: {
              display: true,
              text: mode === 'pct' ? '% Share' : 'Play Count',
              color: '#64748b',
              font: { size: 11 },
            },
          },
        },
      },
    });

    charts.push(chart);
  }

  function renderTable(labels) {
    const tbody = document.getElementById('label-table-body');
    if (!tbody) return;

    tbody.innerHTML = labels.map((l, i) => `
      <tr style="cursor:pointer;" data-label="${encodeURIComponent(l.label)}">
        <td style="color:var(--muted);font-weight:600;">${i + 1}</td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:6px;">
            <span class="dot" style="background:${i < 15 ? PALETTE[i % PALETTE.length] : 'var(--muted)'};width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0;"></span>
            ${l.label}
          </span>
        </td>
        <td>${fmt(l.totalPlays)}</td>
        <td>${l.peakYear || '—'}</td>
        <td>${fmt(l.peakPlays)}</td>
      </tr>
    `).join('');
  }
}
