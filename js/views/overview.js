/**
 * overview.js — Home page / Overview
 * Leads with the latest festival year as a hook, then reveals
 * track-dependent insights once all sets are loaded.
 */

import { loadAllSets, getTopTracks, isAllLoaded, trackKey, getYearSpotlight } from '../data.js?v=5';
import { CONFIG, getStageColor } from '../config.js?v=5';
import { fmt, stageBadge } from '../app.js?v=5';

export function destroy() {
  // Pure DOM — nothing to tear down
}

export async function render(container, index, params) {
  const latestYear = Math.max(...index.years);
  const spotlight = getYearSpotlight(latestYear);

  if (!spotlight) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-text">No data available for ${latestYear}.</div>
      </div>`;
    return;
  }

  // ── Initial shell (available before sets load) ──────────
  container.innerHTML = `
    <div class="hero-welcome" style="text-align:center;margin-bottom:32px">
      <h1 style="font-size:2.5rem;font-weight:900;letter-spacing:-0.03em;margin:0">
        Ultra ${latestYear}
      </h1>
      <p class="hero-subtitle">The year at a glance</p>
    </div>

    <div class="stat-bar" style="margin-bottom:32px">
      <div class="stat-card">
        <div class="stat-number">${fmt(spotlight.setCount)}</div>
        <div class="stat-label">Sets</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${fmt(spotlight.djCount)}</div>
        <div class="stat-label">DJs</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${fmt(spotlight.stageCount)}</div>
        <div class="stat-label">Stages</div>
      </div>
    </div>

    ${renderDebutsSection(spotlight)}
    ${renderComebacksSection(spotlight)}
    ${renderVeteransSection(spotlight)}

    <div id="overview-loading" style="margin:40px 0">
      <div class="progress-label" id="overview-loading-label">Loading tracklists&hellip;</div>
      <div class="progress-bar-container">
        <div class="progress-bar" id="overview-loading-bar" style="width:0%"></div>
      </div>
    </div>

    <div id="overview-track-sections" style="display:none"></div>
  `;

  // ── Load all sets if needed ─────────────────────────────
  if (!isAllLoaded()) {
    const label = document.getElementById('overview-loading-label');
    const bar = document.getElementById('overview-loading-bar');

    await loadAllSets(null, (loaded, total) => {
      const pct = Math.round((loaded / total) * 100);
      if (label) label.textContent = `Loading ${loaded} of ${total} sets\u2026 ${pct}%`;
      if (bar) bar.style.width = `${pct}%`;
    });
  }

  // Hide progress, show track sections
  const loadingEl = document.getElementById('overview-loading');
  if (loadingEl) loadingEl.style.display = 'none';

  const trackSections = document.getElementById('overview-track-sections');
  if (!trackSections) return;
  trackSections.style.display = 'block';

  // Re-fetch spotlight now that track data is available
  const full = getYearSpotlight(latestYear);
  if (!full) return;

  trackSections.innerHTML = [
    renderTrackOfFestival(full),
    renderRecycler(full),
    renderMostPlayed(full),
  ].join('');

  // Wire click handlers for leaderboard rows and links
  trackSections.querySelectorAll('.leaderboard-row[data-href]').forEach(row => {
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => { location.hash = row.dataset.href; });
  });
}

// ══════════════════════════════════════════════════════════
// Section renderers
// ══════════════════════════════════════════════════════════

function renderTrackOfFestival(spotlight) {
  const tracks = spotlight.topTracks;
  if (!tracks || tracks.length === 0) return '';

  const t = tracks[0];
  const encodedKey = encodeURIComponent(t.key);
  const djList = (t.djs || []).slice(0, 8);

  return `
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div class="card-title">Track of the Festival</div>
      </div>
      <div style="padding:24px 20px;text-align:center">
        <a href="#/track/${encodedKey}" class="track-link"
           style="font-size:1.75rem;font-weight:900;color:var(--green);text-decoration:none;line-height:1.3;display:block">
          ${escHtml(t.artist)} &mdash; ${escHtml(t.title)}
        </a>
        <div style="margin-top:12px;color:var(--muted);font-size:0.9rem">
          Played <strong style="color:var(--green)">${t.playCount}</strong> time${t.playCount !== 1 ? 's' : ''}
          across ${t.djs.length} DJ${t.djs.length !== 1 ? 's' : ''}
        </div>
        <div style="margin-top:14px;display:flex;flex-wrap:wrap;gap:6px;justify-content:center">
          ${djList.map(slug => {
            const name = djDisplayName(slug, spotlight);
            return `<a href="#/dj/${slug}" class="pill pill-purple dj-link" style="text-decoration:none">${escHtml(name)}</a>`;
          }).join('')}
          ${t.djs.length > 8 ? `<span class="pill" style="opacity:0.6">+${t.djs.length - 8} more</span>` : ''}
        </div>
      </div>
    </div>`;
}

function renderRecycler(spotlight) {
  const offenders = spotlight.repeatOffenders;
  if (!offenders || offenders.length === 0) return '';

  const top = offenders[0];
  const previewTracks = top.repeatedTracks.slice(0, 5);

  return `
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div class="card-title">Who Recycled the Most</div>
      </div>
      <div style="padding:24px 20px">
        <div style="text-align:center;margin-bottom:20px">
          <a href="#/dj/${top.slug}" class="dj-link"
             style="font-size:1.5rem;font-weight:900;color:var(--purple-lt);text-decoration:none">
            ${escHtml(top.name)}
          </a>
          <div style="margin-top:8px;color:var(--muted);font-size:0.9rem">
            Brought back <strong style="color:var(--purple-lt)">${top.repeatedTracks.length}</strong>
            track${top.repeatedTracks.length !== 1 ? 's' : ''} from prior years
            <span style="opacity:0.6">(${top.totalTracksThisYear} total in set)</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${previewTracks.map(tr => {
            const encodedKey = encodeURIComponent(tr.key);
            const yearsStr = tr.priorYears.join(', ');
            return `
              <div style="display:flex;align-items:baseline;gap:8px;font-size:0.85rem">
                <a href="#/track/${encodedKey}" class="track-link" style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-decoration:none">
                  ${escHtml(tr.artist)} &mdash; ${escHtml(tr.title)}
                </a>
                <span class="pill pill-purple" style="flex-shrink:0;font-size:0.7rem">${yearsStr}</span>
              </div>`;
          }).join('')}
          ${top.repeatedTracks.length > 5
            ? `<div style="text-align:center;margin-top:4px">
                 <a href="#/dj/${top.slug}" class="dj-link" style="font-size:0.8rem;color:var(--muted);text-decoration:none">
                   View all ${top.repeatedTracks.length} repeated tracks &rarr;
                 </a>
               </div>`
            : ''}
        </div>
      </div>
    </div>`;
}

function renderDebutsSection(spotlight) {
  const debuts = spotlight.debuts;
  if (!debuts || debuts.length === 0) return '';

  return `
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div class="card-title">Fresh Faces</div>
        <span style="font-size:0.75rem;color:var(--muted)">${debuts.length} debut${debuts.length !== 1 ? 's' : ''}</span>
      </div>
      <div style="padding:16px 20px;display:flex;flex-wrap:wrap;gap:8px">
        ${debuts.map(d =>
          `<a href="#/dj/${d.slug}" class="pill pill-green dj-link" style="text-decoration:none">${escHtml(d.name)}</a>`
        ).join('')}
      </div>
    </div>`;
}

function renderComebacksSection(spotlight) {
  const comebacks = spotlight.comebacks;
  if (!comebacks || comebacks.length === 0) return '';

  return `
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div class="card-title">Welcome Back</div>
        <span style="font-size:0.75rem;color:var(--muted)">${comebacks.length} comeback${comebacks.length !== 1 ? 's' : ''}</span>
      </div>
      <div style="padding:16px 20px;display:flex;flex-direction:column;gap:6px">
        ${comebacks.map(d => `
          <div style="display:flex;align-items:center;gap:10px">
            <a href="#/dj/${d.slug}" class="dj-link" style="font-weight:600;text-decoration:none;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              ${escHtml(d.name)}
            </a>
            <span class="pill pill-yellow" style="flex-shrink:0;font-size:0.7rem">back after ${d.gap} yr${d.gap !== 1 ? 's' : ''}</span>
          </div>`
        ).join('')}
      </div>
    </div>`;
}

function renderVeteransSection(spotlight) {
  const veterans = spotlight.veterans;
  if (!veterans || veterans.length === 0) return '';

  return `
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div class="card-title">The Veterans</div>
        <span style="font-size:0.75rem;color:var(--muted)">Longest active streaks</span>
      </div>
      <div style="padding:16px 20px;display:flex;flex-direction:column;gap:6px">
        ${veterans.map(d => `
          <div style="display:flex;align-items:center;gap:10px">
            <a href="#/dj/${d.slug}" class="dj-link" style="font-weight:600;text-decoration:none;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              ${escHtml(d.name)}
            </a>
            <span class="pill pill-purple" style="flex-shrink:0;font-size:0.7rem">${d.streak} yr streak</span>
            <span style="font-size:0.7rem;color:var(--muted);flex-shrink:0">since ${d.since}</span>
          </div>`
        ).join('')}
      </div>
    </div>`;
}

function renderMostPlayed(spotlight) {
  const tracks = spotlight.topTracks;
  if (!tracks || tracks.length === 0) return '';

  const maxPlayCount = tracks[0].playCount;

  return `
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div class="card-title">Most Played This Year</div>
        <span style="font-size:0.75rem;color:var(--muted)">Top 10</span>
      </div>
      ${tracks.map((t, i) => {
        const rank = i + 1;
        const top3class = rank <= 3 ? 'top3' : '';
        const pct = (t.playCount / maxPlayCount) * 100;
        const encodedKey = encodeURIComponent(t.key);

        return `
          <div class="leaderboard-row" data-href="#/track/${encodedKey}">
            <div class="leaderboard-rank ${top3class}">${rank}</div>
            <div class="leaderboard-info">
              <div class="leaderboard-name">${escHtml(t.artist)} &mdash; ${escHtml(t.title)}</div>
              <div class="leaderboard-meta">
                <span>${t.djs.length} DJ${t.djs.length !== 1 ? 's' : ''}</span>
              </div>
              <div class="leaderboard-bar">
                <div class="leaderboard-bar-fill" style="width:${pct}%"></div>
              </div>
            </div>
            <div>
              <div class="leaderboard-count">${t.playCount}</div>
              <div class="leaderboard-count-label">plays</div>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

// ══════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function djDisplayName(slug, spotlight) {
  // Resolve slug to display name from the spotlight's set data
  for (const s of spotlight.sets) {
    for (const d of s.djs) {
      if (d.slug === slug) return d.name;
    }
  }
  return slug;
}
