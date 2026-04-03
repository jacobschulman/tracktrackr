/**
 * tracks.js — Track Explorer / Browser view
 * Route: #/tracks
 *
 * Top-level track browsing page with insight cards, filters, and leaderboard.
 * No Chart.js — pure DOM rendering.
 */

import { loadAllSets, isAllLoaded, getTopTracks, computeDiscoveries, trackKey } from '../data.js?v=6';
import { CONFIG, getStageColor } from '../config.js?v=6';
import { fmt, stageBadge, navigateTo } from '../app.js?v=6';

let _filterListeners = [];

export function destroy() {
  for (const { el, evt, fn } of _filterListeners) {
    el.removeEventListener(evt, fn);
  }
  _filterListeners = [];
}

// ── Helpers ─────────────────────────────────────────

function trackLink(artist, title, key) {
  return `<a class="track-link" href="#/track/${encodeURIComponent(key)}">${artist} &mdash; ${title}</a>`;
}

function listen(el, evt, fn) {
  el.addEventListener(evt, fn);
  _filterListeners.push({ el, evt, fn });
}

// ── Render ──────────────────────────────────────────

export async function render(container, index, params) {
  // Collect unique stages from the index for filter dropdown
  const stagesSet = new Set(index.sets.map(s => s.stage));

  container.innerHTML = `
    <h2>Tracks</h2>

    <div id="tracks-insights" style="display:none;"></div>

    <div class="filters">
      <div>
        <div class="filter-label">Year</div>
        <select class="filter-select" id="tracks-filter-year">
          <option value="">All Years</option>
          ${[...index.years].sort((a, b) => b - a).map(y => `<option value="${y}">${y}</option>`).join('')}
        </select>
      </div>
      <div>
        <div class="filter-label">Stage</div>
        <select class="filter-select" id="tracks-filter-stage">
          <option value="">All Stages</option>
          ${[...stagesSet].sort().map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
      </div>
    </div>

    <div id="tracks-loading" style="display:none;">
      <div class="progress-label" id="tracks-loading-label">Loading sets...</div>
      <div class="progress-bar-container">
        <div class="progress-bar" id="tracks-loading-bar" style="width:0%"></div>
      </div>
    </div>

    <div class="card" id="tracks-leaderboard-card" style="display:none;">
      <div class="card-header">
        <div class="card-title">Track Leaderboard</div>
        <div class="text-muted" style="font-size:0.75rem" id="tracks-subtitle">Top 25 across all years</div>
      </div>
      <div id="tracks-leaderboard"></div>
    </div>
  `;

  // ── Filter wiring ─────────────────────────────────
  const yearFilter = document.getElementById('tracks-filter-year');
  const stageFilter = document.getElementById('tracks-filter-stage');

  listen(yearFilter, 'change', () => updateLeaderboard());
  listen(stageFilter, 'change', () => updateLeaderboard());

  // ── Load all sets ─────────────────────────────────
  if (!isAllLoaded()) {
    const loadingWrap = document.getElementById('tracks-loading');
    const loadingLabel = document.getElementById('tracks-loading-label');
    const loadingBar = document.getElementById('tracks-loading-bar');
    loadingWrap.style.display = 'block';

    await loadAllSets(null, (loaded, total) => {
      const pct = Math.round((loaded / total) * 100);
      loadingLabel.textContent = `Loading ${loaded} of ${total} sets... ${pct}%`;
      loadingBar.style.width = `${pct}%`;
    });

    loadingWrap.style.display = 'none';
  }

  // ── Insight cards ─────────────────────────────────
  renderInsightCards();

  // ── Show leaderboard ──────────────────────────────
  document.getElementById('tracks-leaderboard-card').style.display = '';
  updateLeaderboard();

  // ── Internal functions ────────────────────────────

  function renderInsightCards() {
    const insightsEl = document.getElementById('tracks-insights');
    if (!insightsEl) return;

    const discoveries = computeDiscoveries();
    const immortal = discoveries.find(d => d.type === 'immortal-track');
    const anthem = discoveries.find(d => d.type === 'ultra-anthem');

    if (!immortal && !anthem) return;

    let html = '<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:16px; margin-bottom:24px;">';

    if (immortal) {
      const d = immortal.data;
      const yearSpan = `${d.years[0]}&ndash;${d.years[d.years.length - 1]}`;
      html += `
        <div class="card" style="border-left:3px solid #a855f7;">
          <div class="card-header">
            <div class="card-title">The Immortal Track</div>
            <span class="pill pill-purple">${d.yearCount} years</span>
          </div>
          <div style="padding:0 16px 16px;">
            <div style="margin-bottom:8px;">
              ${trackLink(d.artist, d.title, d.key)}
            </div>
            <div class="text-muted" style="font-size:0.8125rem;">
              Played across <span class="text-purple" style="font-weight:600;">${d.yearCount}</span> different years, spanning ${yearSpan}
            </div>
          </div>
        </div>`;
    }

    if (anthem) {
      const d = anthem.data;
      html += `
        <div class="card" style="border-left:3px solid #22c55e;">
          <div class="card-header">
            <div class="card-title">The Ultra Anthem</div>
            <span class="pill pill-green">${d.count} plays</span>
          </div>
          <div style="padding:0 16px 16px;">
            <div style="margin-bottom:8px;">
              ${trackLink(d.artist, d.title, d.key)}
            </div>
            <div class="text-muted" style="font-size:0.8125rem;">
              Played <span class="text-green" style="font-weight:600;">${d.count}</span> total times by <span class="text-green" style="font-weight:600;">${d.uniqueDJs}</span> different DJs
            </div>
          </div>
        </div>`;
    }

    html += '</div>';
    insightsEl.innerHTML = html;
    insightsEl.style.display = '';
  }

  function updateLeaderboard() {
    const year = yearFilter.value ? parseInt(yearFilter.value) : null;
    const stage = stageFilter.value || null;
    const filters = {};
    if (year) filters.year = year;
    if (stage) filters.stage = stage;

    const tracks = getTopTracks(25, filters);
    renderLeaderboard(tracks);

    // Update subtitle
    const subtitle = document.getElementById('tracks-subtitle');
    if (subtitle) {
      const parts = [];
      if (year) parts.push(year);
      if (stage) parts.push(stage);
      subtitle.textContent = parts.length ? `Top 25 — ${parts.join(', ')}` : 'Top 25 across all years';
    }
  }

  function renderLeaderboard(tracks) {
    const el = document.getElementById('tracks-leaderboard');
    if (!el) return;

    if (tracks.length === 0) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-text">No tracks found for the selected filters.</div></div>`;
      return;
    }

    const maxPlayCount = tracks[0].playCount;

    el.innerHTML = tracks.map((t, i) => {
      const rank = i + 1;
      const rankClass = rank <= 3 ? 'text-green' : 'text-purple';
      const pct = (t.playCount / maxPlayCount) * 100;
      const encodedKey = encodeURIComponent(t.key);

      return `
        <div class="leaderboard-row" data-href="#/track/${encodedKey}">
          <div class="leaderboard-rank ${rankClass}" style="font-weight:700;">${rank}</div>
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
