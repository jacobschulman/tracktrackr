/**
 * journeys.js — Track Journey visualization
 * Route: #/journeys or #/journeys/{encodedTrackKey}
 *
 * Tells the story of how a track travels through Ultra — who played it first,
 * who picked it up next, and how it spread year by year.
 */

import { loadAllSets, isAllLoaded, getTopTracks, getTrackHistory, getTrackStreak, trackKey, parseTrackKey } from '../data.js?v=5';
import { CONFIG, getStageColor } from '../config.js?v=5';
import { fmt, stageBadge, navigateTo } from '../app.js?v=5';

let _cleanup = [];

export function destroy() {
  _cleanup.forEach(fn => fn());
  _cleanup = [];
}

// ── Helpers ─────────────────────────────────────────

function titleCase(str) {
  if (!str) return '';
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

function escHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(dateStr) {
  if (!dateStr) return '\u2014';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

// ── Render ──────────────────────────────────────────

export async function render(container, index, params) {
  const rawKey = params[0];

  if (rawKey) {
    await renderJourneyDetail(container, index, rawKey);
  } else {
    await renderTrackPicker(container, index);
  }
}

// ── Phase 1: Track Picker ───────────────────────────

async function renderTrackPicker(container, index) {
  container.innerHTML = `
    <h2 style="font-size:1.5rem;font-weight:700;margin-bottom:4px;">Journeys</h2>
    <p style="color:var(--muted);font-size:0.9375rem;margin-bottom:24px;">Follow a track's path through Ultra</p>

    <div id="journeys-progress" style="display:none;margin-bottom:24px;">
      <div class="progress-label" id="journeys-loading-label">Loading sets...</div>
      <div class="progress-bar-container">
        <div class="progress-bar" id="journeys-loading-bar" style="width:0%"></div>
      </div>
    </div>

    <div id="journeys-content"></div>
  `;

  // Load all sets
  if (!isAllLoaded()) {
    const progressWrap = document.getElementById('journeys-progress');
    const progressLabel = document.getElementById('journeys-loading-label');
    const progressBar = document.getElementById('journeys-loading-bar');
    if (progressWrap) progressWrap.style.display = 'block';

    await loadAllSets(null, (loaded, total) => {
      const pct = Math.round((loaded / total) * 100);
      if (progressLabel) progressLabel.textContent = `Loading ${loaded} of ${total} sets\u2026 ${pct}%`;
      if (progressBar) progressBar.style.width = `${pct}%`;
    });

    if (progressWrap) progressWrap.style.display = 'none';
  }

  const contentEl = document.getElementById('journeys-content');
  if (!contentEl) return;

  // Find featured journeys: tracks played by 4+ DJs across 3+ years
  const allTracks = getTopTracks(5000);
  const candidates = [];

  for (const t of allTracks) {
    if (t.djs.length >= 4 && t.years.length >= 3) {
      const history = getTrackHistory(t.artist, t.title);
      // Sort ascending to find first play
      const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
      const firstPlay = sorted[0];
      const lastPlay = sorted[sorted.length - 1];
      candidates.push({
        ...t,
        firstPlay,
        lastPlay,
        uniqueDJs: t.djs.length,
        uniqueYears: t.years.length,
        sortedYears: [...t.years].sort((a, b) => a - b),
      });
    }
  }

  // Sort by number of unique DJs descending
  candidates.sort((a, b) => b.uniqueDJs - a.uniqueDJs);
  const featured = candidates.slice(0, 8);

  // Build featured cards
  const featuredHtml = featured.map(t => {
    const encodedKey = encodeURIComponent(t.key);
    const displayArtist = titleCase(t.artist);
    const displayTitle = titleCase(t.title);
    const firstYear = t.sortedYears[0];
    const lastYear = t.sortedYears[t.sortedYears.length - 1];

    // Tiny dot timeline
    let dotsHtml = '';
    const activeYearSet = new Set(t.sortedYears);
    for (let y = firstYear; y <= lastYear; y++) {
      const active = activeYearSet.has(y);
      const bg = active ? 'var(--green)' : 'var(--border-lt)';
      dotsHtml += `<div style="width:6px;height:6px;border-radius:50%;background:${bg};flex-shrink:0;" title="${y}${active ? ' (active)' : ''}"></div>`;
    }

    return `
      <a href="#/journeys/${encodedKey}" class="card" style="display:block;text-decoration:none;color:inherit;margin-bottom:0;cursor:pointer;transition:border-color var(--transition);" onmouseover="this.style.borderColor='var(--purple-lt)'" onmouseout="this.style.borderColor='var(--border)'">
        <div style="font-size:0.9375rem;font-weight:600;margin-bottom:6px;line-height:1.3;">
          ${escHtml(displayArtist)} &mdash; ${escHtml(displayTitle)}
        </div>
        <div style="font-size:0.75rem;color:var(--muted);margin-bottom:4px;">
          First played: ${t.firstPlay.year} by ${escHtml(t.firstPlay.dj)}
        </div>
        <div style="font-size:0.75rem;color:var(--muted);margin-bottom:8px;">
          Spread to ${t.uniqueDJs} DJs over ${t.uniqueYears} years
        </div>
        <div style="display:flex;align-items:center;gap:2px;">
          ${dotsHtml}
        </div>
      </a>`;
  }).join('');

  contentEl.innerHTML = `
    <div style="margin-bottom:32px;">
      <div style="font-size:1rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-bright);margin-bottom:16px;">Featured Journeys</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;">
        ${featuredHtml || '<div style="color:var(--muted);font-size:0.875rem;">No tracks found with enough spread to feature.</div>'}
      </div>
    </div>

    <div style="margin-bottom:32px;">
      <div style="font-size:1rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-bright);margin-bottom:12px;">Find a Track</div>
      <div style="position:relative;" id="journey-search-container">
        <input type="text" id="journey-search-input" placeholder="Search by artist or title\u2026"
          style="width:100%;padding:10px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:0.875rem;outline:none;box-sizing:border-box;"
        />
        <div id="journey-search-results" class="hidden" style="position:absolute;top:100%;left:0;right:0;background:var(--surface2);border:1px solid var(--border);border-top:none;border-radius:0 0 var(--radius-sm) var(--radius-sm);max-height:320px;overflow-y:auto;z-index:50;"></div>
      </div>
    </div>
  `;

  // Search functionality
  const searchInput = document.getElementById('journey-search-input');
  const searchResultsEl = document.getElementById('journey-search-results');
  let searchTimeout = null;

  function performSearch(query) {
    if (!searchResultsEl) return;
    if (query.length < 2) {
      searchResultsEl.classList.add('hidden');
      return;
    }

    const q = query.toLowerCase();
    const matches = allTracks
      .filter(t => `${t.artist} ${t.title}`.toLowerCase().includes(q))
      .slice(0, 10);

    if (matches.length === 0) {
      searchResultsEl.innerHTML = `<div style="padding:12px 14px;color:var(--muted);font-size:0.8125rem;">No tracks found</div>`;
      searchResultsEl.classList.remove('hidden');
      return;
    }

    searchResultsEl.innerHTML = matches.map(t => {
      const encodedKey = encodeURIComponent(t.key);
      return `<div class="search-item" data-href="#/journeys/${encodedKey}" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background var(--transition);" onmouseover="this.style.background='var(--surface3)'" onmouseout="this.style.background='transparent'">
        <div style="font-size:0.875rem;font-weight:500;">${escHtml(titleCase(t.artist))} &mdash; ${escHtml(titleCase(t.title))}</div>
        <div style="font-size:0.75rem;color:var(--muted);margin-top:2px;">${t.playCount} plays &middot; ${t.djs.length} DJs &middot; ${t.years.length} years</div>
      </div>`;
    }).join('');

    searchResultsEl.classList.remove('hidden');

    // Click handlers for search results
    searchResultsEl.querySelectorAll('.search-item').forEach(item => {
      item.addEventListener('click', () => {
        location.hash = item.dataset.href;
        searchResultsEl.classList.add('hidden');
        searchInput.value = '';
      });
    });
  }

  if (searchInput) {
    const onInput = () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => performSearch(searchInput.value.trim()), 150);
    };

    const onFocus = () => {
      if (searchInput.value.trim().length >= 2) {
        searchResultsEl.classList.remove('hidden');
      }
    };

    const onClickOutside = (e) => {
      if (!e.target.closest('#journey-search-container')) {
        searchResultsEl.classList.add('hidden');
      }
    };

    const onKeydown = (e) => {
      const items = searchResultsEl.querySelectorAll('.search-item');
      const focused = searchResultsEl.querySelector('.search-item.focused');
      let idx = [...items].indexOf(focused);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (focused) focused.classList.remove('focused');
        idx = Math.min(idx + 1, items.length - 1);
        items[idx]?.classList.add('focused');
        items[idx]?.style.setProperty('background', 'var(--surface3)');
        items[idx]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (focused) focused.classList.remove('focused');
        idx = Math.max(idx - 1, 0);
        items[idx]?.classList.add('focused');
        items[idx]?.style.setProperty('background', 'var(--surface3)');
        items[idx]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && focused) {
        e.preventDefault();
        focused.click();
      } else if (e.key === 'Escape') {
        searchResultsEl.classList.add('hidden');
        searchInput.blur();
      }
    };

    searchInput.addEventListener('input', onInput);
    searchInput.addEventListener('focus', onFocus);
    searchInput.addEventListener('keydown', onKeydown);
    document.addEventListener('click', onClickOutside);

    _cleanup.push(() => {
      clearTimeout(searchTimeout);
      searchInput.removeEventListener('input', onInput);
      searchInput.removeEventListener('focus', onFocus);
      searchInput.removeEventListener('keydown', onKeydown);
      document.removeEventListener('click', onClickOutside);
    });
  }
}

// ── Phase 2: Journey Detail ─────────────────────────

async function renderJourneyDetail(container, index, rawKey) {
  const { artist, title } = parseTrackKey(rawKey);
  if (!artist && !title) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">?</div><div class="empty-state-text">Invalid track key.</div></div>`;
    return;
  }

  const displayArtist = titleCase(artist);
  const displayTitle = titleCase(title);
  const encodedKey = encodeURIComponent(rawKey);

  container.innerHTML = `
    <div style="margin-bottom:24px;">
      <h1 style="font-size:1.5rem;font-weight:700;margin-bottom:6px;">
        <a href="#/track/${encodedKey}" style="color:var(--text-bright);text-decoration:none;">${escHtml(displayArtist)} &mdash; ${escHtml(displayTitle)}</a>
      </h1>
      <span class="pill pill-purple" id="journey-year-span">Loading...</span>
    </div>

    <div id="journey-loading" style="margin-bottom:24px;">
      <div class="progress-label" id="journey-loading-label">Loading sets...</div>
      <div class="progress-bar-container"><div class="progress-bar" id="journey-loading-progress" style="width:0%"></div></div>
    </div>

    <div id="journey-content"></div>
  `;

  // Load all sets
  if (!isAllLoaded()) {
    const loadingEl = document.getElementById('journey-loading');
    const loadingLabel = document.getElementById('journey-loading-label');
    const loadingProgress = document.getElementById('journey-loading-progress');
    if (loadingEl) loadingEl.style.display = 'block';

    await loadAllSets(null, (loaded, total) => {
      const pct = Math.round((loaded / total) * 100);
      if (loadingLabel) loadingLabel.textContent = `Loading ${loaded} of ${total} sets\u2026 ${pct}%`;
      if (loadingProgress) loadingProgress.style.width = `${pct}%`;
    });

    if (loadingEl) loadingEl.style.display = 'none';
  }

  // Get data
  const history = getTrackHistory(artist, title);
  const streak = getTrackStreak(artist, title);

  if (history.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">?</div><div class="empty-state-text">Track not found in any set.</div></div>`;
    return;
  }

  // Sort ascending by date for journey analysis
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));

  // Group by year
  const byYear = {};
  for (const a of sorted) {
    if (!byYear[a.year]) byYear[a.year] = [];
    byYear[a.year].push(a);
  }
  const yearKeys = Object.keys(byYear).map(Number).sort((a, b) => a - b);

  // Update year span pill
  const yearSpanEl = document.getElementById('journey-year-span');
  if (yearSpanEl && yearKeys.length > 0) {
    yearSpanEl.textContent = yearKeys.length === 1
      ? `${yearKeys[0]}`
      : `${yearKeys[0]}\u2013${yearKeys[yearKeys.length - 1]}`;
  }

  // Track "new" vs "returning" DJs
  const seenSlugs = new Set();
  const djFirstYear = {}; // slug -> first year
  const djPlayCounts = {}; // slug -> count
  const djNameMap = {}; // slug -> name

  for (const year of yearKeys) {
    for (const a of byYear[year]) {
      const slug = (a.djSlugs && a.djSlugs[0]) || a.dj;
      if (!djFirstYear[slug]) djFirstYear[slug] = year;
      djPlayCounts[slug] = (djPlayCounts[slug] || 0) + 1;
      djNameMap[slug] = a.dj;
    }
  }

  // The first appearance
  const origin = sorted[0];
  const originSlug = (origin.djSlugs && origin.djSlugs[0]) || '';
  const originDJLink = originSlug
    ? `<a href="#/dj/${originSlug}" class="dj-link">${escHtml(origin.dj)}</a>`
    : escHtml(origin.dj);

  // How many times did the origin DJ play it?
  const originPlayCount = sorted.filter(a => a.dj === origin.dj).length;
  let originNote = '';
  if (originPlayCount === 1) {
    originNote = `<div style="font-size:0.8125rem;color:var(--muted);margin-top:4px;">They only played it once at Ultra.</div>`;
  } else {
    originNote = `<div style="font-size:0.8125rem;color:var(--muted);margin-top:4px;">They went on to play it ${originPlayCount} times total at Ultra.</div>`;
  }

  // ── 1. Origin Story ──────────────────────────────

  const originHtml = `
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header"><div class="card-title">The Origin Story</div></div>
      <div style="padding:4px 0;">
        <div style="font-size:0.9375rem;line-height:1.6;">
          First played at Ultra on <strong style="color:var(--text-bright)">${formatDate(origin.date)}</strong>
          by ${originDJLink} at ${stageBadge(origin.stage)}
        </div>
        ${originNote}
      </div>
    </div>`;

  // ── 2. Spread Timeline ───────────────────────────

  const seenForTimeline = new Set();
  let timelineHtml = '';

  for (const year of yearKeys) {
    const appearances = byYear[year];

    // Dedupe DJs within a year (one entry per DJ, but note multiple plays)
    const djsThisYear = new Map(); // slug -> { appearances, isNew }
    for (const a of appearances) {
      const slug = (a.djSlugs && a.djSlugs[0]) || a.dj;
      if (!djsThisYear.has(slug)) {
        djsThisYear.set(slug, { name: a.dj, slug: (a.djSlugs && a.djSlugs[0]) || '', stage: a.stage, isNew: !seenForTimeline.has(slug), count: 0 });
      }
      djsThisYear.get(slug).count++;
    }

    // Mark all DJs as seen after processing this year
    for (const slug of djsThisYear.keys()) {
      seenForTimeline.add(slug);
    }

    const djCount = djsThisYear.size;
    const djPills = [...djsThisYear.values()].map(d => {
      const nameLink = d.slug
        ? `<a href="#/dj/${d.slug}" class="dj-link" style="font-size:0.8125rem;">${escHtml(d.name)}</a>`
        : `<span style="font-size:0.8125rem;">${escHtml(d.name)}</span>`;

      let badge = '';
      if (d.isNew) {
        badge = `<span style="background:var(--green-dim);color:var(--green);border-radius:100px;padding:2px 8px;font-size:0.6875rem;font-weight:600;margin-left:4px;">NEW</span>`;
      } else {
        const totalPlaysForDJ = djPlayCounts[(d.slug || d.name)];
        if (totalPlaysForDJ > 1) {
          badge = `<span class="pill pill-purple" style="font-size:0.625rem;margin-left:4px;">${totalPlaysForDJ}x</span>`;
        }
      }

      const stageHtml = stageBadge(d.stage);

      return `<div style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:var(--surface2);border-radius:8px;margin:3px 0;">
        ${nameLink}${badge}
        <span style="font-size:0.75rem;">${stageHtml}</span>
      </div>`;
    }).join('');

    timelineHtml += `
      <div style="display:flex;gap:16px;align-items:flex-start;padding:16px 0;border-left:2px solid var(--border);margin-left:40px;padding-left:20px;position:relative;">
        <div style="position:absolute;left:-10px;top:20px;width:18px;height:18px;border-radius:50%;background:var(--surface);border:2px solid var(--purple-lt);display:flex;align-items:center;justify-content:center;">
          <div style="width:8px;height:8px;border-radius:50%;background:var(--purple-lt);"></div>
        </div>
        <div style="min-width:50px;flex-shrink:0;">
          <div style="font-size:1.125rem;font-weight:700;color:var(--purple-lt);">${year}</div>
          <div style="font-size:0.6875rem;color:var(--muted);">${djCount} DJ${djCount !== 1 ? 's' : ''}</div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;flex:1;">
          ${djPills}
        </div>
      </div>`;
  }

  const spreadTimelineHtml = `
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header"><div class="card-title">The Spread Timeline</div></div>
      <div style="padding:0 0 8px;">
        ${timelineHtml}
      </div>
    </div>`;

  // ── 3. Journey Stats ─────────────────────────────

  // Patient Zero
  const patientZeroSlug = originSlug;
  const patientZeroName = origin.dj;
  const patientZeroLink = patientZeroSlug
    ? `<a href="#/dj/${patientZeroSlug}" class="dj-link">${escHtml(patientZeroName)}</a>`
    : escHtml(patientZeroName);

  // Peak Year
  let peakYear = yearKeys[0];
  let peakCount = 0;
  for (const year of yearKeys) {
    const count = new Set(byYear[year].map(a => (a.djSlugs && a.djSlugs[0]) || a.dj)).size;
    if (count > peakCount) {
      peakCount = count;
      peakYear = year;
    }
  }

  // Total Carriers
  const totalCarriers = Object.keys(djFirstYear).length;

  // Lifespan
  const firstYearVal = yearKeys[0];
  const lastYearVal = yearKeys[yearKeys.length - 1];
  const lifespanStr = firstYearVal === lastYearVal
    ? `${firstYearVal}`
    : `${firstYearVal} \u2014 ${lastYearVal}`;

  const statsHtml = `
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header"><div class="card-title">Journey Stats</div></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;">
        <div class="stat-card">
          <div class="stat-number" style="font-size:1rem;">${patientZeroLink}</div>
          <div class="stat-label">Patient Zero</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${peakYear}</div>
          <div class="stat-label">Peak Year (${peakCount} DJs)</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${totalCarriers}</div>
          <div class="stat-label">Total Carriers</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="font-size:1rem;">${lifespanStr}</div>
          <div class="stat-label">Lifespan</div>
        </div>
      </div>
    </div>`;

  // ── 4. All Carriers Table ────────────────────────

  // Build carrier data sorted by first year
  const carriers = Object.entries(djFirstYear)
    .map(([slug, firstYear]) => ({
      slug,
      name: djNameMap[slug],
      firstYear,
      totalPlays: djPlayCounts[slug],
      hasSlug: slug !== djNameMap[slug], // if slug !== name, it's a real slug
    }))
    .sort((a, b) => a.firstYear - b.firstYear || a.name.localeCompare(b.name));

  const carriersTableRows = carriers.map(c => {
    const nameLink = c.hasSlug
      ? `<a href="#/dj/${c.slug}" class="dj-link">${escHtml(c.name)}</a>`
      : escHtml(c.name);
    return `<tr>
      <td>${nameLink}</td>
      <td>${c.firstYear}</td>
      <td>${c.totalPlays}</td>
    </tr>`;
  }).join('');

  const carriersHtml = `
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header">
        <div class="card-title">All Carriers</div>
        <div class="text-muted" style="font-size:0.75rem;">${carriers.length} DJs</div>
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>DJ</th>
              <th>First Played</th>
              <th>Total Plays</th>
            </tr>
          </thead>
          <tbody>
            ${carriersTableRows}
          </tbody>
        </table>
      </div>
    </div>`;

  // ── 5. Explore Another ───────────────────────────

  const exploreHtml = `
    <div style="text-align:center;padding:16px 0;">
      <a href="#/journeys" style="color:var(--purple-lt);text-decoration:none;font-size:0.9375rem;">
        &larr; Explore another track
      </a>
    </div>`;

  // ── Assemble ─────────────────────────────────────

  const contentEl = document.getElementById('journey-content');
  if (!contentEl) return;

  contentEl.innerHTML = `
    ${originHtml}
    ${spreadTimelineHtml}
    ${statsHtml}
    ${carriersHtml}
    ${exploreHtml}
  `;
}
