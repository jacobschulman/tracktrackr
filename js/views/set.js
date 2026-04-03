/**
 * set.js — Set Detail view
 * Route: #/set/{tlId}
 * Shows a full setlist with links to tracks, DJ anthems highlighted
 */

import { loadSet, loadAllSets, isAllLoaded, getTrackHistory, trackKey, getDJHistory } from '../data.js?v=5';
import { CONFIG, getStageColor } from '../config.js?v=5';
import { fmt, stageBadge, navigateTo, playInBar } from '../app.js?v=5';

export function destroy() {}

export async function render(container, index, params) {
  const tlId = params[0];
  if (!tlId) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">?</div><div class="empty-state-text">No set specified.</div></div>`;
    return;
  }

  // Load this specific set
  const setData = await loadSet(tlId);
  if (!setData) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">?</div><div class="empty-state-text">Set not found.</div></div>`;
    return;
  }

  const djSlug = setData.djs?.[0]?.slug || '';
  const djName = setData.dj || 'Unknown DJ';
  const dateFormatted = formatDate(setData.date);
  const stageColor = getStageColor(setData.stage);

  // Find other sets on same stage same day
  const sameDaySets = index.sets.filter(s =>
    s.date === setData.date && s.stage === setData.stage && s.tlId !== tlId
  ).sort((a, b) => a.date.localeCompare(b.date));

  // Find DJ's other sets at Ultra
  const djHistory = djSlug ? getDJHistory(djSlug) : [];
  const otherSets = djHistory.filter(s => s.tlId !== tlId);

  // Build the track list HTML
  const tracks = setData.tracks || [];
  const normalTracks = tracks.filter(t => t.type === 'normal' || t.type === 'blend');

  // Build recording play buttons (persistent player bar)
  const recordings = setData.recordings || [];
  const ytRec = recordings.find(r => r.platform === 'youtube');
  const scRec = recordings.find(r => r.platform === 'soundcloud');
  const setTitle = `${djName} @ ${setData.stage} · Ultra Miami · ${setData.year}`;
  let recordingLinksHtml = '';
  if (ytRec || scRec) {
    let btns = '';
    if (ytRec) {
      btns += `<button class="rec-btn rec-btn-yt" data-platform="youtube" data-url="${ytRec.url}" data-title="${setTitle}" data-tlid="${tlId}">&#9654; Play on YouTube</button>`;
    }
    if (scRec) {
      btns += `<button class="rec-btn rec-btn-sc" data-platform="soundcloud" data-url="${scRec.url}" data-title="${setTitle}" data-tlid="${tlId}">&#9654; Play on SoundCloud</button>`;
    }
    recordingLinksHtml = `<div class="set-play-btns" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;">${btns}</div>`;
  }

  container.innerHTML = `
    <div class="set-detail-hero" style="border-left: 4px solid ${stageColor}; padding-left: 20px; margin-bottom: 32px;">
      <div style="font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">${setData.year} &middot; ${setData.stage}</div>
      <h1 style="margin-bottom: 8px;">
        ${djSlug ? `<a href="#/dj/${djSlug}" class="dj-link" style="color: var(--text-bright);">${djName}</a>` : djName}
      </h1>
      <div class="detail-meta">
        <span>${dateFormatted}</span>
        <span class="separator">&middot;</span>
        ${stageBadge(setData.stage)}
        ${setData.duration ? `<span class="separator">&middot;</span><span>${setData.duration}</span>` : ''}
        <span class="separator">&middot;</span>
        <span>${normalTracks.length} tracks</span>
        <span class="separator">&middot;</span>
        <a href="https://www.1001tracklists.com/tracklist/${tlId}/" target="_blank" rel="noopener" class="ext-link" style="color:var(--purple-lt);font-size:0.8125rem;">1001Tracklists</a>
      </div>
      ${recordingLinksHtml}
    </div>

    ${otherSets.length > 0 ? `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px;">
      <span style="font-size:0.75rem;color:var(--muted);align-self:center;">${djName} at Ultra:</span>
      ${otherSets.slice(0, 12).map(s => `
        <a href="#/set/${s.tlId}" class="pill${s.year === setData.year ? ' pill-purple' : ''}" style="cursor:pointer;font-size:0.6875rem;">${s.year} ${s.stage === setData.stage ? '' : '&middot; ' + s.stage.split(' ')[0]}</a>
      `).join('')}
      ${otherSets.length > 12 ? `<a href="#/dj/${djSlug}" class="pill" style="cursor:pointer;font-size:0.6875rem;">+${otherSets.length - 12} more</a>` : ''}
    </div>` : ''}

    <div class="card" style="margin-bottom:24px;">
      <div class="card-header">
        <div class="card-title">Tracklist</div>
        <div class="text-muted" style="font-size:0.75rem;">${setData.tracksIdentified} of ${setData.tracksTotal} identified</div>
      </div>
      <div id="set-tracklist"></div>
    </div>

    ${sameDaySets.length > 0 ? `
    <div class="card">
      <div class="card-header">
        <div class="card-title">Also on ${setData.stage} &middot; ${dateFormatted}</div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${sameDaySets.map(s => `
          <a href="#/set/${s.tlId}" style="display:flex;align-items:center;gap:6px;padding:8px 14px;background:var(--surface2);border-radius:8px;font-size:0.8125rem;cursor:pointer;transition:background var(--transition);" onmouseover="this.style.background='var(--surface3)'" onmouseout="this.style.background='var(--surface2)'">
            ${s.djs.map(d => d.name).join(' & ')}
          </a>
        `).join('')}
      </div>
    </div>` : ''}

    <div id="set-loading" style="display:none;margin-top:24px;">
      <div class="progress-label" id="set-loading-label">Loading all sets for cross-references...</div>
      <div class="progress-bar-container"><div class="progress-bar" id="set-loading-progress" style="width:0%"></div></div>
    </div>
  `;

  // Wire up play buttons for persistent player bar
  container.querySelectorAll('.set-play-btns [data-platform]').forEach(btn => {
    btn.addEventListener('click', () => {
      playInBar(btn.dataset.platform, btn.dataset.url, btn.dataset.title, btn.dataset.tlid);
    });
  });

  // Render basic tracklist immediately
  renderTracklist(tracks, false, null, setData, djSlug);

  // Then load all sets for cross-reference data
  if (!isAllLoaded()) {
    const loadingEl = document.getElementById('set-loading');
    if (loadingEl) loadingEl.style.display = 'block';
    await loadAllSets(null, (loaded, total) => {
      const pct = Math.round((loaded / total) * 100);
      const label = document.getElementById('set-loading-label');
      const bar = document.getElementById('set-loading-progress');
      if (label) label.textContent = `Loading ${loaded} of ${total} sets... ${pct}%`;
      if (bar) bar.style.width = `${pct}%`;
    });
    if (loadingEl) loadingEl.style.display = 'none';
  }

  // Re-render tracklist with cross-reference data
  renderTracklist(tracks, true, index, setData, djSlug);
}

function renderTracklist(tracks, enriched, index, setData, djSlug) {
  const el = document.getElementById('set-tracklist');
  if (!el) return;

  // If enriched, build a map of which tracks the DJ played in other years
  let djAnthems = new Map(); // trackKey -> [years]
  let trackPopularity = new Map(); // trackKey -> number of other DJs

  if (enriched) {
    // Find DJ's anthem tracks (played in other years)
    for (const t of tracks) {
      if (t.type !== 'normal' && t.type !== 'blend') continue;
      if (isIDTrack(t.artist, t.title)) continue;
      const key = trackKey(t.artist, t.title);
      const history = getTrackHistory(t.artist, t.title);
      if (history.length > 0) {
        // Years this DJ played this track (excluding this set's year to check other years)
        const djYears = history
          .filter(a => a.djSlugs?.includes(djSlug) && a.year !== setData.year)
          .map(a => a.year);
        if (djYears.length > 0) {
          djAnthems.set(key, [...new Set(djYears)].sort((a, b) => a - b));
        }
        // Other DJs who played this
        const otherDJs = new Set(history.filter(a => !a.djSlugs?.includes(djSlug)).map(a => a.dj));
        if (otherDJs.size > 0) {
          trackPopularity.set(key, otherDJs.size);
        }
      }
    }
  }

  // Build a set of trackIds that appear in a parent's blendGroup,
  // so we can suppress duplicate w/ rows for those
  const blendGroupTrackIds = new Set();
  for (const t of tracks) {
    if (t.type === 'normal' && t.blendGroup && t.blendGroup.length >= 2) {
      for (const bg of t.blendGroup) {
        if (bg.trackId && bg.trackId !== t.trackId) blendGroupTrackIds.add(bg.trackId);
      }
    }
  }

  let html = '';

  for (const t of tracks) {
    const isID = isIDTrack(t.artist, t.title);
    const key = !isID ? trackKey(t.artist, t.title) : null;
    const encodedKey = key ? encodeURIComponent(key) : null;

    // Anthem badge (only for normal tracks in enriched mode)
    const anthemYears = key ? djAnthems.get(key) : null;
    const otherDJCount = key ? trackPopularity.get(key) : null;

    // Skip blend-type tracks whose trackId is already shown in a parent's blendGroup
    if (t.type === 'blend' && t.trackId && blendGroupTrackIds.has(t.trackId)) {
      continue;
    }

    if (isID) {
      html += `
        <div class="set-track" style="opacity:0.4;">
          <div class="set-track-pos">${t.pos || ''}</div>
          <div class="set-track-info">
            <span style="font-size:0.8125rem;color:var(--muted);">ID &mdash; ID</span>
          </div>
        </div>`;
      continue;
    }

    // Render blend indicator if this normal track has a blendGroup
    const hasBlend = t.blendGroup && t.blendGroup.length >= 2;
    const blendHtml = hasBlend ? (() => {
      const blendTracks = t.blendGroup.filter(bg => !isIDTrack(bg.artist, bg.title) && bg.trackId !== t.trackId);
      if (blendTracks.length === 0) return '';
      return `<div class="set-track blend-track" style="margin-left:28px;border-left:2px solid var(--pink);padding-left:12px;">
          <div class="set-track-pos" style="color:var(--pink);font-size:0.75rem;">w/</div>
          <div class="set-track-info">
            ${blendTracks.map(bg => {
              const bgKey = trackKey(bg.artist, bg.title);
              const bgEncoded = encodeURIComponent(bgKey);
              return `<a href="#/track/${bgEncoded}" class="track-link" style="font-size:0.8125rem;">${bg.artist} &mdash; ${bg.title}${bg.remix ? ' (' + bg.remix + ')' : ''}</a>`;
            }).join(' <span style="color:var(--muted);font-size:0.6875rem;">+</span> ')}
          </div>
        </div>`;
    })() : '';

    if (t.type === 'blend') {
      // Standalone w/ track not covered by a parent — render as indented blend row
      html += `
        <div class="set-track blend-track" style="margin-left:28px;border-left:2px solid var(--pink);padding-left:12px;">
          <div class="set-track-pos" style="color:var(--pink);font-size:0.75rem;">w/</div>
          <div class="set-track-info">
            <a href="#/track/${encodedKey}" class="track-link" style="font-size:0.8125rem;">
              <span style="font-weight:500;">${t.artist}</span>
              <span style="color:var(--muted-lt);"> &mdash; ${t.title}</span>
              ${t.remix ? `<span style="color:var(--muted);font-size:0.75rem;"> (${t.remix})</span>` : ''}
            </a>
            ${t.label ? `<div style="font-size:0.6875rem;color:var(--muted);margin-top:1px;">${t.label}</div>` : ''}
          </div>
        </div>`;
      continue;
    }

    const spotifyQ = encodeURIComponent(`${t.artist} ${t.title}`);
    html += `
      <div class="set-track">
        <div class="set-track-pos">${t.pos || ''}</div>
        <div class="set-track-info">
          <a href="#/track/${encodedKey}" class="track-link">
            <span style="font-weight:500;">${t.artist}</span>
            <span style="color:var(--muted-lt);"> &mdash; ${t.title}</span>
            ${t.remix ? `<span style="color:var(--muted);font-size:0.8125rem;"> (${t.remix})</span>` : ''}
          </a>
          ${t.label ? `<div style="font-size:0.6875rem;color:var(--muted);margin-top:1px;">${t.label}</div>` : ''}
        </div>
        <div class="set-track-badges">
          ${anthemYears ? `<span class="pill pill-purple" title="Also played by ${setData.dj} in ${anthemYears.join(', ')}" style="font-size:0.625rem;cursor:help;">&#9733; ${anthemYears.length}yr</span>` : ''}
          ${otherDJCount ? `<span class="pill" title="${otherDJCount} other DJs played this" style="font-size:0.625rem;cursor:help;">${otherDJCount} DJs</span>` : ''}
          <a href="https://open.spotify.com/search/${spotifyQ}" target="_blank" rel="noopener" title="Search on Spotify" class="spotify-link" style="font-size:0.625rem;color:var(--green);opacity:0.4;text-decoration:none;transition:opacity var(--transition);" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.4'">&#9835;</a>
        </div>
      </div>
      ${blendHtml}`;
  }

  el.innerHTML = html;
}

function isIDTrack(artist, title) {
  const a = (artist || '').toLowerCase().trim();
  const t = (title || '').toLowerCase().trim();
  return a === 'id' || t === 'id' || a === '' || t === '' ||
    t.startsWith('id (') || t === 'id?' || a === 'id?';
}

function formatDate(dateStr) {
  if (!dateStr) return '\u2014';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}
