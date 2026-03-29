/**
 * dj.js — DJ Detail view (magazine-style layout)
 * Route: #/dj/{slug}
 */

import { getDJHistory, getDJStats, getDJStreak, getDJRepeatRate, getDJPopularTracks, loadSet, loadAllSets, isAllLoaded, trackKey } from '../data.js?v=2';
import { CONFIG, getStageColor } from '../config.js?v=2';
import { fmt, stageBadge, navigateTo } from '../app.js?v=2';

let _cleanup = [];

export function destroy() {
  _cleanup.forEach(fn => fn());
  _cleanup = [];
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

  // Avg ID rate
  const withTracks = history.filter(s => s.tracksTotal > 0);
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
    yearTrackCounts[s.year] = (yearTrackCounts[s.year] || 0) + (s.tracksIdentified || 0);
  }
  const maxTrackCount = Math.max(1, ...Object.values(yearTrackCounts));

  // Build year info map for popup
  const yearInfoMap = {};
  for (const s of history) {
    if (!yearInfoMap[s.year]) yearInfoMap[s.year] = { sets: 0, stages: [], tracks: 0 };
    yearInfoMap[s.year].sets++;
    if (!yearInfoMap[s.year].stages.includes(s.stage)) yearInfoMap[s.year].stages.push(s.stage);
    yearInfoMap[s.year].tracks += (s.tracksIdentified || 0);
  }

  let timelineColsHtml = '';
  for (let y = minYear; y <= maxYear; y++) {
    const active = yearSet.has(y);
    const trackCount = yearTrackCounts[y] || 0;
    const size = active ? Math.max(10, Math.round(8 + 16 * (trackCount / maxTrackCount))) : 6;
    const bg = active ? 'var(--purple-lt)' : 'rgba(100,116,139,0.3)';
    const opacity = active ? '1' : '0.3';
    timelineColsHtml += `<div class="timeline-year-col${active ? ' active' : ''}" data-year="${y}" style="opacity:${opacity};">
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

  const b2bHtml = b2bPartners.length > 0
    ? b2bPartners.map(p =>
      `<a class="dj-link" href="#/dj/${p.slug}" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:var(--surface2);border-radius:8px;font-size:0.8125rem;margin:0 6px 6px 0;">
        ${p.name}
        <span class="pill pill-purple">${p.count}x</span>
        <span style="font-size:0.6875rem;color:var(--muted)">${p.years.join(', ')}</span>
      </a>`
    ).join('')
    : '<div style="color:var(--muted);font-size:0.875rem;">No B2B sets found.</div>';

  // ── Set history table ──────────────────────────────
  const sortedHistory = [...history].sort((a, b) => b.date.localeCompare(a.date));
  const setTableRowsHtml = sortedHistory.map(s => {
    const dateFormatted = formatDate(s.date);
    const duration = s.duration || '\u2014';
    const tracks = s.tracksTotal > 0 ? `${s.tracksIdentified}/${s.tracksTotal}` : '\u2014';
    const url = `https://www.1001tracklists.com/tracklist/${s.tlId}/`;
    return `<tr>
      <td>${dateFormatted}</td>
      <td>${stageBadge(s.stage)}</td>
      <td>${duration}</td>
      <td>${tracks}</td>
      <td><a href="${url}" target="_blank" rel="noopener" class="ext-link" style="color:var(--purple-lt);font-size:0.8125rem;">1001TL</a></td>
    </tr>`;
  }).join('');

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
      <div class="stat-tooltip" data-tip="% of tracks this DJ has played more than once across their Ultra sets — higher = more consistent setlist">
        <div class="stat-card">
          <div class="stat-number" id="dj-repeat-rate">\u2014</div>
          <div class="stat-label">Track Repeat Rate</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-number" id="dj-unique-tracks">\u2014</div>
        <div class="stat-label">Total Unique Tracks</div>
      </div>
    </div>

    <!-- 3. Appearance Timeline -->
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header"><div class="card-title">Appearance Timeline</div></div>
      <div style="overflow-x:auto;position:relative;">
        <div class="timeline-interactive" id="dj-timeline">
          ${timelineColsHtml}
        </div>
        <div class="timeline-popup hidden" id="timeline-popup"></div>
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

    <!-- 5. B2B Partners -->
    ${b2bPartners.length > 0 ? `
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header"><div class="card-title">B2B Partners</div></div>
      <div style="display:flex;flex-wrap:wrap;">
        ${b2bHtml}
      </div>
    </div>` : ''}

    <!-- Loading progress -->
    <div id="dj-loading-bar" style="display:none;margin-bottom:24px;">
      <div class="progress-label" id="dj-loading-label">Loading sets...</div>
      <div class="progress-bar-container"><div class="progress-bar" id="dj-loading-progress" style="width:0%"></div></div>
    </div>

    <!-- 6. Most Played Tracks -->
    <div class="card" style="margin-bottom:24px;" id="most-played-section">
      <div class="card-header">
        <div class="card-title">MOST PLAYED TRACKS</div>
        <div class="text-muted" style="font-size:0.75rem;">Tracks played in 2+ different years</div>
      </div>
      <div id="most-played-list">
        <div style="color:var(--muted);font-size:0.875rem;">Loading...</div>
      </div>
    </div>

    <!-- 7. Their Most Popular Tracks -->
    <div class="card" style="margin-bottom:24px;display:none;" id="popular-tracks-section">
      <div class="card-header">
        <div class="card-title">THEIR MOST POPULAR TRACKS</div>
        <div class="text-muted" style="font-size:0.75rem;">Tracks by ${djName} played by other DJs at Ultra</div>
      </div>
      <div id="popular-tracks-list"></div>
    </div>

    <!-- 8. Set History Table -->
    <div class="card">
      <div class="card-header"><div class="card-title">Set History</div></div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Stage</th>
              <th>Duration</th>
              <th>Tracks</th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody>
            ${setTableRowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // ── Timeline click interaction ─────────────────────
  const timelineEl = document.getElementById('dj-timeline');
  const popupEl = document.getElementById('timeline-popup');
  let activePopupYear = null;

  function showTimelinePopup(yearCol, year) {
    const info = yearInfoMap[year];
    if (!info) return;
    popupEl.innerHTML = `<strong>${year}: ${info.sets} set${info.sets > 1 ? 's' : ''}</strong><br>${info.stages.join(', ')}<br>${info.tracks} tracks ID'd`;
    popupEl.classList.remove('hidden');

    // Position above the dot
    const colRect = yearCol.getBoundingClientRect();
    const containerRect = timelineEl.parentElement.getBoundingClientRect();
    const left = colRect.left - containerRect.left + colRect.width / 2;
    popupEl.style.left = `${left}px`;
    popupEl.style.transform = 'translateX(-50%)';
    popupEl.style.bottom = 'auto';
    popupEl.style.top = `${colRect.top - containerRect.top - popupEl.offsetHeight - 8}px`;
    activePopupYear = year;
  }

  function hideTimelinePopup() {
    popupEl.classList.add('hidden');
    activePopupYear = null;
  }

  function onTimelineClick(e) {
    const col = e.target.closest('.timeline-year-col.active');
    if (!col) {
      hideTimelinePopup();
      return;
    }
    const year = parseInt(col.dataset.year, 10);
    if (activePopupYear === year) {
      hideTimelinePopup();
    } else {
      showTimelinePopup(col, year);
    }
  }

  function onDocumentClick(e) {
    if (!e.target.closest('.timeline-interactive') && !e.target.closest('.timeline-popup')) {
      hideTimelinePopup();
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

  // ── Load all sets for sections 6, 7, and stat updates ──
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

  // ── Section 6: Most Played Tracks ──────────────────
  if (stats) {
    const listEl = document.getElementById('most-played-list');
    if (listEl) {
      if (stats.anthems.length === 0) {
        listEl.innerHTML = '<div style="color:var(--muted);font-size:0.875rem;">No tracks found that were played across multiple years.</div>';
      } else {
        listEl.innerHTML = stats.anthems.map((a, i) => {
          const yearPills = a.years.map(y => `<span class="pill pill-purple" style="margin-right:3px;font-size:0.6875rem;">${y}</span>`).join('');
          const encodedKey = encodeURIComponent(a.key);
          return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
            <span style="color:var(--muted);font-size:0.75rem;width:24px;text-align:right;flex-shrink:0;">${i + 1}</span>
            <a href="#/track/${encodedKey}" class="track-link" style="flex:1;min-width:0;">
              <span style="font-size:0.875rem;font-weight:500;">${a.artist}</span>
              <span style="color:var(--muted);font-size:0.8125rem;"> \u2014 ${a.title}</span>
            </a>
            <div style="display:flex;flex-wrap:wrap;gap:3px;flex-shrink:0;">
              ${yearPills}
            </div>
            <span class="pill" style="flex-shrink:0;">${a.count}x</span>
          </div>`;
        }).join('');
      }
    }
  }

  // ── Section 7: Their Most Popular Tracks ───────────
  const popularTracks = getDJPopularTracks(slug, djName);
  const popularSection = document.getElementById('popular-tracks-section');
  const popularList = document.getElementById('popular-tracks-list');

  if (popularTracks.length > 0 && popularSection && popularList) {
    popularSection.style.display = '';
    popularList.innerHTML = popularTracks.map((t, i) => {
      const encodedKey = encodeURIComponent(t.key);
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
        <span style="color:var(--muted);font-size:0.75rem;width:24px;text-align:right;flex-shrink:0;">${i + 1}</span>
        <a href="#/track/${encodedKey}" class="track-link" style="flex:1;min-width:0;">
          <span style="font-size:0.875rem;font-weight:500;">${t.artist}</span>
          <span style="color:var(--muted);font-size:0.8125rem;"> \u2014 ${t.title}</span>
        </a>
        <span style="font-size:0.75rem;color:var(--muted);flex-shrink:0;">Played by ${t.otherDJCount} other DJ${t.otherDJCount !== 1 ? 's' : ''} (${t.otherDJPlays} times)</span>
      </div>`;
    }).join('');
  }
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
