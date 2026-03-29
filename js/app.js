/**
 * app.js — TrackTrackr router, navigation, and global state
 */

import { CONFIG, initChartDefaults } from './config.js?v=2';
import { loadIndex, getTopTracks, isAllLoaded, trackKey } from './data.js?v=2';

// ── Global state ───────────────────────────────────
export const state = {
  index: null,
  currentView: null,
  currentParams: [],
};

// ── View imports (lazy, cache-bust with version) ───
const V = '?v=2';
const views = {
  overview:    () => import('./views/overview.js' + V),
  discoveries: () => import('./views/discoveries.js' + V),
  djs:         () => import('./views/heatmap.js' + V),
  heatmap:     () => import('./views/heatmap.js' + V),
  dj:          () => import('./views/dj.js' + V),
  track:       () => import('./views/track.js' + V),
  year:        () => import('./views/year.js' + V),
  stages:      () => import('./views/stages.js' + V),
  labels:      () => import('./views/labels.js' + V),
  b2b:         () => import('./views/b2b.js' + V),
};

// ── DOM refs ───────────────────────────────────────
const viewContainer = () => document.getElementById('view-container');
const breadcrumbs   = () => document.getElementById('breadcrumbs');
const searchInput   = () => document.getElementById('global-search');
const searchResults = () => document.getElementById('search-results');

// ── Skeleton loader ────────────────────────────────
function showSkeleton() {
  const el = viewContainer();
  if (!el) return;
  el.innerHTML = `
    <div class="stat-bar" style="margin-top:8px">
      ${Array(6).fill('<div class="skeleton skeleton-stat"></div>').join('')}
    </div>
    <div class="skeleton skeleton-heading"></div>
    <div class="skeleton skeleton-chart"></div>
  `;
}

// ── Router ─────────────────────────────────────────
function parseHash() {
  const hash = location.hash.replace(/^#\/?/, '');
  if (!hash) return { view: 'overview', params: [] };
  const parts = hash.split('/');
  const view = parts[0] || 'overview';
  const params = parts.slice(1).map(p => decodeURIComponent(p));
  return { view, params };
}

let currentModule = null;

async function route() {
  const { view, params } = parseHash();

  // Same view + same params? Skip
  if (view === state.currentView && JSON.stringify(params) === JSON.stringify(state.currentParams)) {
    return;
  }

  state.currentView = view;
  state.currentParams = params;

  // Update nav
  updateNav(view);
  updateBreadcrumbs(view, params);

  // Close search
  const sr = searchResults();
  if (sr) sr.classList.add('hidden');

  // Load view
  const loader = views[view] || views.overview;
  showSkeleton();

  try {
    // Cleanup previous view
    if (currentModule && currentModule.destroy) {
      currentModule.destroy();
    }

    const mod = await loader();
    currentModule = mod;
    await mod.render(viewContainer(), state.index, params);
  } catch (err) {
    console.error(`Failed to load view "${view}":`, err);
    viewContainer().innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠</div>
        <div class="empty-state-text">Failed to load view. ${err.message}</div>
      </div>
    `;
  }
}

// ── Nav highlighting ───────────────────────────────
function updateNav(view) {
  // Sidebar
  document.querySelectorAll('.nav-link').forEach(link => {
    const linkView = link.dataset.view;
    link.classList.toggle('active', linkView === view ||
      (view === '' && linkView === 'overview'));
  });
  // Mobile tabs
  document.querySelectorAll('.tab-link').forEach(link => {
    const linkView = link.dataset.view;
    link.classList.toggle('active', linkView === view ||
      (view === '' && linkView === 'overview'));
  });
}

// ── Breadcrumbs ────────────────────────────────────
function updateBreadcrumbs(view, params) {
  const el = breadcrumbs();
  if (!el) return;

  const crumbs = [{ label: 'Overview', href: '#/' }];
  const viewLabels = {
    discoveries: 'Discoveries',
    djs: 'DJs',
    heatmap: 'DJs',
    dj: 'DJs',
    track: 'Tracks',
    year: 'Years',
    stages: 'Stages',
    labels: 'Labels',
    b2b: 'B2B',
  };

  if (view && view !== 'overview') {
    crumbs.push({ label: viewLabels[view] || view, href: `#/${view}` });
  }

  // Add param-based crumbs
  if (view === 'dj' && params[0] && state.index) {
    const slug = params[0];
    const set = state.index.sets.find(s => s.djs.some(d => d.slug === slug));
    const name = set ? set.djs.find(d => d.slug === slug)?.name || slug : slug;
    crumbs.push({ label: name });
  } else if (view === 'track' && params[0]) {
    const parts = decodeURIComponent(params[0]).split('|||');
    if (parts.length === 2) {
      crumbs.push({ label: `${parts[0]} — ${parts[1]}` });
    }
  } else if (view === 'year' && params[0]) {
    crumbs.push({ label: params[0] });
  }

  el.innerHTML = crumbs.map((c, i) => {
    if (i === crumbs.length - 1) {
      return `<span class="text-muted-lt">${c.label}</span>`;
    }
    return `<a href="${c.href}">${c.label}</a><span class="separator">›</span>`;
  }).join('');
}

// ── Global Search ──────────────────────────────────
let searchTimeout = null;

function initSearch() {
  const input = searchInput();
  const results = searchResults();
  if (!input || !results) return;

  input.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => performSearch(input.value.trim()), 150);
  });

  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 2) {
      results.classList.remove('hidden');
    }
  });

  // Close on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#search-container')) {
      results.classList.add('hidden');
    }
  });

  // Keyboard navigation
  input.addEventListener('keydown', (e) => {
    const items = results.querySelectorAll('.search-item');
    const focused = results.querySelector('.search-item.focused');
    let idx = [...items].indexOf(focused);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      idx = Math.min(idx + 1, items.length - 1);
      items.forEach(i => i.classList.remove('focused'));
      items[idx]?.classList.add('focused');
      items[idx]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      idx = Math.max(idx - 1, 0);
      items.forEach(i => i.classList.remove('focused'));
      items[idx]?.classList.add('focused');
      items[idx]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && focused) {
      e.preventDefault();
      focused.click();
    } else if (e.key === 'Escape') {
      results.classList.add('hidden');
      input.blur();
    }
  });
}

function performSearch(query) {
  const results = searchResults();
  if (!results || !state.index) return;

  if (query.length < 2) {
    results.classList.add('hidden');
    return;
  }

  const q = query.toLowerCase();

  // Search DJs
  const djMap = new Map();
  for (const set of state.index.sets) {
    for (const dj of set.djs) {
      if (dj.name.toLowerCase().includes(q) && !djMap.has(dj.slug)) {
        djMap.set(dj.slug, dj.name);
      }
    }
  }
  const djResults = [...djMap.entries()].slice(0, 8);

  // Search tracks (if we have track data loaded)
  let trackResults = [];
  if (isAllLoaded()) {
    const allTracks = getTopTracks(5000);
    trackResults = allTracks
      .filter(t => `${t.artist} ${t.title}`.toLowerCase().includes(q))
      .slice(0, 8);
  }

  let html = '';

  if (djResults.length) {
    html += `<div class="search-group-title">DJs (${djResults.length})</div>`;
    for (const [slug, name] of djResults) {
      html += `
        <div class="search-item" data-href="#/dj/${slug}">
          <div>
            <div class="search-item-name">${highlightMatch(name, query)}</div>
          </div>
        </div>`;
    }
  }

  if (trackResults.length) {
    html += `<div class="search-group-title">Tracks (${trackResults.length})</div>`;
    for (const t of trackResults) {
      const key = encodeURIComponent(t.key);
      html += `
        <div class="search-item" data-href="#/track/${key}">
          <div>
            <div class="search-item-name">${highlightMatch(t.artist, query)} — ${highlightMatch(t.title, query)}</div>
            <div class="search-item-sub">${t.playCount} plays · ${t.years.length} years</div>
          </div>
        </div>`;
    }
  }

  if (!html) {
    html = `<div style="padding:16px;text-align:center;color:var(--muted);font-size:0.875rem;">No results found</div>`;
  }

  results.innerHTML = html;
  results.classList.remove('hidden');

  // Click handlers
  results.querySelectorAll('.search-item').forEach(item => {
    item.addEventListener('click', () => {
      location.hash = item.dataset.href;
      results.classList.add('hidden');
      searchInput().value = '';
    });
  });
}

function highlightMatch(text, query) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return text.slice(0, idx) +
    `<strong style="color:var(--purple-lt)">${text.slice(idx, idx + query.length)}</strong>` +
    text.slice(idx + query.length);
}

// ── Helper: navigate programmatically ──────────────
export function navigateTo(hash) {
  location.hash = hash;
}

// ── Helper: create stage badge HTML ────────────────
export function stageBadge(stage) {
  const color = CONFIG.stageColors[stage] || '#64748b';
  return `<span class="stage-badge"><span class="dot" style="background:${color}"></span>${stage}</span>`;
}

// ── Helper: format number with commas ──────────────
export function fmt(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString();
}

// ── Init ───────────────────────────────────────────
async function init() {
  initChartDefaults();

  // Load index
  state.index = await loadIndex();
  console.log(`TrackTrackr loaded: ${state.index.totalSets} sets, ${state.index.years.length} years`);

  // Init search
  initSearch();

  // Route
  window.addEventListener('hashchange', route);
  route();
}

init();
