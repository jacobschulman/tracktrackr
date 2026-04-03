/**
 * dna.js — Festival DNA view
 * Route: #/dna or #/dna/{year}
 *
 * Shows the "fingerprint" of each Ultra year — what tracks, DJs,
 * and stages defined it and how it differed from other years.
 */

import { loadAllSets, isAllLoaded, getTopTracks, getYearStats } from '../data.js?v=6';
import { getStageColor } from '../config.js?v=6';
import { fmt, navigateTo } from '../app.js?v=6';

let _cleanup = [];

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function pct(n, total) {
  if (!total) return '0';
  return Math.round((n / total) * 100);
}

function addListener(el, evt, fn) {
  if (!el) return;
  el.addEventListener(evt, fn);
  _cleanup.push(() => el.removeEventListener(evt, fn));
}

export function destroy() {
  _cleanup.forEach(fn => fn());
  _cleanup = [];
}

export async function render(container, index, params) {
  const selectedYear = params[0] ? parseInt(params[0]) : Math.max(...index.years);
  const minYear = Math.min(...index.years);

  container.innerHTML = `
    <div style="text-align:center;margin-bottom:8px">
      <h2 style="font-size:1.75rem;font-weight:900;margin:0">Festival DNA</h2>
      <p style="color:var(--muted);margin:4px 0 0">What made each year unique</p>
    </div>

    <div class="year-pills" id="dna-year-pills" style="overflow-x:auto;white-space:nowrap;padding-bottom:8px;margin-bottom:24px;">
      ${index.years.map(y =>
        `<button class="year-pill${y === selectedYear ? ' active' : ''}" data-year="${y}">${y}</button>`
      ).join('')}
    </div>

    <div id="dna-content"></div>
  `;

  // Scroll active pill into view
  const activePill = container.querySelector('.year-pill.active');
  if (activePill) {
    activePill.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' });
  }

  // Year pill click handlers
  container.querySelectorAll('.year-pill').forEach(btn => {
    addListener(btn, 'click', () => {
      navigateTo(`#/dna/${btn.dataset.year}`);
    });
  });

  // Render content
  renderContent(selectedYear, minYear, index);
}

/* ── Main content renderer ────────────────────────── */
function renderContent(selectedYear, minYear, index) {
  const content = document.getElementById('dna-content');
  if (!content) return;

  const stats = getYearStats(selectedYear);
  if (!stats) {
    content.innerHTML = '<div class="empty-state"><div class="empty-state-text">No data for this year.</div></div>';
    return;
  }

  // Phase 1: Hero + loading state
  content.innerHTML = `
    ${renderHero(selectedYear, stats)}

    <div id="dna-loading">
      <div class="card" style="margin-bottom:24px">
        <div style="padding:16px">
          <div class="progress-label" id="dna-loading-label">Loading tracklists\u2026</div>
          <div class="progress-bar-container"><div class="progress-bar" id="dna-loading-bar" style="width:0%"></div></div>
        </div>
      </div>
    </div>

    <div id="dna-sections" style="display:none"></div>
  `;

  // Stage makeup can render immediately (no track data needed)
  // DJ analysis needs index only
  // Track sections need all sets loaded

  loadData(selectedYear, minYear, index, stats);
}

async function loadData(selectedYear, minYear, index, stats) {
  if (!isAllLoaded()) {
    await loadAllSets(null, (loaded, total) => {
      const label = document.getElementById('dna-loading-label');
      const bar = document.getElementById('dna-loading-bar');
      const p = Math.round((loaded / total) * 100);
      if (label) label.textContent = `Loading ${loaded} of ${total} sets\u2026 ${p}%`;
      if (bar) bar.style.width = `${p}%`;
    });
  }

  const loadingEl = document.getElementById('dna-loading');
  if (loadingEl) loadingEl.style.display = 'none';

  const sections = document.getElementById('dna-sections');
  if (!sections) return;
  sections.style.display = 'block';

  // Re-fetch stats with track data
  const freshStats = getYearStats(selectedYear);

  // Get ALL tracks globally (no year filter) so we have full years arrays
  const allTracksGlobal = getTopTracks(99999);

  // Tracks that were played this year
  const tracksThisYear = allTracksGlobal.filter(t => t.years.includes(selectedYear));

  // Build DJ year map from index
  const djAllYears = buildDJYearMap(index);

  sections.innerHTML = [
    renderUniqueSection(selectedYear, tracksThisYear),
    renderCrossoverSection(selectedYear, tracksThisYear),
    renderDJMixSection(selectedYear, index, djAllYears),
    renderStageMakeup(selectedYear, freshStats || stats),
    selectedYear > minYear ? renderYearOverYear(selectedYear, index, tracksThisYear, allTracksGlobal) : '',
  ].join('');

  wireClickHandlers(sections);
}

/* ── Hero ─────────────────────────────────────────── */
function renderHero(year, stats) {
  return `
    <div style="text-align:center;margin-bottom:28px">
      <div style="font-size:3rem;font-weight:900;letter-spacing:-0.04em;line-height:1;color:var(--text)">${year}</div>
      <div class="stat-bar" style="margin-top:16px;justify-content:center">
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
    </div>
  `;
}

/* ── "Only at Ultra {YEAR}" ───────────────────────── */
function renderUniqueSection(year, tracksThisYear) {
  // Tracks where years.length === 1 means they only appeared in this year
  const uniqueTracks = tracksThisYear
    .filter(t => t.years.length === 1)
    .sort((a, b) => b.playCount - a.playCount || a.artist.localeCompare(b.artist))
    .slice(0, 15);

  if (uniqueTracks.length === 0) {
    return `
      <div class="card" style="margin-bottom:24px">
        <div class="card-header">
          <div class="card-title">Only at Ultra ${year}</div>
        </div>
        <div style="padding:16px;color:var(--muted);font-size:0.875rem">
          No tracks were exclusive to this year.
        </div>
      </div>
    `;
  }

  const maxPlay = uniqueTracks[0].playCount;

  return `
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div class="card-title">Only at Ultra ${year}</div>
        <span style="font-size:0.75rem;color:var(--muted)">${uniqueTracks.length} unique track${uniqueTracks.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="leaderboard">
        ${uniqueTracks.map((t, i) => {
          const rank = i + 1;
          const top3Class = rank <= 3 ? 'top3' : '';
          const encodedKey = encodeURIComponent(t.key);
          const barPct = (t.playCount / maxPlay) * 100;
          return `
            <div class="leaderboard-row" data-href="#/track/${encodedKey}">
              <div class="leaderboard-rank ${top3Class}">${rank}</div>
              <div class="leaderboard-info">
                <div class="leaderboard-name">${escHtml(t.artist)} &mdash; ${escHtml(t.title)}</div>
                <div class="leaderboard-meta">
                  <span>${t.djs.length} DJ${t.djs.length !== 1 ? 's' : ''} played this</span>
                </div>
                <div class="leaderboard-bar">
                  <div class="leaderboard-bar-fill" style="width:${barPct}%"></div>
                </div>
              </div>
              <div>
                <div class="leaderboard-count">${t.playCount}</div>
                <div class="leaderboard-count-label">play${t.playCount !== 1 ? 's' : ''}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/* ── "Crossover Hits" ─────────────────────────────── */
function renderCrossoverSection(year, tracksThisYear) {
  const crossoverTracks = tracksThisYear
    .filter(t => t.years.length >= 3)
    .sort((a, b) => b.years.length - a.years.length || b.playCount - a.playCount)
    .slice(0, 10);

  if (crossoverTracks.length === 0) return '';

  return `
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div class="card-title">Crossover Hits</div>
        <span style="font-size:0.75rem;color:var(--muted)">Tracks connecting ${year} to Ultra history</span>
      </div>
      <div style="padding:0">
        ${crossoverTracks.map(t => {
          const encodedKey = encodeURIComponent(t.key);
          // Count plays in this specific year
          // Since getTopTracks was unfiltered, playCount is global.
          // We need to estimate this year's play count from the year-filtered data.
          // We already filtered tracksThisYear by year inclusion, but playCount is global.
          // Use a simpler approach: note how many DJs played it
          return `
            <div class="leaderboard-row" data-href="#/track/${encodedKey}" style="padding:12px 16px">
              <div class="leaderboard-info" style="flex:1;min-width:0">
                <div class="leaderboard-name">${escHtml(t.artist)} &mdash; ${escHtml(t.title)}</div>
                <div class="leaderboard-meta">
                  <span>${t.djs.length} DJ${t.djs.length !== 1 ? 's' : ''} total</span>
                  <span style="margin-left:8px">${t.playCount} plays all-time</span>
                </div>
              </div>
              <div>
                <span class="pill pill-green" style="font-size:0.75rem;white-space:nowrap">${t.years.length} years</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/* ── Build DJ -> years map ────────────────────────── */
function buildDJYearMap(index) {
  const djAllYears = new Map(); // slug -> Set<year>
  for (const s of index.sets) {
    for (const d of s.djs) {
      if (!djAllYears.has(d.slug)) djAllYears.set(d.slug, new Set());
      djAllYears.get(d.slug).add(s.year);
    }
  }
  return djAllYears;
}

/* ── "The Regulars vs The Fresh" ──────────────────── */
function renderDJMixSection(year, index, djAllYears) {
  // DJs who played this year
  const djsThisYear = new Set();
  const djNameMap = new Map(); // slug -> name
  for (const s of index.sets) {
    if (s.year !== year) continue;
    for (const d of s.djs) {
      djsThisYear.add(d.slug);
      djNameMap.set(d.slug, d.name);
    }
  }

  const firstTimers = [];   // only year in data === this year
  const veterans = [];      // played 3+ years before this year
  const returning = [];     // played before but < 3 prior years

  for (const slug of djsThisYear) {
    const allYears = djAllYears.get(slug) || new Set();
    const priorYears = [...allYears].filter(y => y < year);

    if (priorYears.length === 0 && allYears.size === 1) {
      firstTimers.push({ slug, name: djNameMap.get(slug) || slug });
    } else if (priorYears.length >= 3) {
      veterans.push({ slug, name: djNameMap.get(slug) || slug, priorCount: priorYears.length });
    } else {
      returning.push({ slug, name: djNameMap.get(slug) || slug, priorCount: priorYears.length });
    }
  }

  // Sort veterans by most prior years
  veterans.sort((a, b) => b.priorCount - a.priorCount);
  firstTimers.sort((a, b) => a.name.localeCompare(b.name));

  const total = djsThisYear.size;
  if (total === 0) return '';

  const pctFirst = pct(firstTimers.length, total);
  const pctVet = pct(veterans.length, total);
  const pctRet = pct(returning.length, total);

  const colorFirst = '#22c55e';
  const colorVet = '#a855f7';
  const colorRet = '#3b82f6';

  const topFirstTimers = firstTimers.slice(0, 5);
  const topVeterans = veterans.slice(0, 5);

  return `
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div class="card-title">The Regulars vs The Fresh</div>
      </div>
      <div style="padding:16px">
        <!-- Stacked bar -->
        <div style="display:flex;height:32px;border-radius:6px;overflow:hidden;margin-bottom:12px" id="dna-dj-bar">
          ${firstTimers.length > 0 ? `<div style="flex:${firstTimers.length};background:${colorFirst};position:relative;cursor:default;min-width:2px" title="First-timers: ${firstTimers.length} (${pctFirst}%)"></div>` : ''}
          ${returning.length > 0 ? `<div style="flex:${returning.length};background:${colorRet};position:relative;cursor:default;min-width:2px" title="Returning: ${returning.length} (${pctRet}%)"></div>` : ''}
          ${veterans.length > 0 ? `<div style="flex:${veterans.length};background:${colorVet};position:relative;cursor:default;min-width:2px" title="Veterans: ${veterans.length} (${pctVet}%)"></div>` : ''}
        </div>

        <!-- Legend -->
        <div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:16px;font-size:0.8rem">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="width:10px;height:10px;border-radius:50%;background:${colorFirst};display:inline-block"></span>
            <span>First-timers: <strong>${firstTimers.length}</strong> (${pctFirst}%)</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="width:10px;height:10px;border-radius:50%;background:${colorRet};display:inline-block"></span>
            <span>Returning: <strong>${returning.length}</strong> (${pctRet}%)</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="width:10px;height:10px;border-radius:50%;background:${colorVet};display:inline-block"></span>
            <span>Veterans (3+ prior yrs): <strong>${veterans.length}</strong> (${pctVet}%)</span>
          </div>
        </div>

        <!-- Top lists -->
        <div style="display:flex;gap:20px;flex-wrap:wrap">
          ${topFirstTimers.length > 0 ? `
            <div style="flex:1;min-width:180px">
              <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:8px;letter-spacing:0.05em">Fresh Faces</div>
              <div style="display:flex;flex-direction:column;gap:4px">
                ${topFirstTimers.map(d =>
                  `<a href="#/dj/${d.slug}" class="dj-link" style="font-size:0.85rem;text-decoration:none">${escHtml(d.name)}</a>`
                ).join('')}
              </div>
            </div>
          ` : ''}
          ${topVeterans.length > 0 ? `
            <div style="flex:1;min-width:180px">
              <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:8px;letter-spacing:0.05em">Veterans</div>
              <div style="display:flex;flex-direction:column;gap:4px">
                ${topVeterans.map(d =>
                  `<a href="#/dj/${d.slug}" class="dj-link" style="font-size:0.85rem;text-decoration:none">${escHtml(d.name)} <span class="pill pill-purple" style="font-size:0.65rem;margin-left:4px">${d.priorCount} prior yrs</span></a>`
                ).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

/* ── "Stage Makeup" ───────────────────────────────── */
function renderStageMakeup(year, stats) {
  const stageNames = Object.keys(stats.stages).sort((a, b) => stats.stages[b] - stats.stages[a]);
  if (stageNames.length === 0) return '';

  const totalSets = stats.setCount;

  return `
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div class="card-title">Stage Makeup</div>
        <span style="font-size:0.75rem;color:var(--muted)">${stageNames.length} stage${stageNames.length !== 1 ? 's' : ''}</span>
      </div>
      <div style="padding:16px">
        <!-- Stacked bar -->
        <div style="display:flex;height:32px;border-radius:6px;overflow:hidden;margin-bottom:12px" id="dna-stage-bar">
          ${stageNames.map(name => {
            const count = stats.stages[name];
            const color = getStageColor(name);
            const p = pct(count, totalSets);
            return `<div style="flex:${count};background:${color};position:relative;cursor:default;min-width:2px" title="${escHtml(name)}: ${count} sets (${p}%)"></div>`;
          }).join('')}
        </div>

        <!-- Stage list -->
        <div style="display:flex;flex-direction:column;gap:6px">
          ${stageNames.map(name => {
            const count = stats.stages[name];
            const color = getStageColor(name);
            const p = pct(count, totalSets);
            return `
              <div style="display:flex;align-items:center;gap:8px;font-size:0.85rem">
                <span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>
                <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(name)}</span>
                <span style="color:var(--muted);flex-shrink:0;font-size:0.8rem">${count} set${count !== 1 ? 's' : ''}</span>
                <span style="color:var(--muted);flex-shrink:0;font-size:0.75rem;min-width:32px;text-align:right">${p}%</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

/* ── Year-over-Year comparison ────────────────────── */
function renderYearOverYear(year, index, tracksThisYear, allTracksGlobal) {
  const prevYear = year - 1;

  // Check if previous year exists in index
  if (!index.years.includes(prevYear)) {
    // Find the closest prior year
    const priorYears = index.years.filter(y => y < year).sort((a, b) => b - a);
    if (priorYears.length === 0) return '';
    // Only show comparison if the gap is small
    const closestPrior = priorYears[0];
    if (year - closestPrior > 3) return '';
    return renderYearOverYearInner(year, closestPrior, index, tracksThisYear, allTracksGlobal);
  }

  return renderYearOverYearInner(year, prevYear, index, tracksThisYear, allTracksGlobal);
}

function renderYearOverYearInner(year, compYear, index, tracksThisYear, allTracksGlobal) {
  // DJs this year and comparison year
  const djsThisYear = new Set();
  const djsCompYear = new Set();
  for (const s of index.sets) {
    for (const d of s.djs) {
      if (s.year === year) djsThisYear.add(d.slug);
      if (s.year === compYear) djsCompYear.add(d.slug);
    }
  }

  let returningDJs = 0;
  let newDJs = 0;
  for (const slug of djsThisYear) {
    if (djsCompYear.has(slug)) returningDJs++;
    else newDJs++;
  }

  // Track comparison
  const trackKeysThisYear = new Set(tracksThisYear.map(t => t.key));
  const tracksCompYear = allTracksGlobal.filter(t => t.years.includes(compYear));
  const trackKeysCompYear = new Set(tracksCompYear.map(t => t.key));

  let carriedOver = 0;
  let freshTracks = 0;
  for (const key of trackKeysThisYear) {
    if (trackKeysCompYear.has(key)) carriedOver++;
    else freshTracks++;
  }

  const compLabel = compYear === year - 1 ? `${compYear}` : `${compYear}`;

  return `
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div class="card-title">Compared to ${compLabel}</div>
      </div>
      <div style="padding:16px">
        <div style="display:flex;flex-wrap:wrap;gap:20px">
          <!-- DJ comparison -->
          <div style="flex:1;min-width:200px">
            <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:10px;letter-spacing:0.05em">Lineup</div>
            <div style="display:flex;gap:12px;margin-bottom:8px">
              <div class="stat-card" style="flex:1">
                <div class="stat-number" style="color:#3b82f6">${returningDJs}</div>
                <div class="stat-label">Returning DJs</div>
              </div>
              <div class="stat-card" style="flex:1">
                <div class="stat-number" style="color:#22c55e">${newDJs}</div>
                <div class="stat-label">New Faces</div>
              </div>
            </div>
            <!-- DJ bar -->
            <div style="display:flex;height:20px;border-radius:4px;overflow:hidden">
              ${returningDJs > 0 ? `<div style="flex:${returningDJs};background:#3b82f6;min-width:2px" title="Returning: ${returningDJs}"></div>` : ''}
              ${newDJs > 0 ? `<div style="flex:${newDJs};background:#22c55e;min-width:2px" title="New: ${newDJs}"></div>` : ''}
            </div>
          </div>

          <!-- Track comparison -->
          <div style="flex:1;min-width:200px">
            <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:10px;letter-spacing:0.05em">Tracklist</div>
            <div style="display:flex;gap:12px;margin-bottom:8px">
              <div class="stat-card" style="flex:1">
                <div class="stat-number" style="color:#a855f7">${carriedOver}</div>
                <div class="stat-label">Carried Over</div>
              </div>
              <div class="stat-card" style="flex:1">
                <div class="stat-number" style="color:#f59e0b">${freshTracks}</div>
                <div class="stat-label">Fresh Tracks</div>
              </div>
            </div>
            <!-- Track bar -->
            <div style="display:flex;height:20px;border-radius:4px;overflow:hidden">
              ${carriedOver > 0 ? `<div style="flex:${carriedOver};background:#a855f7;min-width:2px" title="Carried over: ${carriedOver}"></div>` : ''}
              ${freshTracks > 0 ? `<div style="flex:${freshTracks};background:#f59e0b;min-width:2px" title="Fresh: ${freshTracks}"></div>` : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ── Wire click handlers ──────────────────────────── */
function wireClickHandlers(container) {
  container.querySelectorAll('.leaderboard-row[data-href]').forEach(row => {
    row.style.cursor = 'pointer';
    addListener(row, 'click', (e) => {
      // Don't navigate if they clicked a link inside the row
      if (e.target.closest('a')) return;
      const href = row.dataset.href;
      if (href) navigateTo(href);
    });
  });
}
