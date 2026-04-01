/**
 * dj.js — DJ Detail view (story-driven layout)
 * Route: #/dj/{slug}
 *
 * Tells the story of a DJ at Ultra: their patterns, anthems, and actual setlists.
 */

import { getDJHistory, getDJStats, getDJStreak, getDJRepeatRate, getDJPopularTracks, loadSet, loadAllSets, isAllLoaded, trackKey } from '../data.js?v=5';
import { CONFIG, getStageColor } from '../config.js?v=5';
import { fmt, stageBadge, navigateTo } from '../app.js?v=5';

let _cleanup = [];

export function destroy() {
  _cleanup.forEach(fn => fn());
  _cleanup = [];
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

export async function render(container, index, params) {
  const slug = params[0];
  if (!slug) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">?</div><div class="empty-state-text">No DJ specified.</div></div>`;
    return;
  }

  const history = getDJHistory(slug);
  if (history.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">?</div><div class="empty-state-text">DJ not found.</div></div>`;
    return;
  }

  // ── Basic info from index ──────────────────────────
  const djEntry = history[0].djs.find(d => d.slug === slug);
  const djName = djEntry ? djEntry.name : slug;
  const years = [...new Set(history.map(s => s.year))].sort((a, b) => a - b);
  const firstYear = years[0];
  const lastYear = years[years.length - 1];
  const totalSets = history.length;
  const uniqueYears = years.length;
  const streak = getDJStreak(slug);

  // Avg ID rate (tracksTotal is now always computed if set data exists)
  const withTracks = history.filter(s => s.tracksTotal > 0 && s.hasSetFile);
  const avgIdRate = withTracks.length > 0
    ? withTracks.reduce((sum, s) => sum + (s.tracksIdentified / s.tracksTotal), 0) / withTracks.length
    : 0;

  // ── Stage breakdown ────────────────────────────────
  const stageCounts = {};
  for (const s of history) {
    stageCounts[s.stage] = (stageCounts[s.stage] || 0) + 1;
  }
  const sortedStages = Object.entries(stageCounts).sort((a, b) => b[1] - a[1]);

  const stagePillsHtml = sortedStages.map(([stage, count]) => {
    const pct = ((count / totalSets) * 100).toFixed(1);
    const color = getStageColor(stage);
    return `<div style="flex:${count};background:${color};min-width:4px;height:28px;border-radius:4px;position:relative;cursor:default;" title="${stage}: ${count} sets (${pct}%)"></div>`;
  }).join('');

  const stageLegendHtml = sortedStages.map(([stage, count]) => {
    const pct = ((count / totalSets) * 100).toFixed(1);
    const color = getStageColor(stage);
    return `<div style="display:flex;align-items:center;gap:6px;font-size:0.75rem;color:var(--muted-lt);">
      <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></span>
      ${stage} <span style="color:var(--muted)">${count} (${pct}%)</span>
    </div>`;
  }).join('');

  // ── Appearance timeline data ───────────────────────
  const minYear = CONFIG.years.min;
  const maxYear = CONFIG.years.max;
  const yearSet = new Set(years);

  const yearTrackCounts = {};
  for (const s of history) {
    yearTrackCounts[s.year] = (yearTrackCounts[s.year] || 0) + (s.tracksTotal || s.tracksIdentified || 0);
  }
  const maxTrackCount = Math.max(1, ...Object.values(yearTrackCounts));

  // Build year info map
  const yearInfoMap = {};
  for (const s of history) {
    if (!yearInfoMap[s.year]) yearInfoMap[s.year] = { sets: [], stages: [], tracks: 0 };
    yearInfoMap[s.year].sets.push(s);
    if (!yearInfoMap[s.year].stages.includes(s.stage)) yearInfoMap[s.year].stages.push(s.stage);
    yearInfoMap[s.year].tracks += (s.tracksTotal || s.tracksIdentified || 0);
  }

  let timelineColsHtml = '';
  for (let y = minYear; y <= maxYear; y++) {
    const active = yearSet.has(y);
    const trackCount = yearTrackCounts[y] || 0;
    const size = active ? Math.max(10, Math.round(8 + 16 * (trackCount / maxTrackCount))) : 6;
    const bg = active ? 'var(--purple-lt)' : 'rgba(100,116,139,0.3)';
    const opacity = active ? '1' : '0.3';
    timelineColsHtml += `<div class="timeline-year-col${active ? ' active' : ''}" data-year="${y}" style="opacity:${opacity};cursor:${active ? 'pointer' : 'default'};">
      <div class="timeline-dot" style="width:${size}px;height:${size}px;background:${bg};"></div>
      <span class="year-label">${y}</span>
    </div>`;
  }

  // ── B2B partners ───────────────────────────────────
  const b2bMap = new Map();
  for (const s of history) {
    if (s.djs.length > 1) {
      for (const d of s.djs) {
        if (d.slug === slug) continue;
        if (!b2bMap.has(d.slug)) {
          b2bMap.set(d.slug, { slug: d.slug, name: d.name, count: 0, years: [] });
        }
        const p = b2bMap.get(d.slug);
        p.count++;
        if (!p.years.includes(s.year)) p.years.push(s.year);
      }
    }
  }
  const b2bPartners = [...b2bMap.values()].sort((a, b) => b.count - a.count);

  // ── Sets by Year data ──────────────────────────────
  const setsByYear = {};
  for (const s of history) {
    if (!setsByYear[s.year]) setsByYear[s.year] = [];
    setsByYear[s.year].push(s);
  }
  const sortedYears = Object.keys(setsByYear).sort((a, b) => Number(b) - Number(a));

  // ── Render page ────────────────────────────────────
  container.innerHTML = `
    <!-- 1. Hero Header -->
    <div class="dj-hero">
      <h1>${djName}</h1>
      <div class="dj-hero-meta">
        <span class="dj-hero-pill">${firstYear} &rarr; ${lastYear}</span>
        <span class="dj-hero-pill">${totalSets} sets</span>
        <span class="dj-hero-pill">${uniqueYears} years</span>
        ${streak.streak > 1 ? `<span class="dj-hero-pill accent">${streak.streak}yr streak (${streak.startYear}&ndash;${streak.endYear})</span>` : ''}
      </div>
    </div>

    <!-- 2. Stats Row -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-number">${fmt(totalSets)}</div>
        <div class="stat-label">Total Sets</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${uniqueYears}</div>
        <div class="stat-label">Years Active</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${streak.streak > 1 ? streak.streak : '\u2014'}</div>
        <div class="stat-label">Longest Streak</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${(avgIdRate * 100).toFixed(0)}%</div>
        <div class="stat-label">Avg ID Rate</div>
      </div>
      <div class="stat-tooltip" data-tip="% of tracks this DJ has played more than once across their Ultra sets">
        <div class="stat-card">
          <div class="stat-number" id="dj-repeat-rate">\u2014</div>
          <div class="stat-label">Track Repeat Rate</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-number" id="dj-unique-tracks">\u2014</div>
        <div class="stat-label">Unique Tracks</div>
      </div>
    </div>

    <!-- 3. Appearance Timeline -->
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header"><div class="card-title">Appearance Timeline</div></div>
      <div style="overflow-x:auto;position:relative;">
        <div class="timeline-interactive" id="dj-timeline">
          ${timelineColsHtml}
        </div>
        <div id="timeline-expanded" style="overflow:hidden;transition:max-height 0.3s ease;max-height:0;"></div>
      </div>
    </div>

    <!-- 4. Stage Breakdown -->
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header"><div class="card-title">Stage Breakdown</div></div>
      <div style="display:flex;gap:3px;border-radius:6px;overflow:hidden;margin-bottom:12px;">
        ${stagePillsHtml}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px 16px;">
        ${stageLegendHtml}
      </div>
    </div>

    <!-- 5. Signature Tracks (Anthems) -->
    <div class="card" style="margin-bottom:24px;" id="anthems-section">
      <div class="card-header">
        <div class="card-title" style="font-size:1rem;">Signature Tracks</div>
        <div class="text-muted" style="font-size:0.75rem;">Tracks played across 2+ years at Ultra</div>
      </div>
      <div id="anthems-list">
        <div style="color:var(--muted);font-size:0.875rem;padding:8px 0;">Loading track data...</div>
      </div>
    </div>

    <!-- 6. B2B Partners -->
    ${b2bPartners.length > 0 ? `
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header"><div class="card-title">B2B Partners</div></div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${b2bPartners.map(p =>
          `<a class="dj-link" href="#/dj/${p.slug}" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:var(--surface2);border-radius:8px;font-size:0.8125rem;transition:background var(--transition);" onmouseover="this.style.background='var(--surface3)'" onmouseout="this.style.background='var(--surface2)'">
            ${p.name}
            <span class="pill pill-purple">${p.count}x</span>
            <span style="font-size:0.6875rem;color:var(--muted)">${p.years.join(', ')}</span>
          </a>`
        ).join('')}
      </div>
    </div>` : ''}

    <!-- Loading progress -->
    <div id="dj-loading-bar" style="display:none;margin-bottom:24px;">
      <div class="progress-label" id="dj-loading-label">Loading sets...</div>
      <div class="progress-bar-container"><div class="progress-bar" id="dj-loading-progress" style="width:0%"></div></div>
    </div>

    <!-- 7. Sets by Year (Accordions with quick peek) -->
    <div style="margin-bottom:24px;">
      <div style="font-size:1rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-bright);margin-bottom:12px;">Sets by Year</div>
      <div id="sets-by-year">
        ${sortedYears.map(year => {
          const setsThisYear = setsByYear[year];
          const stagesThisYear = [...new Set(setsThisYear.map(s => s.stage))];
          return `
            <div class="accordion-item" data-year="${year}">
              <div class="accordion-header">
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                  <span style="font-weight:700;font-size:1.125rem;color:var(--purple-lt);">${year}</span>
                  <span class="pill">${setsThisYear.length} set${setsThisYear.length > 1 ? 's' : ''}</span>
                  <span style="font-size:0.75rem;color:var(--muted);">${stagesThisYear.join(', ')}</span>
                </div>
                <span class="arrow">&#9654;</span>
              </div>
              <div class="accordion-body">
                <div class="accordion-body-inner" id="year-sets-${year}">
                  <div style="color:var(--muted);font-size:0.8125rem;">Loading...</div>
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>
  `;

  // ── Timeline click interaction ─────────────────────
  const timelineEl = document.getElementById('dj-timeline');
  const expandedEl = document.getElementById('timeline-expanded');
  let activeTimelineYear = null;

  function expandTimelineYear(year) {
    const info = yearInfoMap[year];
    if (!info) return;

    // Highlight the clicked dot
    timelineEl.querySelectorAll('.timeline-year-col').forEach(col => {
      col.style.outline = '';
    });
    const activeCol = timelineEl.querySelector(`.timeline-year-col[data-year="${year}"]`);
    if (activeCol) {
      activeCol.style.outline = '2px solid var(--purple-lt)';
      activeCol.style.outlineOffset = '3px';
      activeCol.style.borderRadius = '8px';
    }

    const setsHtml = info.sets.map(s => {
      const dateStr = formatDate(s.date);
      return `<div style="display:inline-flex;align-items:center;gap:8px;padding:6px 10px;background:var(--surface2);border-radius:8px;font-size:0.8125rem;">
        <span style="color:var(--muted-lt);">${dateStr}</span>
        ${stageBadge(s.stage)}
        ${s.duration ? `<span style="color:var(--muted);font-size:0.75rem;">${s.duration}</span>` : ''}
        <a href="#/set/${s.tlId}" style="color:var(--purple-lt);font-size:0.75rem;">View set &rarr;</a>
      </div>`;
    }).join('');

    expandedEl.innerHTML = `<div style="padding:12px 0;display:flex;flex-wrap:wrap;gap:8px;">
      <div style="font-size:0.8125rem;font-weight:600;color:var(--text-bright);width:100%;margin-bottom:4px;">${year}: ${info.sets.length} set${info.sets.length > 1 ? 's' : ''}, ${info.tracks} tracks ID'd</div>
      ${setsHtml}
    </div>`;
    expandedEl.style.maxHeight = '300px';
    activeTimelineYear = year;
  }

  function collapseTimeline() {
    expandedEl.style.maxHeight = '0';
    timelineEl.querySelectorAll('.timeline-year-col').forEach(col => {
      col.style.outline = '';
    });
    activeTimelineYear = null;
  }

  function onTimelineClick(e) {
    const col = e.target.closest('.timeline-year-col.active');
    if (!col) {
      collapseTimeline();
      return;
    }
    const year = parseInt(col.dataset.year, 10);
    if (activeTimelineYear === year) {
      collapseTimeline();
    } else {
      expandTimelineYear(year);
    }
  }

  function onDocumentClick(e) {
    if (!e.target.closest('.timeline-interactive') && !e.target.closest('#timeline-expanded')) {
      collapseTimeline();
    }
  }

  if (timelineEl) {
    timelineEl.addEventListener('click', onTimelineClick);
    document.addEventListener('click', onDocumentClick);
    _cleanup.push(() => {
      timelineEl.removeEventListener('click', onTimelineClick);
      document.removeEventListener('click', onDocumentClick);
    });
  }

  // ── Year accordion interaction ─────────────────────
  // Track which years have been loaded and opened
  const loadedYears = new Set();
  const setsByYearEl = document.getElementById('sets-by-year');

  if (setsByYearEl) {
    const onAccordionClick = async (e) => {
      const header = e.target.closest('.accordion-header');
      if (!header) return;
      const item = header.closest('.accordion-item');
      if (!item) return;
      const year = item.dataset.year;

      const wasOpen = item.classList.contains('open');
      item.classList.toggle('open');

      // If opening and not yet loaded, load the sets for this year
      if (!wasOpen && !loadedYears.has(year)) {
        loadedYears.add(year);
        const bodyEl = document.getElementById(`year-sets-${year}`);
        if (!bodyEl) return;

        const setsThisYear = setsByYear[year];
        bodyEl.innerHTML = setsThisYear.map(s => {
          const dateStr = formatDate(s.date);
          const stageColor = getStageColor(s.stage);
          return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px 16px;margin-bottom:10px;">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
              <span style="font-size:0.8125rem;color:var(--muted-lt);">${dateStr}</span>
              ${stageBadge(s.stage)}
              ${s.duration ? `<span style="font-size:0.75rem;color:var(--muted);">${s.duration}</span>` : ''}
              <span style="font-size:0.75rem;color:var(--muted);">${s.tracksIdentified > 0 ? `${s.tracksIdentified}/${s.tracksTotal} tracks` : s.hasSetFile ? 'tracks available' : 'no data'}</span>
              <a href="#/set/${s.tlId}" style="color:var(--purple-lt);font-size:0.8125rem;margin-left:auto;">View full set &rarr;</a>
            </div>
            <div id="quick-peek-${s.tlId}" style="border-top:1px solid var(--border);padding-top:8px;">
              <div style="color:var(--muted);font-size:0.75rem;">Loading tracklist...</div>
            </div>
          </div>`;
        }).join('');

        // Load each set and show a quick peek of the first 5 tracks
        for (const s of setsThisYear) {
          loadSet(s.tlId).then(setData => {
            const peekEl = document.getElementById(`quick-peek-${s.tlId}`);
            if (!peekEl || !setData) return;

            const tracks = (setData.tracks || []).filter(t => t.type === 'normal' || t.type === 'blend');
            const previewTracks = tracks.slice(0, 5);

            if (previewTracks.length === 0) {
              peekEl.innerHTML = `<div style="color:var(--muted);font-size:0.75rem;font-style:italic;">No track data available.</div>`;
              return;
            }

            const trackListHtml = previewTracks.map((t, i) => {
              const isID = isIDTrack(t.artist, t.title);
              if (isID) {
                return `<div style="display:flex;align-items:baseline;gap:8px;padding:3px 0;">
                  <span style="color:var(--muted);font-size:0.6875rem;width:18px;text-align:right;flex-shrink:0;">${i + 1}</span>
                  <span style="font-size:0.8125rem;color:var(--muted);">ID \u2014 ID</span>
                </div>`;
              }
              const key = trackKey(t.artist, t.title);
              const encodedKey = encodeURIComponent(key);
              return `<div style="display:flex;align-items:baseline;gap:8px;padding:3px 0;">
                <span style="color:var(--muted);font-size:0.6875rem;width:18px;text-align:right;flex-shrink:0;">${i + 1}</span>
                <a href="#/track/${encodedKey}" class="track-link" style="font-size:0.8125rem;">
                  <span style="font-weight:500;">${t.artist}</span>
                  <span style="color:var(--muted-lt);"> \u2014 ${t.title}</span>
                  ${t.remix ? `<span style="color:var(--muted);font-size:0.75rem;"> (${t.remix})</span>` : ''}
                </a>
              </div>`;
            }).join('');

            const remaining = tracks.length - 5;
            peekEl.innerHTML = `
              ${trackListHtml}
              ${remaining > 0 ? `<a href="#/set/${s.tlId}" style="display:inline-block;margin-top:6px;font-size:0.75rem;color:var(--purple-lt);">+ ${remaining} more tracks \u2014 View full set &rarr;</a>` : ''}
            `;
          });
        }
      }
    };

    setsByYearEl.addEventListener('click', onAccordionClick);
    _cleanup.push(() => {
      setsByYearEl.removeEventListener('click', onAccordionClick);
    });
  }

  // ── Load all sets for anthems, repeat rate, unique tracks ──
  if (!isAllLoaded()) {
    const loadingBar = document.getElementById('dj-loading-bar');
    const loadingLabel = document.getElementById('dj-loading-label');
    const loadingProgress = document.getElementById('dj-loading-progress');
    if (loadingBar) loadingBar.style.display = 'block';

    await loadAllSets(null, (loaded, total) => {
      const pct = Math.round((loaded / total) * 100);
      if (loadingLabel) loadingLabel.textContent = `Loading ${loaded} of ${total} sets\u2026 ${pct}%`;
      if (loadingProgress) loadingProgress.style.width = `${pct}%`;
    });

    if (loadingBar) loadingBar.style.display = 'none';
  }

  // ── Populate loaded-data sections ──────────────────
  const stats = getDJStats(slug);

  // Update repeat rate
  const repeatData = getDJRepeatRate(slug);
  const repeatEl = document.getElementById('dj-repeat-rate');
  if (repeatEl) repeatEl.textContent = `${(repeatData.repeatRate * 100).toFixed(0)}%`;

  // Update unique tracks
  const uniqueTracksEl = document.getElementById('dj-unique-tracks');
  if (uniqueTracksEl) uniqueTracksEl.textContent = fmt(repeatData.totalUniqueTracks);

  // ── Section 5: Signature Tracks (Anthems) ──────────
  if (stats) {
    const listEl = document.getElementById('anthems-list');
    if (listEl) {
      if (stats.anthems.length === 0) {
        listEl.innerHTML = '<div style="color:var(--muted);font-size:0.875rem;padding:8px 0;">No tracks found that were played across multiple years.</div>';
      } else {
        listEl.innerHTML = stats.anthems.map((a, i) => {
          const yearPills = a.years.map(y => `<span class="pill pill-purple" style="margin-right:3px;font-size:0.75rem;">${y}</span>`).join('');
          const encodedKey = encodeURIComponent(a.key);
          return `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;${i < stats.anthems.length - 1 ? 'border-bottom:1px solid var(--border);' : ''}">
            <span style="color:var(--muted);font-size:0.8125rem;width:28px;text-align:right;flex-shrink:0;font-weight:600;">${i + 1}</span>
            <div style="flex:1;min-width:0;">
              <a href="#/track/${encodedKey}" class="track-link" style="font-size:0.9375rem;">
                <span style="font-weight:600;">${a.artist}</span>
                <span style="color:var(--muted-lt);"> \u2014 ${a.title}</span>
              </a>
              <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">
                ${yearPills}
              </div>
            </div>
            <span class="pill pill-purple" style="flex-shrink:0;font-size:0.8125rem;font-weight:600;">${a.count}x</span>
          </div>`;
        }).join('');
      }
    }
  }
}

function isIDTrack(artist, title) {
  const a = (artist || '').toLowerCase().trim();
  const t = (title || '').toLowerCase().trim();
  return a === 'id' || t === 'id' || a === '' || t === '' ||
    t.startsWith('id (') || t === 'id?' || a === 'id?';
}
