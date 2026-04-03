/**
 * app.js — TrackTrackr router, navigation, and global state
 */

import { CONFIG, initChartDefaults } from './config.js?v=6';
import { loadIndex, getTopTracks, isAllLoaded, trackKey } from './data.js?v=6';

// ── Global state ───────────────────────────────────
export const state = {
  index: null,
  currentView: null,
  currentParams: [],
};

// ── View imports (lazy, cache-bust with version) ───
const V = '?v=6';
const views = {
  overview:    () => import('./views/overview.js' + V),
  djs:         () => import('./views/heatmap.js' + V),
  heatmap:     () => import('./views/heatmap.js' + V),
  dj:          () => import('./views/dj.js' + V),
  tracks:      () => import('./views/tracks.js' + V),
  track:       () => import('./views/track.js' + V),
  set:         () => import('./views/set.js' + V),
  year:        () => import('./views/year.js' + V),
  stages:      () => import('./views/stages.js' + V),
  labels:      () => import('./views/labels.js' + V),
  b2b:         () => import('./views/b2b.js' + V),
  versus:      () => import('./views/versus.js' + V),
  journeys:    () => import('./views/journeys.js' + V),
  dna:         () => import('./views/dna.js' + V),
  // Legacy redirect
  discoveries: () => import('./views/overview.js' + V),
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
  // Map detail views to their parent nav item
  const viewToNav = {
    dj: 'djs',
    heatmap: 'djs',
    track: 'tracks',
    set: 'tracks',
    discoveries: 'overview',
    labels: 'tracks',
    b2b: 'djs',
  };
  const navView = viewToNav[view] || view;

  // Sidebar
  document.querySelectorAll('.nav-link').forEach(link => {
    const linkView = link.dataset.view;
    link.classList.toggle('active', linkView === navView ||
      (navView === '' && linkView === 'overview'));
  });
  // Mobile tabs
  document.querySelectorAll('.tab-link').forEach(link => {
    const linkView = link.dataset.view;
    link.classList.toggle('active', linkView === navView ||
      (navView === '' && linkView === 'overview'));
  });
}

// ── Breadcrumbs ────────────────────────────────────
function updateBreadcrumbs(view, params) {
  const el = breadcrumbs();
  if (!el) return;

  const crumbs = [{ label: 'Home', href: '#/' }];
  const viewLabels = {
    djs: 'DJs',
    heatmap: 'DJs',
    dj: 'DJs',
    tracks: 'Tracks',
    track: 'Tracks',
    set: 'Sets',
    year: 'Sets',
    stages: 'Stages',
    labels: 'Labels',
    versus: 'Versus',
    journeys: 'Journeys',
    dna: 'DNA',
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
      crumbs.push({ label: `${titleCase(parts[0])} — ${titleCase(parts[1])}` });
    }
  } else if (view === 'set' && params[0] && state.index) {
    const tlId = params[0];
    const set = state.index.sets.find(s => s.tlId === tlId);
    if (set) {
      // Add DJ breadcrumb
      const djSlug = set.djs?.[0]?.slug;
      if (djSlug) {
        crumbs.push({ label: set.dj, href: `#/dj/${djSlug}` });
      }
      crumbs.push({ label: `${set.year} ${set.stage}` });
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
  const toggle = document.getElementById('search-toggle');
  const container = document.getElementById('search-container');
  if (!input || !results) return;

  // Mobile search toggle
  if (toggle && container) {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = container.classList.toggle('search-open');
      if (isOpen) {
        input.focus();
      } else {
        input.blur();
        input.value = '';
        results.classList.add('hidden');
      }
    });
  }

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
      // Also close mobile search
      if (container) container.classList.remove('search-open');
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
      if (container) container.classList.remove('search-open');
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

  const stripAccents = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const q = stripAccents(query.toLowerCase());

  // Search DJs
  const djMap = new Map();
  for (const set of state.index.sets) {
    for (const dj of set.djs) {
      if (stripAccents(dj.name.toLowerCase()).includes(q) && !djMap.has(dj.slug)) {
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
      .filter(t => stripAccents(`${t.artist} ${t.title}`.toLowerCase()).includes(q))
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
      const sc = document.getElementById('search-container');
      if (sc) sc.classList.remove('search-open');
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

function titleCase(str) {
  if (!str) return '';
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

// ── Persistent Player Bar ──────────────────────────
const player = {
  platform: null,
  widget: null,
  playing: false,
  duration: 0,
  poll: null,
};

// API loaders (each loads once)
let _scApi = null;
function loadSCApi() {
  if (_scApi) return _scApi;
  _scApi = new Promise(resolve => {
    const s = document.createElement('script');
    s.src = 'https://w.soundcloud.com/player/api.js';
    s.onload = resolve;
    s.onerror = resolve; // degrade gracefully
    document.head.appendChild(s);
  });
  return _scApi;
}

let _ytApi = null;
function loadYTApi() {
  if (_ytApi) return _ytApi;
  _ytApi = new Promise(resolve => {
    window.onYouTubeIframeAPIReady = resolve;
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = resolve;
    document.head.appendChild(s);
  });
  return _ytApi;
}

function cleanupPlayer() {
  if (player.poll) { clearInterval(player.poll); player.poll = null; }
  if (player.platform === 'youtube' && player.widget) {
    try { player.widget.destroy(); } catch(e) {}
  }
  player.widget = null;
  player.platform = null;
  player.playing = false;
  player.duration = 0;
  const wrap = document.getElementById('player-bar-iframe-wrap');
  if (wrap) wrap.innerHTML = '';
  const embed = document.getElementById('player-bar-embed');
  if (embed) embed.innerHTML = '';
  const controls = document.getElementById('player-bar-controls');
  if (controls) controls.style.display = '';
  const fill = document.getElementById('player-bar-progress-fill');
  if (fill) fill.style.width = '0%';
  const time = document.getElementById('player-bar-time');
  if (time) time.textContent = '0:00';
  const btn = document.getElementById('player-bar-play');
  if (btn) btn.innerHTML = '&#9654;';
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function updateProgress(current, duration) {
  const fill = document.getElementById('player-bar-progress-fill');
  const time = document.getElementById('player-bar-time');
  if (fill && duration > 0) fill.style.width = `${(current / duration) * 100}%`;
  if (time) time.textContent = fmtTime(current);
}

function startYTPoll() {
  if (player.poll) clearInterval(player.poll);
  player.poll = setInterval(() => {
    if (!player.widget || !player.playing) return;
    try {
      const cur = player.widget.getCurrentTime();
      const dur = player.widget.getDuration() || player.duration;
      updateProgress(cur, dur);
    } catch(e) {}
  }, 500);
}

export async function playInBar(platform, url, title, tlId) {
  const bar = document.getElementById('player-bar');
  if (!bar) return;

  cleanupPlayer();

  const titleEl = document.getElementById('player-bar-title');
  titleEl.textContent = title || '';
  titleEl.href = tlId ? `#/set/${tlId}` : '#/';

  // External link — open on the source platform
  const extEl = document.getElementById('player-bar-ext');
  if (platform === 'youtube') {
    const ytId = url.includes('youtube.com/watch') ? new URL(url).searchParams.get('v') : url.split('/').pop();
    extEl.href = `https://www.youtube.com/watch?v=${ytId}`;
    extEl.classList.remove('hidden');
  } else if (platform === 'soundcloud') {
    extEl.href = url;
    extEl.classList.remove('hidden');
  } else {
    extEl.classList.add('hidden');
  }

  bar.classList.remove('hidden');
  document.body.classList.add('player-open');
  player.platform = platform;

  const playBtn = document.getElementById('player-bar-play');
  const wrap = document.getElementById('player-bar-iframe-wrap');

  if (platform === 'youtube') {
    await loadYTApi();
    if (typeof YT === 'undefined' || !YT.Player) return;
    const ytId = url.includes('youtube.com/watch') ? new URL(url).searchParams.get('v') : url.split('/').pop();
    wrap.innerHTML = '<div id="player-yt"></div>';
    player.widget = new YT.Player('player-yt', {
      height: '1', width: '1',
      videoId: ytId,
      playerVars: { autoplay: 1, controls: 0 },
      events: {
        onReady: (e) => {
          e.target.playVideo();
          player.duration = e.target.getDuration();
          player.playing = true;
          playBtn.innerHTML = '&#9646;&#9646;';
          startYTPoll();
        },
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.ENDED) {
            player.playing = false;
            playBtn.innerHTML = '&#9654;';
          }
        },
      },
    });
  } else if (platform === 'soundcloud') {
    await loadSCApi();
    if (typeof SC === 'undefined' || !SC.Widget) return;
    const scUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23f97316&auto_play=true&buying=false&sharing=false&download=false&show_artwork=false&show_playcount=false&show_user=false&hide_related=true&show_comments=false&show_reposts=false&show_teaser=false&visual=false`;
    wrap.innerHTML = `<iframe id="player-sc" width="1" height="1" scrolling="no" frameborder="no" allow="autoplay" src="${scUrl}"></iframe>`;
    const widget = SC.Widget(document.getElementById('player-sc'));
    player.widget = widget;
    widget.bind(SC.Widget.Events.READY, () => {
      widget.getDuration(d => { player.duration = d; });
      widget.play();
      player.playing = true;
      playBtn.innerHTML = '&#9646;&#9646;';
    });
    widget.bind(SC.Widget.Events.PLAY_PROGRESS, (e) => {
      updateProgress(e.currentPosition / 1000, player.duration / 1000);
    });
    widget.bind(SC.Widget.Events.FINISH, () => {
      player.playing = false;
      playBtn.innerHTML = '&#9654;';
    });
  } else if (platform === 'spotify') {
    // No controllable API — show Spotify embed, hide custom controls
    document.getElementById('player-bar-controls').style.display = 'none';
    let embedUrl = url;
    if (!embedUrl.includes('embed')) embedUrl = embedUrl.replace('open.spotify.com/', 'open.spotify.com/embed/');
    document.getElementById('player-bar-embed').innerHTML =
      `<iframe src="${embedUrl}" width="100%" height="80" frameborder="0" allow="encrypted-media" loading="lazy" style="display:block;"></iframe>`;
  }
}

function initPlayerBar() {
  const closeBtn = document.getElementById('player-bar-close');
  const playBtn = document.getElementById('player-bar-play');
  const progress = document.getElementById('player-bar-progress');

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      cleanupPlayer();
      document.getElementById('player-bar')?.classList.add('hidden');
      document.body.classList.remove('player-open');
    });
  }

  if (playBtn) {
    playBtn.addEventListener('click', () => {
      if (!player.widget) return;
      if (player.playing) {
        if (player.platform === 'youtube') player.widget.pauseVideo();
        else if (player.platform === 'soundcloud') player.widget.pause();
        player.playing = false;
        playBtn.innerHTML = '&#9654;';
      } else {
        if (player.platform === 'youtube') { player.widget.playVideo(); startYTPoll(); }
        else if (player.platform === 'soundcloud') player.widget.play();
        player.playing = true;
        playBtn.innerHTML = '&#9646;&#9646;';
      }
    });
  }

  if (progress) {
    progress.addEventListener('click', (e) => {
      if (!player.widget || !player.duration) return;
      const pct = (e.clientX - progress.getBoundingClientRect().left) / progress.offsetWidth;
      if (player.platform === 'youtube') player.widget.seekTo(pct * player.duration, true);
      else if (player.platform === 'soundcloud') player.widget.seekTo(pct * player.duration);
    });
  }
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

  // Init player bar
  initPlayerBar();

  // Route
  window.addEventListener('hashchange', route);
  route();
}

init();
