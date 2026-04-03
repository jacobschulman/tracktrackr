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

function isIDTrack(artist, title) {
  const a = (artist || '').toLowerCase().trim();
  const t = (title || '').toLowerCase().trim();
  return a === 'id' || t === 'id' || a === '' || t === '' ||
    t.startsWith('id (') || t === 'id?' || a === 'id?';
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

  // ── Basic info ──────────────────────────────────────
  const djEntry = history[0].djs.find(d => d.slug === slug);
  const djName = djEntry ? djEntry.name : slug;
  const years = [...new Set(history.map(s => s.year))].sort((a, b) => a - b);
  const firstYear = years[0];
  const lastYear = years[years.length - 1];
  const totalSets = history.length;
  const uniqueYears = years.length;
  const yearSpan = lastYear - firstYear;
  const streak = getDJStreak(slug);

  const withTracks = history.filter(s => s.tracksTotal > 0 && s.hasSetFile);
  const avgIdRate = withTracks.length > 0
    ? withTracks.reduce((sum, s) => sum + (s.tracksIdentified / s.tracksTotal), 0) / withTracks.length
    : 0;

  // ── Stage breakdown ─────────────────────────────────
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

  // ── Visual timeline data ────────────────────────────
  const minYear = CONFIG.years.min;
  const maxYear = CONFIG.years.max;
  const yearSet = new Set(years);

  const yearTrackCounts = {};
  for (const s of history) {
    yearTrackCounts[s.year] = (yearTrackCounts[s.year] || 0) + (s.tracksTotal || s.tracksIdentified || 0);
  }

  const yearInfoMap = {};
  for (const s of history) {
    if (!yearInfoMap[s.year]) yearInfoMap[s.year] = { sets: [], stages: [], tracks: 0 };
    yearInfoMap[s.year].sets.push(s);
    if (!yearInfoMap[s.year].stages.includes(s.stage)) yearInfoMap[s.year].stages.push(s.stage);
    yearInfoMap[s.year].tracks += (s.tracksTotal || s.tracksIdentified || 0);
  }

  // Build visual timeline bars — show all years from first to last, with gaps
  const timelineBarsHtml = [];
  for (let y = firstYear; y <= lastYear; y++) {
    const info = yearInfoMap[y];
    if (info) {
      const stages = info.stages;
      const stageColors = stages.map(s => getStageColor(s));
      const bg = stageColors.length === 1 ? stageColors[0] : `linear-gradient(135deg, ${stageColors.join(', ')})`;
      timelineBarsHtml.push(`<div class="vt-year" data-year="${y}">
        <div class="vt-bar" style="background:${bg};" title="${y}: ${info.sets.length} set${info.sets.length > 1 ? 's' : ''} — ${info.stages.join(', ')}"></div>
        <span class="vt-label">${String(y).slice(-2)}</span>
      </div>`);
    } else {
      timelineBarsHtml.push(`<div class="vt-year vt-gap">
        <div class="vt-bar vt-bar-empty"></div>
        <span class="vt-label">${String(y).slice(-2)}</span>
      </div>`);
    }
  }
  const timelineHtml = timelineBarsHtml.join('');

  // ── B2B partners ────────────────────────────────────
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

  // ── Sets by Year ────────────────────────────────────
  const setsByYear = {};
  for (const s of history) {
    if (!setsByYear[s.year]) setsByYear[s.year] = [];
    setsByYear[s.year].push(s);
  }
  const sortedYears = Object.keys(setsByYear).sort((a, b) => Number(b) - Number(a));
  const mostRecentYear = sortedYears[0];

  // All sets sorted newest-first for the full Sets list
  const allSetsSorted = [...history].sort((a, b) => b.date.localeCompare(a.date));
  const allStages = [...new Set(history.map(s => s.stage))].sort();

  // ── Render ──────────────────────────────────────────
  container.innerHTML = `
    <!-- 1. Hero: Name + Topline -->
    <div class="dj-hero">
      <h1>${djName}</h1>
      <div class="dj-hero-subtitle">
        ${yearSpan > 0 ? `${yearSpan} year span at ${CONFIG.festivalShort}` : `${CONFIG.festivalShort}`}
        <span class="dj-hero-years">${firstYear} &rarr; ${lastYear}</span>
      </div>
      <div class="dj-hero-meta">
        <span class="dj-hero-pill"><strong>${fmt(totalSets)}</strong> set${totalSets !== 1 ? 's' : ''}</span>
        <span class="dj-hero-pill"><strong>${uniqueYears}</strong> year${uniqueYears !== 1 ? 's' : ''}</span>
        ${streak.streak > 1 ? `<span class="dj-hero-pill accent"><strong>${streak.streak}</strong>-year streak</span>` : ''}
      </div>
    </div>

    <!-- 2. Visual Timeline -->
    <div class="card visual-timeline-card" style="margin-bottom:24px;">
      <div class="card-header"><div class="card-title">Timeline</div></div>
      <div class="visual-timeline" id="dj-visual-timeline">
        ${timelineHtml}
      </div>
      <div id="vt-expanded" class="vt-expanded"></div>
    </div>

    <!-- 3. Most Recent Set -->
    <div class="card dj-recent-set-card" style="margin-bottom:24px;">
      <div class="card-header">
        <div class="card-title">Most Recent Set</div>
        <span class="pill pill-purple">${mostRecentYear}</span>
      </div>
      <div id="most-recent-set">
        <div style="color:var(--muted);font-size:0.8125rem;padding:12px 0;">Loading...</div>
      </div>
    </div>

    <!-- 4. All Sets (filterable) -->
    <div class="card" style="margin-bottom:24px;" id="all-sets-section">
      <div class="card-header">
        <div class="card-title">Sets</div>
        <span class="text-muted" style="font-size:0.75rem;">${fmt(totalSets)} total</span>
      </div>
      <div class="sets-filters" id="sets-filters">
        <div class="sets-filter-row">
          <button class="filter-chip active" data-filter-year="all">All Years</button>
          ${sortedYears.map(y => `<button class="filter-chip" data-filter-year="${y}">${y}</button>`).join('')}
        </div>
        ${allStages.length > 1 ? `<div class="sets-filter-row">
          <button class="filter-chip active" data-filter-stage="all">All Stages</button>
          ${allStages.map(s => {
            const color = getStageColor(s);
            return `<button class="filter-chip" data-filter-stage="${s}" style="--chip-color:${color};">${s}</button>`;
          }).join('')}
        </div>` : ''}
      </div>
      <div id="all-sets-list"></div>
      <div id="sets-empty" style="display:none;color:var(--muted);font-size:0.8125rem;padding:12px 0;">No sets match these filters.</div>
    </div>

    <!-- 5. Stats Row (compact) -->
    <div class="stats-row" style="margin-bottom:24px;">
      <div class="stat-card">
        <div class="stat-number" id="dj-unique-tracks">&mdash;</div>
        <div class="stat-label">Unique Tracks</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${(avgIdRate * 100).toFixed(0)}%</div>
        <div class="stat-label">ID Rate</div>
      </div>
      <div class="stat-tooltip" data-tip="% of tracks this DJ has played more than once across their Ultra sets">
        <div class="stat-card">
          <div class="stat-number" id="dj-repeat-rate">&mdash;</div>
          <div class="stat-label">Repeat Rate</div>
        </div>
      </div>
    </div>

    <!-- 6. Stages + B2B side by side -->
    <div class="detail-grid" style="margin-bottom:24px;">
      <div class="card">
        <div class="card-header"><div class="card-title">Stages</div></div>
        <div style="display:flex;gap:3px;border-radius:6px;overflow:hidden;margin-bottom:12px;">
          ${stagePillsHtml}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px 16px;">
          ${stageLegendHtml}
        </div>
      </div>

      ${b2bPartners.length > 0 ? `
      <div class="card">
        <div class="card-header"><div class="card-title">B2B Partners</div></div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${b2bPartners.map(p =>
            `<a class="dj-link" href="#/dj/${p.slug}" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:var(--surface2);border-radius:8px;font-size:0.8125rem;transition:background var(--transition);" onmouseover="this.style.background='var(--surface3)'" onmouseout="this.style.background='var(--surface2)'">
              ${p.name}
              <span class="count-badge">${p.count}x</span>
              <span style="font-size:0.6875rem;color:var(--muted)">${p.years.join(', ')}</span>
            </a>`
          ).join('')}
        </div>
      </div>` : ''}
    </div>

    <!-- Loading progress -->
    <div id="dj-loading-bar" style="display:none;margin-bottom:24px;">
      <div class="progress-label" id="dj-loading-label">Loading sets...</div>
      <div class="progress-bar-container"><div class="progress-bar" id="dj-loading-progress" style="width:0%"></div></div>
    </div>

    <!-- 7. Signature Tracks -->
    <div class="card" style="margin-bottom:24px;" id="anthems-section">
      <div class="card-header">
        <div class="card-title">Signature Tracks</div>
        <div class="text-muted" style="font-size:0.75rem;">Played across 2+ years</div>
      </div>
      <div id="anthems-list">
        <div style="color:var(--muted);font-size:0.875rem;padding:8px 0;">Loading track data...</div>
      </div>
    </div>

    <!-- 8. Most Supported -->
    <div class="card" style="margin-bottom:24px;" id="most-supported-section">
      <div class="card-header">
        <div class="card-title">Most Supported</div>
        <div class="text-muted" style="font-size:0.75rem;">Tracks by ${djName} played by other DJs</div>
      </div>
      <div id="most-supported-list">
        <div style="color:var(--muted);font-size:0.875rem;padding:8px 0;">Loading...</div>
      </div>
    </div>
  `;

  // ── Visual Timeline interaction ─────────────────────
  const vtEl = document.getElementById('dj-visual-timeline');
  const vtExpanded = document.getElementById('vt-expanded');
  let activeVtYear = null;

  function expandVtYear(year) {
    const info = yearInfoMap[year];
    if (!info) return;

    vtEl.querySelectorAll('.vt-year').forEach(el => el.classList.remove('active'));
    const activeEl = vtEl.querySelector(`.vt-year[data-year="${year}"]`);
    if (activeEl) activeEl.classList.add('active');

    const setsHtml = info.sets.map(s => {
      const dateStr = formatDate(s.date);
      return `<div style="display:inline-flex;align-items:center;gap:8px;padding:6px 10px;background:var(--surface);border-radius:8px;font-size:0.8125rem;">
        <span style="color:var(--muted-lt);">${dateStr}</span>
        ${stageBadge(s.stage)}
        ${s.duration ? `<span style="color:var(--muted);font-size:0.75rem;">${s.duration}</span>` : ''}
        <a href="#/set/${s.tlId}" style="color:var(--purple-lt);font-size:0.75rem;">View set &rarr;</a>
      </div>`;
    }).join('');

    vtExpanded.innerHTML = `<div style="padding:12px 0;display:flex;flex-wrap:wrap;gap:8px;">
      <div style="font-size:0.8125rem;font-weight:600;color:var(--text-bright);width:100%;margin-bottom:4px;">${year}: ${info.sets.length} set${info.sets.length > 1 ? 's' : ''}, ${info.tracks} tracks ID'd</div>
      ${setsHtml}
    </div>`;
    vtExpanded.classList.add('open');
    activeVtYear = year;
  }

  function collapseVt() {
    vtExpanded.classList.remove('open');
    vtEl.querySelectorAll('.vt-year').forEach(el => el.classList.remove('active'));
    activeVtYear = null;
  }

  if (vtEl) {
    vtEl.addEventListener('click', (e) => {
      const yearEl = e.target.closest('.vt-year');
      if (!yearEl) { collapseVt(); return; }
      const year = parseInt(yearEl.dataset.year, 10);
      if (activeVtYear === year) collapseVt();
      else expandVtYear(year);
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.visual-timeline-card')) collapseVt();
    });
  }

  // ── Most Recent Set: load and render ────────────────
  const recentSets = setsByYear[mostRecentYear];
  const recentContainer = document.getElementById('most-recent-set');
  if (recentContainer && recentSets) {
    renderSetCards(recentSets, recentContainer, true);
  }

  // ── All Sets: render + filter ───────────────────────
  const setsListEl = document.getElementById('all-sets-list');
  const setsEmptyEl = document.getElementById('sets-empty');
  const filtersEl = document.getElementById('sets-filters');
  let activeFilterYear = 'all';
  let activeFilterStage = 'all';

  function renderFilteredSets() {
    const filtered = allSetsSorted.filter(s => {
      if (activeFilterYear !== 'all' && String(s.year) !== activeFilterYear) return false;
      if (activeFilterStage !== 'all' && s.stage !== activeFilterStage) return false;
      return true;
    });

    if (filtered.length === 0) {
      setsListEl.innerHTML = '';
      if (setsEmptyEl) setsEmptyEl.style.display = 'block';
      return;
    }
    if (setsEmptyEl) setsEmptyEl.style.display = 'none';
    renderSetCards(filtered, setsListEl, false);
  }

  if (filtersEl) {
    filtersEl.addEventListener('click', (e) => {
      const chip = e.target.closest('.filter-chip');
      if (!chip) return;

      if (chip.dataset.filterYear) {
        activeFilterYear = chip.dataset.filterYear;
        filtersEl.querySelectorAll('[data-filter-year]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      }
      if (chip.dataset.filterStage) {
        activeFilterStage = chip.dataset.filterStage;
        filtersEl.querySelectorAll('[data-filter-stage]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      }
      renderFilteredSets();
    });
  }

  // Initial render of all sets
  if (setsListEl) renderFilteredSets();

  // ── Load all sets for anthems, stats ─────────────────
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

  // ── Populate computed sections ──────────────────────
  const stats = getDJStats(slug);

  // Repeat rate + unique tracks
  const repeatData = getDJRepeatRate(slug);
  const repeatEl = document.getElementById('dj-repeat-rate');
  if (repeatEl) repeatEl.textContent = `${(repeatData.repeatRate * 100).toFixed(0)}%`;
  const uniqueTracksEl = document.getElementById('dj-unique-tracks');
  if (uniqueTracksEl) uniqueTracksEl.textContent = fmt(repeatData.totalUniqueTracks);

  // Signature Tracks
  if (stats) {
    const listEl = document.getElementById('anthems-list');
    if (listEl) {
      if (stats.anthems.length === 0) {
        listEl.innerHTML = '<div style="color:var(--muted);font-size:0.875rem;padding:8px 0;">No tracks found that were played across multiple years.</div>';
      } else {
        listEl.innerHTML = stats.anthems.map((a, i) => {
          const yearTags = a.years.map(y => `<span class="year-tag">${y}</span>`).join('');
          const encodedKey = encodeURIComponent(a.key);
          return `<div class="track-row${i < stats.anthems.length - 1 ? '' : ' last'}">
            <span class="track-row-num">${i + 1}</span>
            <div style="flex:1;min-width:0;">
              <a href="#/track/${encodedKey}" class="track-link" style="font-size:0.875rem;">
                <span style="font-weight:600;">${a.artist}</span>
                <span style="color:var(--muted-lt);"> \u2014 ${a.title}</span>
              </a>
              <div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px;">
                ${yearTags}
              </div>
            </div>
            <span class="count-badge">${a.count}x</span>
          </div>`;
        }).join('');
      }
    }
  }

  // Most Supported
  const popularTracks = getDJPopularTracks(slug, djName);
  const supportedEl = document.getElementById('most-supported-list');
  const supportedSection = document.getElementById('most-supported-section');
  if (supportedEl) {
    if (popularTracks.length === 0) {
      if (supportedSection) supportedSection.style.display = 'none';
    } else {
      const maxSupported = Math.min(popularTracks.length, 15);
      supportedEl.innerHTML = popularTracks.slice(0, maxSupported).map((t, i) => {
        const encodedKey = encodeURIComponent(t.key);
        const djNames = t.otherDJs.slice(0, 5);
        const moreCount = t.otherDJs.length - 5;
        return `<div class="track-row${i < maxSupported - 1 ? '' : ' last'}">
          <span class="track-row-num">${i + 1}</span>
          <div style="flex:1;min-width:0;">
            <a href="#/track/${encodedKey}" class="track-link" style="font-size:0.875rem;">
              <span style="font-weight:600;">${t.artist}</span>
              <span style="color:var(--muted-lt);"> \u2014 ${t.title}</span>
            </a>
            <div style="font-size:0.75rem;color:var(--muted);margin-top:3px;">
              Played by ${djNames.join(', ')}${moreCount > 0 ? ` +${moreCount} more` : ''}
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <span class="count-badge">${t.otherDJCount} DJs</span>
            <div style="font-size:0.6875rem;color:var(--muted);margin-top:2px;">${t.otherDJPlays}x played</div>
          </div>
        </div>`;
      }).join('');
    }
  }
}

// ── Render set cards (used for recent set + expanded year) ──
async function renderSetCards(sets, container, prominent) {
  const cards = [];

  for (const s of sets) {
    const dateStr = formatDate(s.date);
    const cardId = `setcard-${s.tlId}`;
    cards.push(`<div class="set-card${prominent ? ' set-card-prominent' : ''}" id="${cardId}">
      <div class="set-card-header">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          ${!prominent ? `<span style="font-weight:700;font-size:0.875rem;color:var(--purple-lt);">${s.year}</span>` : ''}
          <span style="font-size:0.8125rem;color:var(--muted-lt);">${dateStr}</span>
          ${stageBadge(s.stage)}
          ${s.duration ? `<span style="font-size:0.75rem;color:var(--muted);">${s.duration}</span>` : ''}
          <span style="font-size:0.75rem;color:var(--muted);">${s.tracksIdentified > 0 ? `${s.tracksIdentified}/${s.tracksTotal} tracks` : s.hasSetFile ? 'tracks available' : 'no data'}</span>
        </div>
        <a href="#/set/${s.tlId}" style="color:var(--purple-lt);font-size:0.8125rem;white-space:nowrap;">View full set &rarr;</a>
      </div>
      <div class="set-card-recordings" id="rec-${s.tlId}"></div>
      <div class="set-card-tracks" id="tracks-${s.tlId}">
        <div style="color:var(--muted);font-size:0.75rem;">Loading tracklist...</div>
      </div>
    </div>`);
  }

  container.innerHTML = cards.join('');

  // Load each set's data
  for (const s of sets) {
    loadSet(s.tlId).then(setData => {
      if (!setData) return;

      // Recordings — prominent player area
      const recEl = document.getElementById(`rec-${s.tlId}`);
      if (recEl) {
        const recordings = setData.recordings || [];
        const ytRec = recordings.find(r => r.platform === 'youtube');
        const scRec = recordings.find(r => r.platform === 'soundcloud');
        const spotifyRec = recordings.find(r => r.platform === 'source_36');
        const parts = [];

        if (ytRec) {
          const ytId = ytRec.url.includes('youtube.com/watch') ? new URL(ytRec.url).searchParams.get('v') : ytRec.url.split('/').pop();
          if (prominent) {
            parts.push(`<div class="rec-embed rec-yt">
              <iframe width="100%" height="180" src="https://www.youtube.com/embed/${ytId}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
            </div>`);
          } else {
            parts.push(`<a href="https://www.youtube.com/watch?v=${ytId}" target="_blank" rel="noopener" class="rec-btn rec-btn-yt">&#9654; YouTube</a>`);
          }
        }

        if (spotifyRec) {
          // Spotify embed URLs from data are already in embed format
          let embedUrl = spotifyRec.url;
          // Ensure it uses the compact embed size
          if (!embedUrl.includes('embed')) {
            embedUrl = embedUrl.replace('open.spotify.com/', 'open.spotify.com/embed/');
          }
          parts.push(`<div class="rec-embed rec-spotify">
            <iframe src="${embedUrl}" width="100%" height="${prominent ? '152' : '80'}" frameborder="0" allow="encrypted-media" loading="lazy"></iframe>
          </div>`);
        }

        if (scRec) {
          const scWidgetUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(scRec.url)}&color=%23f97316&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=false`;
          parts.push(`<div class="rec-embed rec-sc">
            <iframe width="100%" height="${prominent ? '120' : '20'}" scrolling="no" frameborder="no" src="${scWidgetUrl}"></iframe>
          </div>`);
        }

        if (parts.length) {
          recEl.innerHTML = parts.join('');
          recEl.style.display = 'flex';
        }
      }

      // Tracklist preview
      const tracksEl = document.getElementById(`tracks-${s.tlId}`);
      if (tracksEl) {
        const tracks = (setData.tracks || []).filter(t => t.type === 'normal' || t.type === 'blend');
        const previewCount = prominent ? 8 : 5;
        const previewTracks = tracks.slice(0, previewCount);

        if (previewTracks.length === 0) {
          tracksEl.innerHTML = `<div style="color:var(--muted);font-size:0.75rem;font-style:italic;">No track data available.</div>`;
          return;
        }

        const trackListHtml = previewTracks.map((t, i) => {
          if (isIDTrack(t.artist, t.title)) {
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

        const remaining = tracks.length - previewCount;
        tracksEl.innerHTML = `
          ${trackListHtml}
          ${remaining > 0 ? `<a href="#/set/${s.tlId}" style="display:inline-block;margin-top:6px;font-size:0.75rem;color:var(--purple-lt);">+ ${remaining} more tracks \u2014 View full set &rarr;</a>` : ''}
        `;
      }
    });
  }
}
