/**
 * b2b.js — B2B Explorer view
 * Route: #/b2b
 */

import { getB2BSets, getB2BDetail, loadAllSets, isAllLoaded } from '../data.js?v=2';
import { CONFIG, getStageColor } from '../config.js?v=2';
import { fmt, stageBadge, navigateTo } from '../app.js?v=2';

let openPairKey = null;

export function destroy() {
  openPairKey = null;
}

export async function render(container, index, params) {
  const pairs = getB2BSets();

  if (!pairs || pairs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">&harr;</div>
        <div class="empty-state-text">No B2B sets found.</div>
      </div>
    `;
    return;
  }

  // If sets aren't loaded, show a loading option
  let setsLoaded = isAllLoaded();

  container.innerHTML = `
    <div class="stat-bar" style="margin-bottom:20px;">
      <div class="stat-card">
        <div class="stat-number">${fmt(pairs.length)}</div>
        <div class="stat-label">B2B Pairings</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${fmt(pairs.reduce((s, p) => s + p.count, 0))}</div>
        <div class="stat-label">Total B2B Sets</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${pairs[0] ? pairs[0].count : 0}</div>
        <div class="stat-label">Most Sets Together</div>
      </div>
    </div>

    ${!setsLoaded ? `
      <div id="b2b-loading" style="margin-bottom:16px;">
        <div class="progress-label" id="b2b-loading-label">Loading sets for track analysis...</div>
        <div class="progress-bar-container">
          <div class="progress-bar" id="b2b-loading-progress" style="width:0%"></div>
        </div>
      </div>
    ` : ''}

    <div class="card">
      <div class="card-header">
        <div class="card-title">B2B Pair Rankings</div>
        <div class="text-muted" style="font-size:0.75rem;">Sorted by joint set count</div>
      </div>
      <div id="b2b-list"></div>
    </div>
  `;

  // Load sets in background
  if (!setsLoaded) {
    const loadEl = document.getElementById('b2b-loading');
    const loadLabel = document.getElementById('b2b-loading-label');
    const loadProgress = document.getElementById('b2b-loading-progress');

    loadAllSets(null, (loaded, total) => {
      const pct = Math.round((loaded / total) * 100);
      loadLabel.textContent = `Loading ${loaded} of ${total} sets... ${pct}%`;
      loadProgress.style.width = `${pct}%`;
    }).then(() => {
      setsLoaded = true;
      if (loadEl) loadEl.style.display = 'none';
      // If a detail panel is open, refresh it to show track data
      if (openPairKey) {
        const pair = pairs.find(p => pairKeyOf(p) === openPairKey);
        if (pair) showDetail(pair);
      }
    });
  }

  renderList();

  function pairKeyOf(pair) {
    return pair.djs.map(d => d.slug).sort().join('|||');
  }

  function renderList() {
    const listEl = document.getElementById('b2b-list');
    if (!listEl) return;

    listEl.innerHTML = pairs.map(pair => {
      const pk = pairKeyOf(pair);
      const djLinks = pair.djs.map(d =>
        `<a href="#/dj/${d.slug}" class="dj-link" onclick="event.stopPropagation()">${d.name}</a>`
      ).join(' <span style="color:var(--muted);">&amp;</span> ');

      return `
        <div class="b2b-row" data-pair-key="${pk}" style="border-bottom:1px solid var(--border);cursor:pointer;">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;gap:12px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:200px;">
              <span style="font-weight:600;font-size:0.9375rem;">${djLinks}</span>
            </div>
            <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">
              <span class="pill pill-purple">${pair.count} joint set${pair.count > 1 ? 's' : ''}</span>
              <div style="display:flex;gap:3px;">
                ${pair.years.map(y => `<span class="year-pill" style="cursor:default;font-size:0.6875rem;padding:2px 6px;">${y}</span>`).join('')}
              </div>
            </div>
          </div>
          <div class="b2b-detail" id="detail-${pk}" style="display:none;"></div>
        </div>
      `;
    }).join('');

    // Click handlers for rows
    listEl.querySelectorAll('.b2b-row').forEach(row => {
      row.addEventListener('click', (e) => {
        // Don't trigger on DJ link clicks
        if (e.target.closest('.dj-link')) return;
        const pk = row.dataset.pairKey;
        const pair = pairs.find(p => pairKeyOf(p) === pk);
        if (!pair) return;

        if (openPairKey === pk) {
          // Close it
          const detailEl = document.getElementById(`detail-${pk}`);
          if (detailEl) detailEl.style.display = 'none';
          openPairKey = null;
        } else {
          // Close previous
          if (openPairKey) {
            const prevEl = document.getElementById(`detail-${openPairKey}`);
            if (prevEl) prevEl.style.display = 'none';
          }
          openPairKey = pk;
          showDetail(pair);
        }
      });
    });
  }

  function showDetail(pair) {
    const pk = pairKeyOf(pair);
    const detailEl = document.getElementById(`detail-${pk}`);
    if (!detailEl) return;

    const slugs = pair.djs.map(d => d.slug).sort();
    const detail = getB2BDetail(slugs[0], slugs[1]);

    let html = `<div style="padding:0 16px 16px;border-top:1px solid var(--border);">`;

    // Joint set history table
    html += `
      <div class="section-title" style="margin-top:12px;">Joint Set History</div>
      <table class="data-table" style="margin-bottom:16px;">
        <thead>
          <tr>
            <th>Date</th>
            <th>Stage</th>
            <th>Duration</th>
            <th>Link</th>
          </tr>
        </thead>
        <tbody>
          ${detail.jointSets.map(s => {
            const durationMin = s.duration ? Math.round(s.duration / 60) : null;
            return `
              <tr>
                <td>${s.date}</td>
                <td>${stageBadge(s.stage)}</td>
                <td>${durationMin ? `${durationMin} min` : '—'}</td>
                <td>
                  <a href="https://www.1001tracklists.com/tracklist/${s.tlId}" target="_blank" rel="noopener" class="ext-link" style="color:var(--purple-lt);font-size:0.8125rem;">
                    1001TL
                  </a>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    // Track analysis (only if sets are loaded)
    if (setsLoaded && detail) {
      if (detail.uniqueToJoint.length > 0) {
        html += `
          <div class="section-title">Tracks Unique to Their Joint Sets</div>
          <div style="max-height:200px;overflow-y:auto;margin-bottom:16px;">
            ${detail.uniqueToJoint.slice(0, 30).map(t => `
              <div style="padding:4px 0;font-size:0.8125rem;border-bottom:1px solid var(--border);">
                <span class="track-link" style="cursor:pointer;" onclick="location.hash='#/track/${encodeURIComponent(t.key)}'">${t.artist} — ${t.title}</span>
              </div>
            `).join('')}
            ${detail.uniqueToJoint.length > 30 ? `<div style="padding:8px 0;font-size:0.75rem;color:var(--muted);">...and ${detail.uniqueToJoint.length - 30} more</div>` : ''}
          </div>
        `;
      }

      if (detail.tracksInCommon.length > 0) {
        html += `
          <div class="section-title">Tracks in Common (Solo Sets)</div>
          <div style="max-height:200px;overflow-y:auto;margin-bottom:8px;">
            ${detail.tracksInCommon.slice(0, 30).map(t => `
              <div style="padding:4px 0;font-size:0.8125rem;border-bottom:1px solid var(--border);">
                <span class="track-link" style="cursor:pointer;" onclick="location.hash='#/track/${encodeURIComponent(t.key)}'">${t.artist} — ${t.title}</span>
              </div>
            `).join('')}
            ${detail.tracksInCommon.length > 30 ? `<div style="padding:8px 0;font-size:0.75rem;color:var(--muted);">...and ${detail.tracksInCommon.length - 30} more</div>` : ''}
          </div>
        `;
      }

      if (detail.uniqueToJoint.length === 0 && detail.tracksInCommon.length === 0) {
        html += `<div style="font-size:0.8125rem;color:var(--muted);padding:8px 0;">No track overlap data available for this pairing.</div>`;
      }
    } else if (!setsLoaded) {
      html += `<div style="font-size:0.8125rem;color:var(--muted);padding:8px 0;">Track analysis will appear once all sets finish loading.</div>`;
    }

    html += `</div>`;

    detailEl.innerHTML = html;
    detailEl.style.display = 'block';

    // Scroll detail into view
    detailEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
