/**
 * track.js — Track Detail view
 * Route: #/track/{encodedTrackKey}
 *
 * Typographic layout: champion DJ + cloud instead of bar charts.
 */

import { loadAllSets, isAllLoaded, getTrackHistory, getTrackStreak, getBlendAppearances, trackKey, parseTrackKey } from '../data.js?v=6';
import { CONFIG, getStageColor } from '../config.js?v=6';
import { fmt, stageBadge, navigateTo, playInBar } from '../app.js?v=6';

export function destroy() {}

export async function render(container, index, params) {
  const rawKey = params[0];
  if (!rawKey) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">?</div><div class="empty-state-text">No track specified.</div></div>`;
    return;
  }

  const { artist, title } = parseTrackKey(rawKey);
  if (!artist && !title) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">?</div><div class="empty-state-text">Invalid track key.</div></div>`;
    return;
  }

  const displayArtist = titleCase(artist);
  const displayTitle = titleCase(title);
  const spotifySearch = encodeURIComponent(`${displayArtist} ${displayTitle}`);

  // Show loading state while sets load
  container.innerHTML = `
    <div class="detail-header">
      <h1 class="detail-name">${displayArtist} &mdash; ${displayTitle}</h1>
      <div class="detail-meta">
        <span class="pill pill-purple" id="track-play-count">Loading...</span>
        <a href="https://open.spotify.com/search/${spotifySearch}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;padding:4px 12px;background:var(--green-dim);border-radius:100px;font-size:0.75rem;color:var(--green);text-decoration:none;font-weight:600;transition:opacity var(--transition);" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">&#9835; Spotify</a>
      </div>
    </div>
    <div id="track-loading">
      <div class="progress-label" id="track-loading-label">Loading sets...</div>
      <div class="progress-bar-container"><div class="progress-bar" id="track-loading-progress" style="width:0%"></div></div>
    </div>
    <div id="track-content"></div>
  `;

  // Load all sets if needed
  if (!isAllLoaded()) {
    const loadingEl = document.getElementById('track-loading');
    const loadingLabel = document.getElementById('track-loading-label');
    const loadingProgress = document.getElementById('track-loading-progress');
    if (loadingEl) loadingEl.style.display = 'block';

    await loadAllSets(null, (loaded, total) => {
      const pct = Math.round((loaded / total) * 100);
      if (loadingLabel) loadingLabel.textContent = `Loading ${loaded} of ${total} sets... ${pct}%`;
      if (loadingProgress) loadingProgress.style.width = `${pct}%`;
    });

    if (loadingEl) loadingEl.style.display = 'none';
  }

  // Get track data
  const history = getTrackHistory(artist, title);
  const streak = getTrackStreak(artist, title);
  const blends = getBlendAppearances(artist, title);

  if (history.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">?</div><div class="empty-state-text">Track not found in any set.</div></div>`;
    return;
  }

  // Update play count badge
  const playCountEl = document.getElementById('track-play-count');
  if (playCountEl) {
    const mashupPlays = history.filter(a => a.matchType === 'mashup-inferred').length;
    playCountEl.textContent = mashupPlays > 0
      ? `${history.length} plays (${mashupPlays} via mashup)`
      : `${history.length} play${history.length !== 1 ? 's' : ''}`;
  }

  // ── Orbit Timeline ──────────────────────────────────────────────
  const minYear = CONFIG.years.min;
  const maxYear = CONFIG.years.max;
  const orbitByYear = streak.orbitByYear || {};
  const activeYears = new Set(streak.years || []);
  const maxOrbit = Math.max(1, ...Object.values(orbitByYear));

  let timelineHtml = '';
  let timelineLabelsHtml = '';
  for (let y = minYear; y <= maxYear; y++) {
    const active = activeYears.has(y);
    const djCount = orbitByYear[y] || 0;
    const size = active ? Math.max(10, Math.round(8 + 20 * (djCount / maxOrbit))) : 6;
    const bg = active ? 'var(--green)' : 'transparent';
    const border = active ? 'none' : '1.5px solid var(--border-lt)';
    const tooltipText = active ? `${y}: ${djCount} DJ${djCount !== 1 ? 's' : ''}` : `${y}`;
    timelineHtml += `<div class="timeline-dot" style="width:${size}px;height:${size}px;background:${bg};border:${border};" title="${tooltipText}"></div>`;
    const showLabel = (y % 5 === 0) || y === minYear || y === maxYear;
    timelineLabelsHtml += `<div style="width:${size}px;text-align:center;font-size:0.5625rem;color:var(--muted);flex-shrink:0;">${showLabel ? y : ''}</div>`;
  }

  // ── DJ play counts ──────────────────────────────────────────────
  const djPlayCounts = {};
  const djSlugMap = {};
  const djYearsMap = {};
  for (const a of history) {
    const djName = a.dj;
    djPlayCounts[djName] = (djPlayCounts[djName] || 0) + 1;
    if (a.djSlugs && a.djSlugs[0]) {
      djSlugMap[djName] = a.djSlugs[0];
    }
    if (!djYearsMap[djName]) djYearsMap[djName] = new Set();
    djYearsMap[djName].add(a.year);
  }

  const sortedDJs = Object.entries(djPlayCounts).sort((a, b) => b[1] - a[1]);
  const uniqueDJCount = sortedDJs.length;

  // ── Champion section ────────────────────────────────────────────
  const topDJ = sortedDJs[0];
  const topName = topDJ[0];
  const topCount = topDJ[1];
  const topSlug = djSlugMap[topName] || '';
  const topYears = djYearsMap[topName] ? [...djYearsMap[topName]].sort() : [];
  const topYearsStr = topYears.join(', ');
  const hasChampion = topCount > 1;
  const otherDJCount = uniqueDJCount - 1;

  let championHtml = '';
  if (hasChampion) {
    const nameLink = topSlug
      ? `<a href="#/dj/${topSlug}" style="color:var(--green);text-decoration:none;">${topName}</a>`
      : `<span style="color:var(--green);">${topName}</span>`;
    championHtml = `
      <div class="card" style="margin-bottom:24px;">
        <div class="card-header"><div class="card-title">The Champion</div></div>
        <div style="padding:8px 0 4px;">
          <div style="font-size:1.5rem;font-weight:900;line-height:1.2;">${nameLink}</div>
          <div style="font-size:0.875rem;color:var(--muted);margin-top:6px;">
            played it <strong style="color:var(--text)">${topCount} times</strong> across ${topYearsStr}
          </div>
          ${otherDJCount > 0 ? `<div style="font-size:0.8125rem;color:var(--muted-lt);margin-top:12px;">and ${otherDJCount} other DJ${otherDJCount !== 1 ? 's' : ''}</div>` : ''}
        </div>
      </div>`;
  }

  // ── DJ Cloud ────────────────────────────────────────────────────
  const cloudDJs = hasChampion ? sortedDJs.slice(1) : sortedDJs;
  let cloudHtml = '';
  if (cloudDJs.length > 0) {
    const cloudItems = cloudDJs.map(([name, count]) => {
      const slug = djSlugMap[name] || '';
      const years = djYearsMap[name] ? [...djYearsMap[name]].sort() : [];
      let fontSize, color;
      if (count >= 3) {
        fontSize = '1.125rem';
        color = 'var(--green)';
      } else if (count === 2) {
        fontSize = '1rem';
        color = 'var(--text)';
      } else {
        fontSize = '0.8125rem';
        color = 'var(--muted-lt)';
      }
      const nameEl = slug
        ? `<a href="#/dj/${slug}" style="color:${color};text-decoration:none;font-size:${fontSize};font-weight:${count >= 2 ? '700' : '400'};">${name}</a>`
        : `<span style="color:${color};font-size:${fontSize};font-weight:${count >= 2 ? '700' : '400'};">${name}</span>`;
      return `<div style="text-align:center;">
        ${nameEl}
        <div style="font-size:0.5625rem;color:var(--muted);margin-top:2px;">${years.join(', ')}${count > 1 ? ` (${count}x)` : ''}</div>
      </div>`;
    }).join('');

    const cloudTitle = hasChampion ? 'Also Played By' : 'Played By';
    cloudHtml = `
      <div class="card" style="margin-bottom:24px;">
        <div class="card-header"><div class="card-title">${cloudTitle}</div></div>
        <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:8px 0;">
          ${cloudItems}
        </div>
      </div>`;
  }

  // ── Play History table (with play buttons from recordings) ──────
  const mashupCount = history.filter(a => a.matchType === 'mashup-inferred').length;

  // Pre-load recordings for each set (all cached since loadAllSets already ran)
  const setRecordings = new Map();
  await Promise.all(
    [...new Set(history.map(a => a.tlId).filter(Boolean))].map(async tlId => {
      const sd = await loadSet(tlId);
      if (sd?.recordings?.length) setRecordings.set(tlId, sd.recordings);
    })
  );

  const tableRowsHtml = history.map(a => {
    const djSlug = a.djSlugs && a.djSlugs[0] ? a.djSlugs[0] : '';
    const dateFormatted = formatDate(a.date);
    const inferredBadge = a.matchType === 'mashup-inferred'
      ? ' <span title="Inferred from a mashup/medley entry on 1001Tracklists" style="font-size:0.625rem;color:var(--muted);cursor:help;border:1px solid var(--border);border-radius:4px;padding:1px 4px;">via mashup</span>'
      : '';

    // Play buttons from recordings
    let playBtns = '';
    const recs = a.tlId ? setRecordings.get(a.tlId) : null;
    if (recs) {
      const setTitle = `${a.dj} @ ${a.stage} · Ultra Miami · ${a.year}`;
      const ytRec = recs.find(r => r.platform === 'youtube');
      const scRec = recs.find(r => r.platform === 'soundcloud');
      if (ytRec) {
        playBtns += `<button class="rec-btn rec-btn-yt rec-btn-sm" data-platform="youtube" data-url="${ytRec.url}" data-title="${setTitle}" data-tlid="${a.tlId}">&#9654;</button>`;
      }
      if (scRec) {
        playBtns += `<button class="rec-btn rec-btn-sc rec-btn-sm" data-platform="soundcloud" data-url="${scRec.url}" data-title="${setTitle}" data-tlid="${a.tlId}">&#9654;</button>`;
      }
    }

    return `<tr>
      <td>${a.year}</td>
      <td>${djSlug ? `<a href="#/dj/${djSlug}" class="dj-link">${a.dj}</a>` : a.dj}${inferredBadge}</td>
      <td>${stageBadge(a.stage)}</td>
      <td>${dateFormatted}</td>
      <td style="white-space:nowrap;">${playBtns}${a.tlId ? ` <a href="#/set/${a.tlId}" class="track-link" style="font-size:0.8125rem;">Set</a>` : '—'}</td>
    </tr>`;
  }).join('');

  // ── Blend Appearances ───────────────────────────────────────────
  let blendsHtml = '';
  if (blends.length > 0) {
    blendsHtml = `
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header">
        <div class="card-title">Blend Appearances</div>
        <div class="text-muted" style="font-size:0.75rem;">${blends.length} blend${blends.length !== 1 ? 's' : ''}</div>
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>DJ</th>
              <th>Blended With</th>
              <th>Set</th>
            </tr>
          </thead>
          <tbody>
            ${blends.map(b => {
              const djSlug = b.djSlugs && b.djSlugs[0] ? b.djSlugs[0] : '';
              const pairedLinks = b.pairedWith.map(p => {
                const pKey = trackKey(p.artist, p.title);
                const encoded = encodeURIComponent(pKey);
                return `<a href="#/track/${encoded}" class="track-link" style="font-size:0.8125rem;">${p.artist} — ${p.title}${p.remix ? ' (' + p.remix + ')' : ''}</a>`;
              }).join(', ');
              return `<tr>
                <td>${b.year}</td>
                <td>${djSlug ? `<a href="#/dj/${djSlug}" class="dj-link">${b.dj}</a>` : b.dj}</td>
                <td>${pairedLinks}</td>
                <td>${b.tlId ? `<a href="#/set/${b.tlId}" class="track-link" style="font-size:0.8125rem;">View Set</a>` : '—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  // ── Assemble page ───────────────────────────────────────────────
  const yearSpan = streak.years && streak.years.length > 0
    ? `${Math.min(...streak.years)}–${Math.max(...streak.years)}`
    : '';

  // Update header with year span
  const headerEl = container.querySelector('.detail-meta');
  if (headerEl && yearSpan) {
    const spanBadge = document.createElement('span');
    spanBadge.className = 'pill';
    spanBadge.textContent = yearSpan;
    headerEl.appendChild(spanBadge);
  }

  const contentEl = document.getElementById('track-content');
  if (!contentEl) return;

  contentEl.innerHTML = `
    <div class="stats-row" style="margin-bottom:24px;">
      <div class="stat-card">
        <div class="stat-number">${history.length}</div>
        <div class="stat-label">Plays</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${streak.totalYears}</div>
        <div class="stat-label">Years</div>
      </div>
      ${streak.streak > 1 ? `<div class="stat-card">
        <div class="stat-number">${streak.streak}</div>
        <div class="stat-label">Year Streak</div>
      </div>` : ''}
      <div class="stat-card">
        <div class="stat-number">${uniqueDJCount}</div>
        <div class="stat-label">Unique DJs</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${blends.length}</div>
        <div class="stat-label">Blends</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:24px;">
      <div class="card-header"><div class="card-title">Orbit Timeline</div></div>
      <div style="overflow-x:auto;">
        <div style="display:flex;align-items:center;gap:4px;min-width:max-content;padding:8px 0;">
          ${timelineHtml}
        </div>
        <div style="display:flex;align-items:flex-start;gap:4px;min-width:max-content;">
          ${timelineLabelsHtml}
        </div>
      </div>
      <div style="margin-top:12px;display:flex;gap:16px;font-size:0.75rem;color:var(--muted);">
        <span><strong style="color:var(--text)">${streak.totalYears}</strong> years played</span>
        ${streak.streak > 1 ? `<span><strong style="color:var(--text)">${streak.streak}</strong>-year streak (${streak.startYear}&ndash;${streak.endYear})</span>` : ''}
      </div>
    </div>

    ${championHtml}

    ${cloudHtml}

    <div class="card" style="margin-bottom:24px;">
      <div class="card-header">
        <div class="card-title">Play History</div>
        <div class="text-muted" style="font-size:0.75rem;">${history.length} appearance${history.length !== 1 ? 's' : ''}</div>
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>DJ</th>
              <th>Stage</th>
              <th>Date</th>
              <th>Set</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </div>
    </div>

    ${blendsHtml}
  `;

  // Wire up play buttons in the history table
  contentEl.querySelectorAll('[data-platform]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      playInBar(btn.dataset.platform, btn.dataset.url, btn.dataset.title, btn.dataset.tlid);
    });
  });
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function titleCase(str) {
  if (!str) return '';
  return str.replace(/\b\w/g, c => c.toUpperCase());
}
