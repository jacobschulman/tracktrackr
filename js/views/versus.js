/**
 * versus.js — DJ Head-to-Head Comparison
 * Route: #/versus or #/versus/{slug1}/{slug2}
 *
 * Two phases: picker (choose two DJs) and comparison (side-by-side stats).
 */

import { getDJHistory, getDJStats, getDJStreak, getDJRepeatRate, loadAllSets, isAllLoaded, trackKey, getTopTracks } from '../data.js?v=5';
import { CONFIG, getStageColor } from '../config.js?v=5';
import { fmt, stageBadge, navigateTo } from '../app.js?v=5';

let _cleanup = [];

export function destroy() {
  _cleanup.forEach(fn => fn());
  _cleanup = [];
}

// ── HTML-escape helper ────────────────────────────
function esc(str) {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

// ── Build sorted unique DJ list from index ────────
function buildDJList(index) {
  const map = new Map();
  for (const s of index.sets) {
    for (const d of s.djs) {
      if (!map.has(d.slug)) {
        map.set(d.slug, d.name);
      }
    }
  }
  return [...map.entries()]
    .map(([slug, name]) => ({ slug, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ── Suggested matchups from index ─────────────────
function buildSuggestions(index) {
  const djYears = new Map();
  const djSets = new Map();

  for (const s of index.sets) {
    for (const d of s.djs) {
      if (!djYears.has(d.slug)) djYears.set(d.slug, { slug: d.slug, name: d.name, years: new Set() });
      djYears.get(d.slug).years.add(s.year);

      if (!djSets.has(d.slug)) djSets.set(d.slug, { slug: d.slug, name: d.name, count: 0 });
      djSets.get(d.slug).count++;
    }
  }

  const byYears = [...djYears.values()].sort((a, b) => b.years.size - a.years.size);
  const bySets = [...djSets.values()].sort((a, b) => b.count - a.count);

  const suggestions = [];
  const seen = new Set();

  function addPair(a, b, label) {
    if (a.slug === b.slug) return;
    const key = [a.slug, b.slug].sort().join('|||');
    if (seen.has(key)) return;
    seen.add(key);
    suggestions.push({ slug1: a.slug, name1: a.name, slug2: b.slug, name2: b.name, label });
  }

  // Most years active
  if (byYears.length >= 2) {
    addPair(byYears[0], byYears[1], 'Most years active');
  }

  // Most total sets
  if (bySets.length >= 2) {
    addPair(bySets[0], bySets[1], 'Most total sets');
  }

  // 3rd and 4th most sets (different matchup)
  if (bySets.length >= 4) {
    addPair(bySets[2], bySets[3], 'Prolific performers');
  }

  // Top of years vs top of sets (if different)
  if (byYears.length >= 1 && bySets.length >= 1) {
    addPair(byYears[0], bySets[0], 'Longevity vs. volume');
  }

  return suggestions.slice(0, 4);
}


// ═══════════════════════════════════════════════════
// Phase 1: Picker
// ═══════════════════════════════════════════════════

function renderPicker(container, index) {
  const djList = buildDJList(index);
  const suggestions = buildSuggestions(index);

  let selectedDJ1 = null;
  let selectedDJ2 = null;

  const suggestionsHtml = suggestions.map(s => `
    <div class="versus-suggestion card" data-slug1="${s.slug1}" data-slug2="${s.slug2}"
         style="cursor:pointer;padding:16px;transition:background var(--transition);"
         onmouseover="this.style.background='var(--surface3)'" onmouseout="this.style.background=''">
      <div style="font-size:0.6875rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted);margin-bottom:8px;">${esc(s.label)}</div>
      <div style="display:flex;align-items:center;gap:8px;justify-content:center;">
        <span style="font-weight:700;font-size:1rem;color:var(--purple-lt);">${esc(s.name1)}</span>
        <span style="color:var(--muted);font-size:0.875rem;">vs</span>
        <span style="font-weight:700;font-size:1rem;color:var(--green);">${esc(s.name2)}</span>
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    <div style="text-align:center;margin-bottom:32px;">
      <h2 style="margin-bottom:8px;">Versus</h2>
      <div style="color:var(--muted);font-size:0.9375rem;">Compare two DJs head-to-head</div>
    </div>

    <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:16px;align-items:start;max-width:700px;margin:0 auto 40px;">
      <!-- DJ 1 Picker -->
      <div class="versus-picker" id="picker-1" style="position:relative;">
        <div id="selected-1" style="display:none;"></div>
        <input type="text" id="input-1" placeholder="Search DJ..."
               autocomplete="off"
               style="width:100%;padding:10px 14px;background:var(--surface2);border:1px solid var(--border-lt);border-radius:var(--radius-sm);color:var(--text);font-size:0.9375rem;outline:none;">
        <div id="dropdown-1" class="versus-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;max-height:240px;overflow-y:auto;background:var(--surface2);border:1px solid var(--border-lt);border-top:none;border-radius:0 0 var(--radius-sm) var(--radius-sm);z-index:10;"></div>
      </div>

      <!-- VS label -->
      <div style="padding-top:10px;font-size:1.25rem;font-weight:900;color:var(--purple-lt);">VS</div>

      <!-- DJ 2 Picker -->
      <div class="versus-picker" id="picker-2" style="position:relative;">
        <div id="selected-2" style="display:none;"></div>
        <input type="text" id="input-2" placeholder="Search DJ..."
               autocomplete="off"
               style="width:100%;padding:10px 14px;background:var(--surface2);border:1px solid var(--border-lt);border-radius:var(--radius-sm);color:var(--text);font-size:0.9375rem;outline:none;">
        <div id="dropdown-2" class="versus-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;max-height:240px;overflow-y:auto;background:var(--surface2);border:1px solid var(--border-lt);border-top:none;border-radius:0 0 var(--radius-sm) var(--radius-sm);z-index:10;"></div>
      </div>
    </div>

    <!-- Compare button -->
    <div style="text-align:center;margin-bottom:40px;">
      <button id="compare-btn" disabled
              style="padding:10px 32px;background:var(--purple-dim);color:var(--muted);border-radius:var(--radius-sm);font-size:0.9375rem;font-weight:600;cursor:not-allowed;transition:all var(--transition);">
        Compare
      </button>
    </div>

    <!-- Suggested Matchups -->
    ${suggestions.length > 0 ? `
    <div style="max-width:700px;margin:0 auto;">
      <div style="font-size:0.8125rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted);margin-bottom:12px;text-align:center;">Suggested Matchups</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">
        ${suggestionsHtml}
      </div>
    </div>
    ` : ''}
  `;

  // ── Picker logic ──────────────────────────────────
  function setupPicker(num) {
    const input = document.getElementById(`input-${num}`);
    const dropdown = document.getElementById(`dropdown-${num}`);
    const selectedDiv = document.getElementById(`selected-${num}`);
    if (!input || !dropdown || !selectedDiv) return;

    let debounceTimer = null;

    function filterDJs(query) {
      const q = query.toLowerCase();
      const otherSlug = num === 1 ? (selectedDJ2 && selectedDJ2.slug) : (selectedDJ1 && selectedDJ1.slug);
      return djList.filter(d =>
        d.name.toLowerCase().includes(q) && d.slug !== otherSlug
      ).slice(0, 20);
    }

    function showDropdown(results) {
      if (results.length === 0) {
        dropdown.style.display = 'none';
        return;
      }
      dropdown.innerHTML = results.map(d => `
        <div class="versus-dropdown-item" data-slug="${d.slug}" data-name="${esc(d.name)}"
             style="padding:8px 14px;cursor:pointer;font-size:0.875rem;transition:background var(--transition);"
             onmouseover="this.style.background='var(--surface3)'" onmouseout="this.style.background=''">
          ${esc(d.name)}
        </div>
      `).join('');
      dropdown.style.display = 'block';

      dropdown.querySelectorAll('.versus-dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
          selectDJ(num, { slug: item.dataset.slug, name: item.dataset.name });
        });
      });
    }

    function onInput() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const q = input.value.trim();
        if (q.length < 1) {
          dropdown.style.display = 'none';
          return;
        }
        showDropdown(filterDJs(q));
      }, 100);
    }

    function onFocus() {
      const q = input.value.trim();
      if (q.length >= 1) {
        showDropdown(filterDJs(q));
      }
    }

    input.addEventListener('input', onInput);
    input.addEventListener('focus', onFocus);
    _cleanup.push(() => {
      input.removeEventListener('input', onInput);
      input.removeEventListener('focus', onFocus);
      clearTimeout(debounceTimer);
    });
  }

  function selectDJ(num, dj) {
    if (num === 1) selectedDJ1 = dj;
    else selectedDJ2 = dj;

    const input = document.getElementById(`input-${num}`);
    const dropdown = document.getElementById(`dropdown-${num}`);
    const selectedDiv = document.getElementById(`selected-${num}`);

    // Show selected pill, hide input
    input.style.display = 'none';
    dropdown.style.display = 'none';
    selectedDiv.style.display = 'block';
    selectedDiv.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--surface2);border:1px solid var(--border-lt);border-radius:var(--radius-sm);">
        <span style="font-weight:600;font-size:0.9375rem;flex:1;color:${num === 1 ? 'var(--purple-lt)' : 'var(--green)'};">${esc(dj.name)}</span>
        <button class="versus-remove" data-num="${num}" style="color:var(--muted);font-size:1rem;line-height:1;padding:2px 6px;border-radius:4px;transition:color var(--transition);"
                onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--muted)'">&times;</button>
      </div>
    `;

    selectedDiv.querySelector('.versus-remove').addEventListener('click', () => {
      deselectDJ(num);
    });

    updateCompareButton();
  }

  function deselectDJ(num) {
    if (num === 1) selectedDJ1 = null;
    else selectedDJ2 = null;

    const input = document.getElementById(`input-${num}`);
    const selectedDiv = document.getElementById(`selected-${num}`);

    selectedDiv.style.display = 'none';
    selectedDiv.innerHTML = '';
    input.style.display = '';
    input.value = '';
    input.focus();

    updateCompareButton();
  }

  function updateCompareButton() {
    const btn = document.getElementById('compare-btn');
    if (!btn) return;
    const ready = selectedDJ1 && selectedDJ2;
    btn.disabled = !ready;
    btn.style.background = ready ? 'var(--purple)' : 'var(--purple-dim)';
    btn.style.color = ready ? 'var(--text-bright)' : 'var(--muted)';
    btn.style.cursor = ready ? 'pointer' : 'not-allowed';
  }

  // Compare button
  const compareBtn = document.getElementById('compare-btn');
  function onCompare() {
    if (selectedDJ1 && selectedDJ2) {
      navigateTo(`#/versus/${selectedDJ1.slug}/${selectedDJ2.slug}`);
    }
  }
  if (compareBtn) {
    compareBtn.addEventListener('click', onCompare);
    _cleanup.push(() => compareBtn.removeEventListener('click', onCompare));
  }

  // Suggestion cards
  container.querySelectorAll('.versus-suggestion').forEach(card => {
    function onClick() {
      navigateTo(`#/versus/${card.dataset.slug1}/${card.dataset.slug2}`);
    }
    card.addEventListener('click', onClick);
    _cleanup.push(() => card.removeEventListener('click', onClick));
  });

  // Close dropdowns on click outside
  function onDocClick(e) {
    if (!e.target.closest('#picker-1')) {
      const dd1 = document.getElementById('dropdown-1');
      if (dd1) dd1.style.display = 'none';
    }
    if (!e.target.closest('#picker-2')) {
      const dd2 = document.getElementById('dropdown-2');
      if (dd2) dd2.style.display = 'none';
    }
  }
  document.addEventListener('click', onDocClick);
  _cleanup.push(() => document.removeEventListener('click', onDocClick));

  setupPicker(1);
  setupPicker(2);
}


// ═══════════════════════════════════════════════════
// Phase 2: Comparison
// ═══════════════════════════════════════════════════

async function renderComparison(container, index, slug1, slug2) {
  // Validate DJs exist
  const history1 = getDJHistory(slug1);
  const history2 = getDJHistory(slug2);

  if (history1.length === 0 || history2.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">?</div>
        <div class="empty-state-text">One or both DJs not found.</div>
        <div style="margin-top:12px;"><a href="#/versus" style="color:var(--purple-lt);">Try another matchup &rarr;</a></div>
      </div>
    `;
    return;
  }

  const djEntry1 = history1[0].djs.find(d => d.slug === slug1);
  const djEntry2 = history2[0].djs.find(d => d.slug === slug2);
  const name1 = djEntry1 ? djEntry1.name : slug1;
  const name2 = djEntry2 ? djEntry2.name : slug2;

  // Show header + loading bar
  container.innerHTML = `
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;">
        <a href="#/dj/${slug1}" style="font-size:1.75rem;font-weight:900;color:var(--purple-lt);text-decoration:none;transition:opacity var(--transition);"
           onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">${esc(name1)}</a>
        <span style="font-size:1.25rem;font-weight:900;color:var(--purple-lt);">vs</span>
        <a href="#/dj/${slug2}" style="font-size:1.75rem;font-weight:900;color:var(--green);text-decoration:none;transition:opacity var(--transition);"
           onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">${esc(name2)}</a>
      </div>
    </div>

    <div id="versus-loading" style="margin-bottom:24px;">
      <div class="progress-label" id="versus-loading-label">Loading sets...</div>
      <div class="progress-bar-container"><div class="progress-bar" id="versus-loading-progress" style="width:0%"></div></div>
    </div>

    <div id="versus-content"></div>
  `;

  // Load all sets
  if (!isAllLoaded()) {
    await loadAllSets(null, (loaded, total) => {
      const pct = Math.round((loaded / total) * 100);
      const label = document.getElementById('versus-loading-label');
      const bar = document.getElementById('versus-loading-progress');
      if (label) label.textContent = `Loading ${loaded} of ${total} sets\u2026 ${pct}%`;
      if (bar) bar.style.width = `${pct}%`;
    });
  }

  const loadingEl = document.getElementById('versus-loading');
  if (loadingEl) loadingEl.style.display = 'none';

  // ── Gather stats ────────────────────────────────
  const stats1 = getDJStats(slug1);
  const stats2 = getDJStats(slug2);
  const streak1 = getDJStreak(slug1);
  const streak2 = getDJStreak(slug2);
  const repeat1 = getDJRepeatRate(slug1);
  const repeat2 = getDJRepeatRate(slug2);

  // ── 1. Tale of the Tape ─────────────────────────
  const tapeRows = [
    {
      label: 'Total Sets',
      v1: stats1 ? stats1.totalSets : 0,
      v2: stats2 ? stats2.totalSets : 0,
      fmt: v => fmt(v),
      higher: 'wins',
    },
    {
      label: 'Years Active',
      v1: stats1 ? stats1.uniqueYears : 0,
      v2: stats2 ? stats2.uniqueYears : 0,
      fmt: v => fmt(v),
      higher: 'wins',
    },
    {
      label: 'Longest Streak',
      v1: streak1.streak,
      v2: streak2.streak,
      fmt: v => v > 1 ? `${v} yrs` : '\u2014',
      higher: 'wins',
    },
    {
      label: 'Unique Tracks',
      v1: repeat1.totalUniqueTracks,
      v2: repeat2.totalUniqueTracks,
      fmt: v => fmt(v),
      higher: 'wins',
    },
    {
      label: 'Track Repeat Rate',
      v1: repeat1.repeatRate,
      v2: repeat2.repeatRate,
      fmt: v => `${(v * 100).toFixed(0)}%`,
      higher: 'consistent', // special case
    },
  ];

  let tapeHtml = '';
  for (const row of tapeRows) {
    let color1, color2, sub1 = '', sub2 = '';

    if (row.higher === 'consistent') {
      // Higher = more consistent, lower = more varied — both get labels
      if (row.v1 > row.v2) {
        color1 = 'var(--green)';
        color2 = 'var(--text)';
        sub1 = '<div style="font-size:0.625rem;color:var(--muted);">More consistent</div>';
        sub2 = '<div style="font-size:0.625rem;color:var(--muted);">More varied</div>';
      } else if (row.v2 > row.v1) {
        color2 = 'var(--green)';
        color1 = 'var(--text)';
        sub2 = '<div style="font-size:0.625rem;color:var(--muted);">More consistent</div>';
        sub1 = '<div style="font-size:0.625rem;color:var(--muted);">More varied</div>';
      } else {
        color1 = 'var(--text)';
        color2 = 'var(--text)';
      }
    } else {
      if (row.v1 > row.v2) {
        color1 = 'var(--green)';
        color2 = 'var(--text)';
      } else if (row.v2 > row.v1) {
        color2 = 'var(--green)';
        color1 = 'var(--text)';
      } else {
        color1 = 'var(--text)';
        color2 = 'var(--text)';
      }
    }

    tapeHtml += `
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="text-align:right;">
          <div style="font-size:1.125rem;font-weight:700;color:${color1};">${row.fmt(row.v1)}</div>
          ${sub1}
        </div>
        <div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted);min-width:100px;text-align:center;">${row.label}</div>
        <div style="text-align:left;">
          <div style="font-size:1.125rem;font-weight:700;color:${color2};">${row.fmt(row.v2)}</div>
          ${sub2}
        </div>
      </div>
    `;
  }

  // ── 2. Timeline Overlap ─────────────────────────
  const years1 = new Set(stats1 ? stats1.years : []);
  const years2 = new Set(stats2 ? stats2.years : []);
  const minYear = CONFIG.years.min;
  const maxYear = CONFIG.years.max;

  let dotsHtml = '';
  let labelsHtml = '';
  let yearsBoth = 0, yearsOnly1 = 0, yearsOnly2 = 0;

  for (let y = minYear; y <= maxYear; y++) {
    const in1 = years1.has(y);
    const in2 = years2.has(y);
    let bg, title;

    if (in1 && in2) {
      bg = 'var(--yellow)';
      title = `${y}: Both`;
      yearsBoth++;
    } else if (in1) {
      bg = 'var(--purple-lt)';
      title = `${y}: ${esc(name1)} only`;
      yearsOnly1++;
    } else if (in2) {
      bg = 'var(--green)';
      title = `${y}: ${esc(name2)} only`;
      yearsOnly2++;
    } else {
      bg = 'var(--border)';
      title = `${y}: Neither`;
    }

    dotsHtml += `<div style="width:12px;height:12px;border-radius:50%;background:${bg};flex-shrink:0;cursor:default;" title="${title}"></div>`;
    const showLabel = (y % 5 === 0) || y === minYear || y === maxYear;
    labelsHtml += `<div style="width:12px;text-align:center;font-size:0.5rem;color:var(--muted);flex-shrink:0;">${showLabel ? y : ''}</div>`;
  }

  // ── 3. Shared Tracks ────────────────────────────
  const tracks1 = getTopTracks(99999, { djSlug: slug1 });
  const tracks2 = getTopTracks(99999, { djSlug: slug2 });

  const trackMap1 = new Map();
  for (const t of tracks1) trackMap1.set(t.key, t);

  const trackMap2 = new Map();
  for (const t of tracks2) trackMap2.set(t.key, t);

  const sharedTracks = [];
  for (const [key, t1] of trackMap1) {
    const t2 = trackMap2.get(key);
    if (t2) {
      sharedTracks.push({
        key,
        artist: t1.artist,
        title: t1.title,
        count1: t1.playCount,
        count2: t2.playCount,
        totalPlays: t1.playCount + t2.playCount,
      });
    }
  }
  sharedTracks.sort((a, b) => b.totalPlays - a.totalPlays);

  let sharedHtml = '';
  if (sharedTracks.length === 0) {
    sharedHtml = '<div style="color:var(--muted);font-size:0.875rem;padding:8px 0;">No shared tracks found.</div>';
  } else {
    const displayTracks = sharedTracks.slice(0, 50);
    sharedHtml = displayTracks.map((t, i) => {
      const encodedKey = encodeURIComponent(t.key);
      return `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 0;${i < displayTracks.length - 1 ? 'border-bottom:1px solid var(--border);' : ''}">
          <span style="color:var(--muted);font-size:0.75rem;width:24px;text-align:right;flex-shrink:0;">${i + 1}</span>
          <div style="flex:1;min-width:0;">
            <a href="#/track/${encodedKey}" class="track-link" style="font-size:0.875rem;">
              <span style="font-weight:600;">${esc(t.artist)}</span>
              <span style="color:var(--muted-lt);"> \u2014 ${esc(t.title)}</span>
            </a>
          </div>
          <span class="pill pill-purple" style="flex-shrink:0;font-size:0.75rem;" title="${esc(name1)}">${t.count1}x</span>
          <span class="pill pill-green" style="flex-shrink:0;font-size:0.75rem;" title="${esc(name2)}">${t.count2}x</span>
        </div>
      `;
    }).join('');

    if (sharedTracks.length > 50) {
      sharedHtml += `<div style="padding:8px 0;font-size:0.75rem;color:var(--muted);">\u2026and ${sharedTracks.length - 50} more shared tracks</div>`;
    }
  }

  // ── 4. Stage Comparison ─────────────────────────
  const stages1 = stats1 ? stats1.stageBreakdown : {};
  const stages2 = stats2 ? stats2.stageBreakdown : {};
  const allStages = new Set([...Object.keys(stages1), ...Object.keys(stages2)]);
  const stageList = [...allStages].sort((a, b) => {
    const total = (v1, v2) => (v1 || 0) + (v2 || 0);
    return total(stages2[b], stages2[a]) - total(stages1[b], stages1[a]) ||
           total(stages1[b], stages1[a]) - total(stages2[b], stages2[a]);
  });
  // Re-sort by combined count descending
  stageList.sort((a, b) => {
    return ((stages1[b] || 0) + (stages2[b] || 0)) - ((stages1[a] || 0) + (stages2[a] || 0));
  });

  const maxStageCount = Math.max(1, ...stageList.map(s => Math.max(stages1[s] || 0, stages2[s] || 0)));

  let stageHtml = '';
  for (const stage of stageList) {
    const c1 = stages1[stage] || 0;
    const c2 = stages2[stage] || 0;
    const color = getStageColor(stage);
    const pct1 = (c1 / maxStageCount) * 100;
    const pct2 = (c2 / maxStageCount) * 100;

    stageHtml += `
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;padding:6px 0;">
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;">
          <span style="font-size:0.75rem;color:var(--muted-lt);flex-shrink:0;">${c1 > 0 ? c1 : ''}</span>
          <div style="height:16px;width:${pct1}%;background:${color};border-radius:4px 0 0 4px;min-width:${c1 > 0 ? '4px' : '0'};margin-left:auto;"></div>
        </div>
        <div style="font-size:0.6875rem;color:var(--muted-lt);min-width:120px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${esc(stage)}">${esc(stage)}</div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="height:16px;width:${pct2}%;background:${color};border-radius:0 4px 4px 0;min-width:${c2 > 0 ? '4px' : '0'};"></div>
          <span style="font-size:0.75rem;color:var(--muted-lt);flex-shrink:0;">${c2 > 0 ? c2 : ''}</span>
        </div>
      </div>
    `;
  }

  // ── Assemble ────────────────────────────────────
  const contentEl = document.getElementById('versus-content');
  if (!contentEl) return;

  contentEl.innerHTML = `
    <!-- Tale of the Tape -->
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header">
        <div class="card-title">Tale of the Tape</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:0;margin-bottom:8px;">
        <div style="text-align:right;font-size:0.8125rem;font-weight:600;color:var(--purple-lt);">${esc(name1)}</div>
        <div style="min-width:100px;"></div>
        <div style="text-align:left;font-size:0.8125rem;font-weight:600;color:var(--green);">${esc(name2)}</div>
      </div>
      ${tapeHtml}
    </div>

    <!-- Timeline Overlap -->
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header">
        <div class="card-title">Timeline Overlap</div>
      </div>
      <div style="overflow-x:auto;">
        <div style="display:flex;gap:4px;align-items:center;min-width:max-content;padding:8px 0;">
          ${dotsHtml}
        </div>
        <div style="display:flex;gap:4px;align-items:center;min-width:max-content;">
          ${labelsHtml}
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:12px;font-size:0.8125rem;">
        <span style="display:flex;align-items:center;gap:6px;">
          <span style="width:10px;height:10px;border-radius:50%;background:var(--yellow);"></span>
          <span style="color:var(--muted-lt);"><strong style="color:var(--text);">${yearsBoth}</strong> years together</span>
        </span>
        <span style="display:flex;align-items:center;gap:6px;">
          <span style="width:10px;height:10px;border-radius:50%;background:var(--purple-lt);"></span>
          <span style="color:var(--muted-lt);"><strong style="color:var(--text);">${yearsOnly1}</strong> only ${esc(name1)}</span>
        </span>
        <span style="display:flex;align-items:center;gap:6px;">
          <span style="width:10px;height:10px;border-radius:50%;background:var(--green);"></span>
          <span style="color:var(--muted-lt);"><strong style="color:var(--text);">${yearsOnly2}</strong> only ${esc(name2)}</span>
        </span>
      </div>
    </div>

    <!-- Shared Tracks -->
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header">
        <div class="card-title">Shared Tracks</div>
        <div class="text-muted" style="font-size:0.75rem;">${sharedTracks.length} track${sharedTracks.length !== 1 ? 's' : ''} in common</div>
      </div>
      ${sharedTracks.length > 0 ? `
      <div style="display:flex;gap:8px;margin-bottom:8px;font-size:0.6875rem;color:var(--muted);">
        <span style="margin-left:auto;"><span class="pill pill-purple" style="font-size:0.625rem;">#</span> = ${esc(name1)}</span>
        <span><span class="pill pill-green" style="font-size:0.625rem;">#</span> = ${esc(name2)}</span>
      </div>
      ` : ''}
      ${sharedHtml}
    </div>

    <!-- Stage Comparison -->
    ${stageList.length > 0 ? `
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header">
        <div class="card-title">Stage Comparison</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:0;margin-bottom:8px;">
        <div style="text-align:right;font-size:0.75rem;font-weight:600;color:var(--purple-lt);">${esc(name1)}</div>
        <div style="min-width:120px;"></div>
        <div style="text-align:left;font-size:0.75rem;font-weight:600;color:var(--green);">${esc(name2)}</div>
      </div>
      ${stageHtml}
    </div>
    ` : ''}

    <!-- Change matchup -->
    <div style="text-align:center;padding:24px 0;">
      <a href="#/versus" style="color:var(--purple-lt);font-size:0.875rem;">Change matchup &rarr;</a>
    </div>
  `;
}


// ═══════════════════════════════════════════════════
// Main render
// ═══════════════════════════════════════════════════

export async function render(container, index, params) {
  const slug1 = params[0];
  const slug2 = params[1];

  if (slug1 && slug2) {
    await renderComparison(container, index, slug1, slug2);
  } else {
    renderPicker(container, index);
  }
}
