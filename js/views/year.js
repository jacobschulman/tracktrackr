/**
 * year.js — Sets Browser view (by year)
 * Route: #/year or #/year/{year}
 */

import { getYearStats, loadSet } from '../data.js?v=5';
import { CONFIG, getStageColor } from '../config.js?v=5';
import { fmt, stageBadge, playInBar } from '../app.js?v=5';

let selectedYear = null;
let activeStage = 'all';
let sortOrder = 'date-asc';
let filterYT = false;
let filterSC = false;
const recMap = new Map();     // tlId -> { youtube, soundcloud }
const enrichCache = new Map(); // tlId -> enriched HTML string

export function destroy() {
  selectedYear = null;
  activeStage = 'all';
  sortOrder = 'date-asc';
  filterYT = false;
  filterSC = false;
  recMap.clear();
  enrichCache.clear();
}

export async function render(container, index, params) {
  selectedYear = params[0] ? parseInt(params[0]) : Math.max(...index.years);

  container.innerHTML = `
    <div class="sets-toolbar" id="sets-toolbar">
      <select id="year-select" class="sets-select">
        ${index.years.map(y =>
          `<option value="${y}"${y === selectedYear ? ' selected' : ''}>${y}</option>`
        ).join('')}
      </select>
      <select id="stage-select" class="sets-select">
        <option value="all">All stages</option>
      </select>
      <select id="sort-select" class="sets-select">
        <option value="date-asc">Date ↑</option>
        <option value="date-desc">Date ↓</option>
      </select>
      <label class="sets-checkbox" id="filter-yt-label">
        <input type="checkbox" id="filter-yt"> YouTube
      </label>
      <label class="sets-checkbox" id="filter-sc-label">
        <input type="checkbox" id="filter-sc"> SoundCloud
      </label>
    </div>

    <div class="stat-bar" id="year-stats"></div>
    <div class="set-grid" id="set-grid"></div>
  `;

  document.getElementById('year-select').addEventListener('change', (e) => {
    selectedYear = parseInt(e.target.value);
    activeStage = 'all';
    sortOrder = 'date-asc';
    filterYT = false;
    filterSC = false;
    recMap.clear();
    enrichCache.clear();
    document.getElementById('sort-select').value = 'date-asc';
    document.getElementById('filter-yt').checked = false;
    document.getElementById('filter-sc').checked = false;
    renderContent();
  });

  document.getElementById('stage-select').addEventListener('change', (e) => {
    activeStage = e.target.value;
    renderSetGrid(currentSets);
  });

  document.getElementById('sort-select').addEventListener('change', (e) => {
    sortOrder = e.target.value;
    renderSetGrid(currentSets);
  });

  document.getElementById('filter-yt').addEventListener('change', (e) => {
    filterYT = e.target.checked;
    renderSetGrid(currentSets);
  });
  document.getElementById('filter-sc').addEventListener('change', (e) => {
    filterSC = e.target.checked;
    renderSetGrid(currentSets);
  });

  let currentSets = [];

  renderContent();

  async function renderContent() {
    const stats = getYearStats(selectedYear);
    if (!stats) {
      document.getElementById('year-stats').innerHTML = '';
      document.getElementById('set-grid').innerHTML = '<div class="empty-state"><div class="empty-state-text">No data for this year.</div></div>';
      return;
    }

    currentSets = stats.sets;

    const stages = [...new Set(stats.sets.map(s => s.stage))].sort();
    const stageSelect = document.getElementById('stage-select');
    stageSelect.innerHTML = `<option value="all">All stages</option>` +
      stages.map(st => `<option value="${st}"${activeStage === st ? ' selected' : ''}>${st}</option>`).join('');

    document.getElementById('year-stats').innerHTML = `
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
    `;

    renderSetGrid(currentSets);
    await enrichSetCards(currentSets);
  }

  function renderSetGrid(sets) {
    const grid = document.getElementById('set-grid');
    if (!grid) return;

    let filtered = activeStage === 'all' ? [...sets] : sets.filter(s => s.stage === activeStage);

    if (filterYT) filtered = filtered.filter(s => recMap.get(s.tlId)?.youtube);
    if (filterSC) filtered = filtered.filter(s => recMap.get(s.tlId)?.soundcloud);

    filtered.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      return sortOrder === 'date-desc' ? -cmp : cmp;
    });

    if ((filterYT || filterSC) && filtered.length === 0 && recMap.size === 0) {
      grid.innerHTML = '<div class="empty-state"><div class="empty-state-text">Loading recordings...</div></div>';
      return;
    }

    grid.innerHTML = filtered.map(s => {
      const djNames = s.djs.map(d =>
        `<a href="#/dj/${d.slug}" class="dj-link" onclick="event.stopPropagation()">${d.name}</a>`
      ).join(' & ');
      const stageColor = getStageColor(s.stage);
      const cached = enrichCache.get(s.tlId);
      const enrichHtml = cached !== undefined
        ? cached
        : (s.hasSetFile ? '<div style="font-size:0.75rem;color:var(--muted);">Loading...</div>' : '');

      return `
        <div class="set-card" data-tlid="${s.tlId}" onclick="location.hash='#/set/${s.tlId}'" style="border-left:3px solid ${stageColor};">
          <div class="set-card-dj">${djNames}</div>
          <div class="set-card-meta" style="margin-bottom:8px;">
            ${stageBadge(s.stage)}
            <span class="separator">&middot;</span>
            <span>${formatDateShort(s.date)}</span>
            ${s.duration ? `<span class="separator">&middot;</span><span>${s.duration}</span>` : ''}
          </div>
          <div class="set-card-enrich" id="enrich-${s.tlId}">${enrichHtml}</div>
        </div>
      `;
    }).join('');

    // Wire up play buttons (for cached cards that already have them)
    wirePlayButtons(grid);
  }

  async function enrichSetCards(sets) {
    const setsWithFiles = sets.filter(s => s.hasSetFile);
    const BATCH = 15;

    for (let i = 0; i < setsWithFiles.length; i += BATCH) {
      const batch = setsWithFiles.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(s => loadSet(s.tlId)));

      for (const setData of results) {
        if (!setData) continue;

        const recordings = setData.recordings || [];
        recMap.set(setData.tlId, {
          youtube: recordings.some(r => r.platform === 'youtube'),
          soundcloud: recordings.some(r => r.platform === 'soundcloud'),
        });

        const html = buildEnrichHtml(setData);
        enrichCache.set(setData.tlId, html);

        const el = document.getElementById(`enrich-${setData.tlId}`);
        if (!el) continue;
        el.innerHTML = html;
        wirePlayButtons(el);
      }
    }

    // Clear "Loading..." for sets without files
    for (const s of sets) {
      if (s.hasSetFile) continue;
      enrichCache.set(s.tlId, '');
      const el = document.getElementById(`enrich-${s.tlId}`);
      if (el) el.innerHTML = '';
    }
  }

  function wirePlayButtons(root) {
    root.querySelectorAll('[data-platform]').forEach(btn => {
      if (btn._wired) return;
      btn._wired = true;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        playInBar(btn.dataset.platform, btn.dataset.url, btn.dataset.title, btn.dataset.tlid);
      });
    });
  }

  function buildEnrichHtml(setData) {
    let html = '';

    const recordings = setData.recordings || [];
    const ytRec = recordings.find(r => r.platform === 'youtube');
    const scRec = recordings.find(r => r.platform === 'soundcloud');
    const spRec = recordings.find(r => r.platform === 'source_36');

    if (ytRec || scRec || spRec) {
      let btns = '';
      const setTitle = `${setData.dj || 'DJ'} @ ${setData.stage} · Ultra Miami · ${setData.year}`;
      const tlAttr = `data-tlid="${setData.tlId}"`;
      if (ytRec) {
        btns += `<button class="rec-btn rec-btn-yt" data-platform="youtube" data-url="${ytRec.url}" data-title="${setTitle}" ${tlAttr} onclick="event.stopPropagation();" title="Play on YouTube">&#9654; YouTube</button>`;
      }
      if (spRec) {
        btns += `<button class="rec-btn rec-btn-sp" data-platform="spotify" data-url="${spRec.url}" data-title="${setTitle}" ${tlAttr} onclick="event.stopPropagation();" title="Play on Spotify">&#9835; Spotify</button>`;
      }
      if (scRec) {
        btns += `<button class="rec-btn rec-btn-sc" data-platform="soundcloud" data-url="${scRec.url}" data-title="${setTitle}" ${tlAttr} onclick="event.stopPropagation();" title="Play on SoundCloud">&#9654; SoundCloud</button>`;
      }
      html += `<div class="set-card-play-row">${btns}</div>`;
    }

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
