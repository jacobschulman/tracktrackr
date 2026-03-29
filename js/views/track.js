/**
 * track.js — Track Detail view
 * Route: #/track/{encodedTrackKey}
 */

import { loadAllSets, isAllLoaded, getTrackHistory, getTrackStreak, getBlendAppearances, getTopTracks, trackKey, parseTrackKey } from '../data.js?v=2';
import { CONFIG, getStageColor } from '../config.js?v=2';
import { fmt, stageBadge, navigateTo } from '../app.js?v=2';

let charts = [];

export function destroy() {
  charts.forEach(c => c.destroy());
  charts = [];
}

export async function render(container, index, params) {
  const rawKey = params[0];
  if (!rawKey) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">?</div><div class="empty-state-text">No track specified.</div></div>`;
    return;
  }

  const { artist, title } = parseTrackKey(rawKey);
  if (!artist && !title) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">?</div><div class="empty-state-text">Invalid track key.</div></div>`;
    return;
  }

  // Display name with proper casing
  const displayArtist = titleCase(artist);
  const displayTitle = titleCase(title);

  // Show loading state while sets load
  container.innerHTML = `
    <div class="detail-header">
      <h1 class="detail-name">${displayArtist} &mdash; ${displayTitle}</h1>
      <div class="detail-meta">
        <span class="pill pill-purple" id="track-play-count">Loading...</span>
      </div>
    </div>
    <div id="track-loading">
      <div class="progress-label" id="track-loading-label">Loading sets...</div>
      <div class="progress-bar-container"><div class="progress-bar" id="track-loading-progress" style="width:0%"></div></div>
    </div>
    <div id="track-content"></div>
  `;

  // Load all sets if needed
  if (!isAllLoaded()) {
    const loadingEl = document.getElementById('track-loading');
    const loadingLabel = document.getElementById('track-loading-label');
    const loadingProgress = document.getElementById('track-loading-progress');
    if (loadingEl) loadingEl.style.display = 'block';

    await loadAllSets(null, (loaded, total) => {
      const pct = Math.round((loaded / total) * 100);
      if (loadingLabel) loadingLabel.textContent = `Loading ${loaded} of ${total} sets... ${pct}%`;
      if (loadingProgress) loadingProgress.style.width = `${pct}%`;
    });

    if (loadingEl) loadingEl.style.display = 'none';
  }

  // Get track data
  const history = getTrackHistory(artist, title);
  const streak = getTrackStreak(artist, title);
  const blends = getBlendAppearances(artist, title);

  if (history.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">?</div><div class="empty-state-text">Track not found in any set.</div></div>`;
    return;
  }

  // Update play count badge
  const playCountEl = document.getElementById('track-play-count');
  if (playCountEl) playCountEl.textContent = `${history.length} plays`;

  // Streak / orbit timeline
  const minYear = CONFIG.years.min;
  const maxYear = CONFIG.years.max;
  const orbitByYear = streak.orbitByYear || {};
  const activeYears = new Set(streak.years || []);
  const maxOrbit = Math.max(1, ...Object.values(orbitByYear));

  let timelineHtml = '';
  let timelineLabelsHtml = '';
  for (let y = minYear; y <= maxYear; y++) {
    const active = activeYears.has(y);
    const djCount = orbitByYear[y] || 0;
    const size = active ? Math.max(10, Math.round(8 + 20 * (djCount / maxOrbit))) : 6;
    const bg = active ? 'var(--green)' : 'transparent';
    const border = active ? 'none' : '1.5px solid var(--border-lt)';
    const tooltipText = active ? `${y}: ${djCount} DJ${djCount !== 1 ? 's' : ''}` : `${y}`;
    timelineHtml += `<div class="timeline-dot" style="width:${size}px;height:${size}px;background:${bg};border:${border};" title="${tooltipText}"></div>`;
    const showLabel = (y % 5 === 0) || y === minYear || y === maxYear;
    timelineLabelsHtml += `<div style="width:${size}px;text-align:center;font-size:0.5625rem;color:var(--muted);flex-shrink:0;">${showLabel ? y : ''}</div>`;
  }

  // Play history table (newest first — already sorted by getTrackHistory)
  const tableRowsHtml = history.map(a => {
    const djSlug = a.djSlugs && a.djSlugs[0] ? a.djSlugs[0] : '';
    const dateFormatted = formatDate(a.date);
    const type = a.pos && a.pos.startsWith('w/') ? '<span class="pill">blend</span>' : '<span class="pill pill-green">standalone</span>';
    return `<tr>
      <td>${a.year}</td>
      <td>${djSlug ? `<a href="#/dj/${djSlug}" class="dj-link">${a.dj}</a>` : a.dj}</td>
      <td>${stageBadge(a.stage)}</td>
      <td>${dateFormatted}</td>
      <td>${type}</td>
    </tr>`;
  }).join('');

  // Blend appearances
  let blendsHtml = '';
  if (blends.length > 0) {
    blendsHtml = `
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header">
        <div class="card-title">Blend Appearances</div>
        <div class="text-muted" style="font-size:0.75rem;">${blends.length} blend${blends.length !== 1 ? 's' : ''}</div>
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>DJ</th>
              <th>Blended With</th>
            </tr>
          </thead>
          <tbody>
            ${blends.map(b => {
              const djSlug = b.djSlugs && b.djSlugs[0] ? b.djSlugs[0] : '';
              const pairedLinks = b.pairedWith.map(p => {
                const pKey = trackKey(p.artist, p.title);
                const encoded = encodeURIComponent(pKey);
                return `<a href="#/track/${encoded}" class="track-link" style="font-size:0.8125rem;">${p.artist} — ${p.title}${p.remix ? ' (' + p.remix + ')' : ''}</a>`;
              }).join(', ');
              return `<tr>
                <td>${b.year}</td>
                <td>${djSlug ? `<a href="#/dj/${djSlug}" class="dj-link">${b.dj}</a>` : b.dj}</td>
                <td>${pairedLinks}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  // Build DJ play counts for "Who Plays This Most" chart
  const djPlayCounts = {};
  const djSlugMap = {};
  for (const a of history) {
    const djName = a.dj;
    djPlayCounts[djName] = (djPlayCounts[djName] || 0) + 1;
    if (a.djSlugs && a.djSlugs[0]) {
      djSlugMap[djName] = a.djSlugs[0];
    }
  }
  const sortedDJs = Object.entries(djPlayCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  const contentEl = document.getElementById('track-content');
  if (!contentEl) return;

  contentEl.innerHTML = `
    <div class="detail-grid">
      <div class="card">
        <div class="card-header"><div class="card-title">Orbit Timeline</div></div>
        <div style="overflow-x:auto;">
          <div style="display:flex;align-items:center;gap:4px;min-width:max-content;padding:8px 0;">
            ${timelineHtml}
          </div>
          <div style="display:flex;align-items:flex-start;gap:4px;min-width:max-content;">
            ${timelineLabelsHtml}
          </div>
        </div>
        <div style="margin-top:12px;display:flex;gap:16px;font-size:0.75rem;color:var(--muted);">
          <span><strong style="color:var(--text)">${streak.totalYears}</strong> years played</span>
          ${streak.streak > 1 ? `<span><strong style="color:var(--text)">${streak.streak}</strong>-year streak (${streak.startYear}&ndash;${streak.endYear})</span>` : ''}
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">Stats</div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="stat-card">
            <div class="stat-number">${history.length}</div>
            <div class="stat-label">Total Plays</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${streak.totalYears}</div>
            <div class="stat-label">Years</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${Object.keys(djPlayCounts).length}</div>
            <div class="stat-label">Unique DJs</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${blends.length}</div>
            <div class="stat-label">Blends</div>
          </div>
        </div>
      </div>
    </div>

    ${sortedDJs.length > 1 ? `
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header">
        <div class="card-title">Who Plays This Most</div>
      </div>
      <div class="chart-container" style="height:${Math.max(200, sortedDJs.length * 36)}px;">
        <canvas id="track-dj-chart"></canvas>
      </div>
    </div>` : ''}

    <div class="card" style="margin-bottom:24px;">
      <div class="card-header">
        <div class="card-title">Play History</div>
        <div class="text-muted" style="font-size:0.75rem;">${history.length} appearances</div>
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>DJ</th>
              <th>Stage</th>
              <th>Date</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </div>
    </div>

    ${blendsHtml}
  `;

  // Render "Who Plays This Most" chart
  if (sortedDJs.length > 1 && typeof Chart !== 'undefined') {
    const canvas = document.getElementById('track-dj-chart');
    if (canvas) {
      const labels = sortedDJs.map(([name]) => name);
      const data = sortedDJs.map(([, count]) => count);

      const chart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: sortedDJs.map(([, count], i) => {
              const opacity = 0.5 + (0.5 * (1 - i / sortedDJs.length));
              return `rgba(0, 255, 136, ${opacity})`;
            }),
            borderColor: 'rgba(0, 255, 136, 0.6)',
            borderWidth: 1,
            borderRadius: 4,
            barThickness: 24,
          }],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            tooltip: {
              callbacks: {
                afterLabel: (ctx) => {
                  const djName = sortedDJs[ctx.dataIndex][0];
                  const djApps = history.filter(a => a.dj === djName);
                  const djYears = [...new Set(djApps.map(a => a.year))].sort();
                  return `Years: ${djYears.join(', ')}`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { color: '#1e1e2e' },
              ticks: {
                color: '#94a3b8',
                font: { size: 11 },
                stepSize: 1,
              },
              title: { display: true, text: 'Play Count', color: '#64748b' },
            },
            y: {
              grid: { display: false },
              ticks: {
                color: '#e2e8f0',
                font: { size: 12 },
              },
            },
          },
          onClick: (e, elements) => {
            if (elements.length > 0) {
              const idx = elements[0].index;
              const djName = sortedDJs[idx][0];
              const djSlug = djSlugMap[djName];
              if (djSlug) {
                location.hash = `#/dj/${djSlug}`;
              }
            }
          },
          onHover: (e, elements) => {
            e.native.target.style.cursor = elements.length ? 'pointer' : 'default';
          },
        },
      });

      charts.push(chart);
    }
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function titleCase(str) {
  if (!str) return '';
  return str.replace(/\b\w/g, c => c.toUpperCase());
}
