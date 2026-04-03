/**
 * year.js — Sets Browser view (by year)
 * Route: #/year or #/year/{year}
 */

import { getYearStats, loadSet } from '../data.js?v=5';
import { CONFIG, getStageColor } from '../config.js?v=5';
import { fmt, stageBadge } from '../app.js?v=5';

let selectedYear = null;
let activeStage = 'all';
let sortOrder = 'date-asc'; // date-asc, date-desc

export function destroy() {
  selectedYear = null;
  activeStage = 'all';
  sortOrder = 'date-asc';
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
      activeStage = 'all';
      sortOrder = 'date-asc';
      container.querySelectorAll('.year-pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      renderContent();
    });
  });

  // Initial render
  renderContent();

  async function renderContent() {
    const content = document.getElementById('year-content');
    if (!content) return;

    const stats = getYearStats(selectedYear);
    if (!stats) {
      content.innerHTML = '<div class="empty-state"><div class="empty-state-text">No data for this year.</div></div>';
      return;
    }

    // Get unique stages for filter chips
    const stages = [...new Set(stats.sets.map(s => s.stage))].sort();

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
      </div>

      <div class="sets-filters" id="sets-filters">
        <div class="sets-filter-row">
          <button class="filter-chip${activeStage === 'all' ? ' active' : ''}" data-filter-stage="all">All stages</button>
          ${stages.map(st => {
            const color = getStageColor(st);
            return `<button class="filter-chip${activeStage === st ? ' active' : ''}" data-filter-stage="${st}" style="--chip-color:${color};">${st}</button>`;
          }).join('')}
        </div>
        <div class="sets-filter-row">
          <button class="filter-chip${sortOrder === 'date-asc' ? ' active' : ''}" data-sort="date-asc">Date ↑</button>
          <button class="filter-chip${sortOrder === 'date-desc' ? ' active' : ''}" data-sort="date-desc">Date ↓</button>
        </div>
      </div>

      <div class="set-grid" id="set-grid"></div>
    `;

    // Filter chip handlers
    content.querySelectorAll('[data-filter-stage]').forEach(chip => {
      chip.addEventListener('click', () => {
        activeStage = chip.dataset.filterStage;
        content.querySelectorAll('[data-filter-stage]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        renderSetGrid(stats.sets);
      });
    });

    // Sort handlers
    content.querySelectorAll('[data-sort]').forEach(chip => {
      chip.addEventListener('click', () => {
        sortOrder = chip.dataset.sort;
        content.querySelectorAll('[data-sort]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        renderSetGrid(stats.sets);
      });
    });

    renderSetGrid(stats.sets);

    // Progressively load set details for recordings + tracks
    enrichSetCards(stats.sets);
  }

  function renderSetGrid(sets) {
    const grid = document.getElementById('set-grid');
    if (!grid) return;

    let filtered = activeStage === 'all' ? [...sets] : sets.filter(s => s.stage === activeStage);

    filtered.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      return sortOrder === 'date-desc' ? -cmp : cmp;
    });

    grid.innerHTML = filtered.map(s => {
      const djNames = s.djs.map(d =>
        `<a href="#/dj/${d.slug}" class="dj-link" onclick="event.stopPropagation()">${d.name}</a>`
      ).join(' & ');

      const stageColor = getStageColor(s.stage);

      return `
        <div class="set-card" data-tlid="${s.tlId}" onclick="location.hash='#/set/${s.tlId}'" style="border-left:3px solid ${stageColor};">
          <div class="set-card-dj">${djNames}</div>
          <div class="set-card-meta" style="margin-bottom:8px;">
            ${stageBadge(s.stage)}
            <span class="separator">&middot;</span>
            <span>${formatDateShort(s.date)}</span>
            ${s.duration ? `<span class="separator">&middot;</span><span>${s.duration}</span>` : ''}
          </div>
          <div class="set-card-enrich" id="enrich-${s.tlId}">
            <div style="font-size:0.75rem;color:var(--muted);">Loading...</div>
          </div>
        </div>
      `;
    }).join('');
  }

  async function enrichSetCards(sets) {
    const setsWithFiles = sets.filter(s => s.hasSetFile);
    const BATCH = 15;

    for (let i = 0; i < setsWithFiles.length; i += BATCH) {
      const batch = setsWithFiles.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(s => loadSet(s.tlId)));

      for (const setData of results) {
        if (!setData) continue;
        const el = document.getElementById(`enrich-${setData.tlId}`);
        if (!el) continue;
        el.innerHTML = buildEnrichHtml(setData);
      }
    }

    // Clear "Loading..." for sets without files
    for (const s of sets) {
      if (s.hasSetFile) continue;
      const el = document.getElementById(`enrich-${s.tlId}`);
      if (el) el.innerHTML = '';
    }
  }

  function buildEnrichHtml(setData) {
    let html = '';

    // Recording play buttons
    const recordings = setData.recordings || [];
    const ytRec = recordings.find(r => r.platform === 'youtube');
    const scRec = recordings.find(r => r.platform === 'soundcloud');
    const spRec = recordings.find(r => r.platform === 'source_36');

    if (ytRec || scRec || spRec) {
      let btns = '';
      if (ytRec) {
        const ytId = ytRec.url.includes('youtube.com/watch')
          ? new URL(ytRec.url).searchParams.get('v')
          : ytRec.url.split('/').pop();
        btns += `<a href="https://www.youtube.com/watch?v=${ytId}" target="_blank" rel="noopener" class="rec-btn rec-btn-yt" onclick="event.stopPropagation();" title="Watch on YouTube">&#9654; YouTube</a>`;
      }
      if (spRec) {
        btns += `<a href="${spRec.url.replace('/embed/', '/').replace('?utm_source=generator', '')}" target="_blank" rel="noopener" class="rec-btn rec-btn-sp" onclick="event.stopPropagation();" title="Listen on Spotify">&#9835; Spotify</a>`;
      }
      if (scRec) {
        btns += `<a href="${scRec.url}" target="_blank" rel="noopener" class="rec-btn rec-btn-sc" onclick="event.stopPropagation();" title="Listen on SoundCloud">&#9654; SoundCloud</a>`;
      }
      html += `<div class="set-card-play-row">${btns}</div>`;
    }

    // First 1-2 identified tracks
    const tracks = (setData.tracks || []).filter(t =>
      (t.type === 'normal' || t.type === 'blend') && !isIDTrack(t.artist, t.title)
    );
    if (tracks.length > 0) {
      const preview = tracks.slice(0, 2);
      html += `<div class="set-card-track-preview">`;
      html += preview.map((t, i) =>
        `<div class="set-card-track-line">${t.artist} &mdash; ${t.title}${t.remix ? ' (' + t.remix + ')' : ''}</div>`
      ).join('');
      if (tracks.length > 2) {
        html += `<div class="set-card-track-more">+ ${tracks.length - 2} more tracks</div>`;
      }
      html += `</div>`;
    }

    return html;
  }
}

function isIDTrack(artist, title) {
  const a = (artist || '').toLowerCase().trim();
  const t = (title || '').toLowerCase().trim();
  return a === 'id' || t === 'id' || a === '' || t === '' ||
    t.startsWith('id (') || t === 'id?' || a === 'id?';
}

function formatDateShort(dateStr) {
  if (!dateStr) return '\u2014';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}
