/**
 * overview.js — Overview landing page
 * Hero welcome, stat bar, filters, dual leaderboard layout (no Chart.js)
 */

import { loadAllSets, getTopTracks, isAllLoaded, trackKey } from '../data.js?v=2';
import { CONFIG, getStageColor } from '../config.js?v=2';
import { fmt, stageBadge } from '../app.js?v=2';

export function destroy() {
  // Nothing to tear down — pure DOM, no chart instances
}

export async function render(container, index, params) {
  // Unique DJs
  const djSlugs = new Set();
  for (const s of index.sets) {
    for (const d of s.djs) djSlugs.add(d.slug);
  }

  // Unique stages
  const stagesSet = new Set(index.sets.map(s => s.stage));

  // Latest year in data
  const latestYear = Math.max(...index.years);

  container.innerHTML = `
    <div class="hero-welcome">
      <h1>Welcome to TrackTrackr</h1>
      <p class="hero-subtitle">Your festival intelligence bestie</p>
    </div>

    <div class="stat-bar">
      <div class="stat-card">
        <div class="stat-number">${fmt(index.totalSets)}</div>
        <div class="stat-label">Total Sets</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${index.years.length}</div>
        <div class="stat-label">Years Covered</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${fmt(djSlugs.size)}</div>
        <div class="stat-label">Unique DJs</div>
      </div>
      <div class="stat-card" id="stat-plays">
        <div class="stat-number">&mdash;</div>
        <div class="stat-label">Track Plays</div>
      </div>
      <div class="stat-card" id="stat-unique">
        <div class="stat-number">&mdash;</div>
        <div class="stat-label">Unique Tracks</div>
      </div>
      <div class="stat-card" id="stat-scraped">
        <div class="stat-number">&mdash;</div>
        <div class="stat-label">Sets Scraped</div>
      </div>
    </div>

    <div class="filters">
      <div>
        <div class="filter-label">Year</div>
        <select class="filter-select" id="filter-year">
          <option value="">All Years</option>
          ${[...index.years].sort((a, b) => b - a).map(y => `<option value="${y}">${y}</option>`).join('')}
        </select>
      </div>
      <div>
        <div class="filter-label">Stage</div>
        <select class="filter-select" id="filter-stage">
          <option value="">All Stages</option>
          ${[...stagesSet].sort().map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
      </div>
    </div>

    <div id="loading-bar" style="display:none">
      <div class="progress-label" id="loading-label">Loading sets...</div>
      <div class="progress-bar-container"><div class="progress-bar" id="loading-progress" style="width:0%"></div></div>
    </div>

    <div class="leaderboard-columns">
      <div class="card">
        <div class="card-header">
          <div class="card-title">All-Time Most Played</div>
          <div class="text-muted" style="font-size:0.75rem" id="left-subtitle">Top 25 across all years</div>
        </div>
        <div id="leaderboard-left"></div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">Most Played &mdash; ${latestYear}</div>
        </div>
        <div id="leaderboard-right"></div>
      </div>
    </div>
  `;

  // Filters
  const yearFilter = document.getElementById('filter-year');
  const stageFilter = document.getElementById('filter-stage');

  yearFilter.addEventListener('change', () => updateLeftLeaderboard());
  stageFilter.addEventListener('change', () => updateLeftLeaderboard());

  // Load all sets if not already
  if (!isAllLoaded()) {
    const loadingBar = document.getElementById('loading-bar');
    const loadingLabel = document.getElementById('loading-label');
    const loadingProgress = document.getElementById('loading-progress');
    loadingBar.style.display = 'block';

    await loadAllSets(null, (loaded, total) => {
      const pct = Math.round((loaded / total) * 100);
      loadingLabel.textContent = `Loading ${loaded} of ${total} sets... ${pct}%`;
      loadingProgress.style.width = `${pct}%`;
    });

    loadingBar.style.display = 'none';
  }

  // Update stat numbers that depend on loaded data
  updateStats();

  // Render both leaderboards
  updateLeftLeaderboard();
  renderLeaderboard('leaderboard-right', getTopTracks(15, { year: latestYear }));

  // ── helpers ──

  function updateStats() {
    const top = getTopTracks(99999);
    const totalPlays = top.reduce((s, t) => s + t.playCount, 0);
    const uniqueCount = top.length;

    document.querySelector('#stat-plays .stat-number').textContent = fmt(totalPlays);
    document.querySelector('#stat-unique .stat-number').textContent = fmt(uniqueCount);
    document.querySelector('#stat-scraped .stat-number').textContent = fmt(index.scrapedSets);
  }

  function updateLeftLeaderboard() {
    const year = yearFilter.value ? parseInt(yearFilter.value) : null;
    const stage = stageFilter.value || null;
    const filters = {};
    if (year) filters.year = year;
    if (stage) filters.stage = stage;

    const tracks = getTopTracks(25, filters);
    renderLeaderboard('leaderboard-left', tracks);

    // Update subtitle
    const subtitle = document.getElementById('left-subtitle');
    const parts = [];
    if (year) parts.push(year);
    if (stage) parts.push(stage);
    subtitle.textContent = parts.length ? `Top 25 — ${parts.join(', ')}` : 'Top 25 across all years';
  }

  function renderLeaderboard(containerId, tracks) {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (tracks.length === 0) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-text">No tracks found</div></div>`;
      return;
    }

    const maxPlayCount = tracks[0].playCount;

    el.innerHTML = tracks.map((t, i) => {
      const rank = i + 1;
      const top3class = rank <= 3 ? 'top3' : '';
      const pct = (t.playCount / maxPlayCount) * 100;
      const encodedKey = encodeURIComponent(t.key);

      return `
        <div class="leaderboard-row" data-href="#/track/${encodedKey}">
          <div class="leaderboard-rank ${top3class}">${rank}</div>
          <div class="leaderboard-info">
            <div class="leaderboard-name">${t.artist} &mdash; ${t.title}</div>
            <div class="leaderboard-meta">
              <span>${t.years.length} year${t.years.length !== 1 ? 's' : ''}</span>
              <span class="sep">&middot;</span>
              <span>${t.djs.length} DJ${t.djs.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="leaderboard-bar">
              <div class="leaderboard-bar-fill" style="width:${pct}%"></div>
            </div>
          </div>
          <div>
            <div class="leaderboard-count">${t.playCount}</div>
            <div class="leaderboard-count-label">plays</div>
          </div>
        </div>`;
    }).join('');

    // Click handlers — navigate to track detail
    el.querySelectorAll('.leaderboard-row').forEach(row => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        location.hash = row.dataset.href;
      });
    });
  }
}
