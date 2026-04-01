/**
 * year.js — Year Browser view
 * Route: #/year or #/year/{year}
 */

import { getYearStats, loadAllSets, isAllLoaded, getTopTracks } from '../data.js?v=5';
import { CONFIG, getStageColor } from '../config.js?v=5';
import { fmt, stageBadge, navigateTo } from '../app.js?v=5';

let charts = [];
let selectedYear = null;

export function destroy() {
  charts.forEach(c => c.destroy());
  charts = [];
  selectedYear = null;
}

export async function render(container, index, params) {
  selectedYear = params[0] ? parseInt(params[0]) : Math.max(...index.years);

  container.innerHTML = `
    <div class="year-pills" id="year-pill-row" style="overflow-x:auto;white-space:nowrap;padding-bottom:8px;margin-bottom:20px;">
      ${index.years.map(y =>
        `<button class="year-pill${y === selectedYear ? ' active' : ''}" data-year="${y}">${y}</button>`
      ).join('')}
    </div>

    <div id="year-content"></div>
  `;

  // Scroll active pill into view
  const activePill = container.querySelector('.year-pill.active');
  if (activePill) {
    activePill.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' });
  }

  // Year pill click handlers
  container.querySelectorAll('.year-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedYear = parseInt(btn.dataset.year);
      container.querySelectorAll('.year-pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      renderContent();
    });
  });

  // Initial render of content below pills
  renderContent();

  /* ── Render everything below the year pills ──────── */
  function renderContent() {
    const content = document.getElementById('year-content');
    if (!content) return;

    // Destroy previous charts
    charts.forEach(c => c.destroy());
    charts = [];

    const stats = getYearStats(selectedYear);
    if (!stats) {
      content.innerHTML = '<div class="empty-state"><div class="empty-state-text">No data for this year.</div></div>';
      return;
    }

    const tracksIDd = stats.sets.reduce((sum, s) => sum + (s.tracksIdentified || 0), 0);

    content.innerHTML = `
      <div class="stat-bar" id="year-stats">
        <div class="stat-card">
          <div class="stat-number">${fmt(stats.setCount)}</div>
          <div class="stat-label">Sets</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${fmt(stats.uniqueDJs)}</div>
          <div class="stat-label">DJs</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${fmt(stats.stageCount)}</div>
          <div class="stat-label">Stages</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${fmt(tracksIDd)}</div>
          <div class="stat-label">Tracks ID'd</div>
        </div>
      </div>

      <div id="top-tracks-section"></div>
      <div id="stages-accordion-section"></div>
      <div id="dj-highlights-section"></div>

      <div class="section-title" id="sets-heading">Sets \u2014 ${selectedYear}</div>
      <div class="set-grid" id="set-grid"></div>
    `;

    // Render sections that work from index data immediately
    renderStagesAccordion(stats);
    renderDJHighlights(stats);
    renderSetGrid(stats.sets);

    // Top tracks need loadAllSets
    renderTopTracksSection(stats);
  }

  /* ── Top 10 Tracks (leaderboard) ─────────────────── */
  async function renderTopTracksSection(stats) {
    const section = document.getElementById('top-tracks-section');
    if (!section) return;

    if (!isAllLoaded()) {
      section.innerHTML = `
        <div class="card" style="margin-bottom:24px;">
          <div class="card-header">
            <div class="card-title">Top 10 Tracks</div>
          </div>
          <div style="padding:16px;">
            <div class="progress-label" id="year-loading-label">Loading sets...</div>
            <div class="progress-bar-container"><div class="progress-bar" id="year-loading-progress" style="width:0%"></div></div>
          </div>
        </div>
      `;

      await loadAllSets(null, (loaded, total) => {
        const label = document.getElementById('year-loading-label');
        const bar = document.getElementById('year-loading-progress');
        if (label) label.textContent = `Loading ${loaded} of ${total} sets... ${Math.round((loaded / total) * 100)}%`;
        if (bar) bar.style.width = `${Math.round((loaded / total) * 100)}%`;
      });
    }

    // Re-fetch stats now that track index is built
    const freshStats = getYearStats(selectedYear);
    const topTracks = freshStats ? freshStats.topTracks : [];

    if (!topTracks || topTracks.length === 0) {
      section.innerHTML = '';
      return;
    }

    section.innerHTML = `
      <div class="card" style="margin-bottom:24px;">
        <div class="card-header">
          <div class="card-title">Top 10 Tracks</div>
        </div>
        <div class="leaderboard">
          ${topTracks.map((t, i) => {
            const rank = i + 1;
            const top3Class = rank <= 3 ? 'top3' : '';
            const key = encodeURIComponent(t.key);
            return `
              <div class="leaderboard-row" data-href="#/track/${key}">
                <div class="leaderboard-rank ${top3Class}">${rank}</div>
                <div class="leaderboard-info">
                  <div class="leaderboard-name">${t.artist} \u2014 ${t.title}</div>
                  <div class="leaderboard-meta">
                    <span>${t.djs.length} DJs played this</span>
                  </div>
                </div>
                <div>
                  <div class="leaderboard-count">${t.playCount}</div>
                  <div class="leaderboard-count-label">plays</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Click handlers for leaderboard rows
    section.querySelectorAll('.leaderboard-row').forEach(row => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        const href = row.dataset.href;
        if (href) navigateTo(href);
      });
    });
  }

  /* ── Stages Accordion ────────────────────────────── */
  function renderStagesAccordion(stats) {
    const section = document.getElementById('stages-accordion-section');
    if (!section) return;

    const stageNames = Object.keys(stats.stages).sort((a, b) => stats.stages[b] - stats.stages[a]);
    if (stageNames.length === 0) {
      section.innerHTML = '';
      return;
    }

    // Group sets by stage
    const setsByStage = {};
    for (const s of stats.sets) {
      if (!setsByStage[s.stage]) setsByStage[s.stage] = [];
      setsByStage[s.stage].push(s);
    }

    section.innerHTML = `
      <div class="card" style="margin-bottom:24px;">
        <div class="card-header">
          <div class="card-title">Stages This Year</div>
        </div>
        <div style="padding:0;">
          ${stageNames.map(stageName => {
            const color = getStageColor(stageName);
            const setCount = stats.stages[stageName];
            const stageSets = (setsByStage[stageName] || []).sort((a, b) => a.date.localeCompare(b.date));

            const bodyHtml = stageSets.map(s => {
              const djLinks = s.djs.map(d =>
                `<a href="#/dj/${d.slug}" class="dj-link" onclick="event.stopPropagation()">${d.name}</a>`
              ).join(' & ');
              const tracksId = s.tracksIdentified || 0;
              return `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);">
                  <div>
                    <div style="font-size:0.875rem;">${djLinks}</div>
                    <div style="font-size:0.75rem;color:var(--muted);">${s.date}</div>
                  </div>
                  <span style="font-size:0.75rem;color:var(--muted-lt);white-space:nowrap;">${tracksId} tracks ID'd</span>
                </div>
              `;
            }).join('');

            return `
              <div class="accordion-item">
                <div class="accordion-header">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span class="dot" style="background:${color};width:8px;height:8px;border-radius:50%;display:inline-block"></span>
                    <span style="font-weight:600">${stageName}</span>
                    <span class="text-muted" style="font-size:0.75rem">${setCount} sets</span>
                  </div>
                  <span class="arrow">\u25B6</span>
                </div>
                <div class="accordion-body">
                  <div class="accordion-body-inner">
                    ${bodyHtml}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Accordion toggle handlers
    section.querySelectorAll('.accordion-header').forEach(header => {
      header.addEventListener('click', () => {
        const item = header.closest('.accordion-item');
        if (item) item.classList.toggle('open');
      });
    });
  }

  /* ── DJ Highlights ───────────────────────────────── */
  function renderDJHighlights(stats) {
    const section = document.getElementById('dj-highlights-section');
    if (!section) return;

    // Build DJ stats from the sets for this year
    const djMap = new Map(); // slug -> { name, slug, sets, tracksIdentified }
    for (const s of stats.sets) {
      for (const d of s.djs) {
        if (!djMap.has(d.slug)) {
          djMap.set(d.slug, { name: d.name, slug: d.slug, sets: 0, tracksIdentified: 0 });
        }
        const entry = djMap.get(d.slug);
        entry.sets++;
        entry.tracksIdentified += (s.tracksIdentified || 0);
      }
    }

    const allDJs = [...djMap.values()];

    // Most Tracks ID'd — top 5
    const topByTracks = [...allDJs]
      .sort((a, b) => b.tracksIdentified - a.tracksIdentified)
      .slice(0, 5);

    // Most Sets — DJs with 2+ sets
    const topBySets = [...allDJs]
      .filter(d => d.sets >= 2)
      .sort((a, b) => b.sets - a.sets);

    if (topByTracks.length === 0 && topBySets.length === 0) {
      section.innerHTML = '';
      return;
    }

    const tracksTable = topByTracks.length > 0 ? `
      <div class="card" style="flex:1;min-width:0;">
        <div class="card-header">
          <div class="card-title">Most Tracks ID'd</div>
        </div>
        <table class="data-table">
          <thead><tr><th>#</th><th>DJ</th><th>Tracks</th></tr></thead>
          <tbody>
            ${topByTracks.map((d, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><a href="#/dj/${d.slug}" class="dj-link">${d.name}</a></td>
                <td>${fmt(d.tracksIdentified)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '';

    const setsTable = topBySets.length > 0 ? `
      <div class="card" style="flex:1;min-width:0;">
        <div class="card-header">
          <div class="card-title">Most Sets</div>
        </div>
        <table class="data-table">
          <thead><tr><th>#</th><th>DJ</th><th>Sets</th></tr></thead>
          <tbody>
            ${topBySets.map((d, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><a href="#/dj/${d.slug}" class="dj-link">${d.name}</a></td>
                <td>${d.sets}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '';

    section.innerHTML = `
      <div style="display:flex;gap:20px;margin-bottom:24px;flex-wrap:wrap;">
        ${tracksTable}
        ${setsTable}
      </div>
    `;
  }

  /* ── All Sets Grid ───────────────────────────────── */
  function renderSetGrid(sets) {
    const grid = document.getElementById('set-grid');
    if (!grid) return;

    const sorted = [...sets].sort((a, b) => a.date.localeCompare(b.date));

    grid.innerHTML = sorted.map(s => {
      const djNames = s.djs.map(d =>
        `<a href="#/dj/${d.slug}" class="dj-link" onclick="event.stopPropagation()">${d.name}</a>`
      ).join(' & ');

      const tracksId = s.tracksIdentified || 0;

      return `
        <div class="set-card" data-tlid="${s.tlId}" onclick="location.hash='#/set/${s.tlId}'">
          <div class="set-card-dj">${djNames}</div>
          <div style="margin-bottom:6px">${stageBadge(s.stage)}</div>
          <div class="set-card-meta">
            <span>${s.date}</span>
            <span>${tracksId} tracks ID'd</span>
          </div>
        </div>
      `;
    }).join('');
  }
}
