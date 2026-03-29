/**
 * heatmap.js — DJs page (leaderboard + continuity heatmap)
 * Route: #/djs or #/heatmap
 */

import { getDJHistory, getDJStreak, loadSet } from '../data.js?v=2';
import { CONFIG, getStageColor } from '../config.js?v=2';
import { fmt, navigateTo, stageBadge } from '../app.js?v=2';

let tooltip = null;

export function destroy() {
  if (tooltip && tooltip.parentNode) {
    tooltip.parentNode.removeChild(tooltip);
    tooltip = null;
  }
}

// ── Build DJ aggregate data from index ────────────

function buildDJData(index) {
  const map = new Map(); // slug -> { name, slug, years, totalSets, stages }

  for (const s of index.sets) {
    for (const d of s.djs) {
      if (!map.has(d.slug)) {
        map.set(d.slug, {
          name: d.name,
          slug: d.slug,
          years: new Set(),
          totalSets: 0,
          stages: new Set(),
        });
      }
      const entry = map.get(d.slug);
      entry.years.add(s.year);
      entry.totalSets++;
      if (s.stage) entry.stages.add(s.stage);
    }
  }

  // Convert sets to sorted arrays, compute streak inline
  const result = [];
  for (const dj of map.values()) {
    const sortedYears = [...dj.years].sort((a, b) => a - b);
    let best = 1, cur = 1;
    for (let i = 1; i < sortedYears.length; i++) {
      if (sortedYears[i] === sortedYears[i - 1] + 1) {
        cur++;
        if (cur > best) best = cur;
      } else {
        cur = 1;
      }
    }
    result.push({
      name: dj.name,
      slug: dj.slug,
      yearsArr: sortedYears,
      yearsCount: sortedYears.length,
      firstYear: sortedYears[0],
      lastYear: sortedYears[sortedYears.length - 1],
      totalSets: dj.totalSets,
      streak: sortedYears.length >= 1 ? best : 0,
      stages: dj.stages,
    });
  }

  return result;
}

// ── Render ─────────────────────────────────────────

export async function render(container, index, params) {
  const allDJs = buildDJData(index);
  const allStages = [...new Set(index.sets.map(s => s.stage))].sort();

  container.innerHTML = `
    <h2 style="margin-bottom:16px;">DJs</h2>

    <!-- Section A: DJ Leaderboard -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">DJ Leaderboard</div>
        <div class="sort-pills" id="leaderboard-sort">
          <button class="pill active" data-sort="years">Most Years</button>
          <button class="pill" data-sort="sets">Most Sets</button>
          <button class="pill" data-sort="streak">Longest Streak</button>
        </div>
      </div>
      <div id="leaderboard-container"></div>
    </div>

    <!-- Section B: Visual Heatmap -->
    <div class="card" style="margin-top:32px">
      <div class="card-header">
        <div class="card-title">DJ Continuity Heatmap</div>
      </div>

      <div class="filters" style="padding:0 20px 12px;">
        <div>
          <div class="filter-label">Stage</div>
          <select class="filter-select" id="heatmap-stage-filter">
            <option value="">All Stages</option>
            ${allStages.map(s => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>
        <div>
          <div class="filter-label">Min Appearances</div>
          <input type="range" id="heatmap-min-slider" min="1" max="10" value="2"
                 style="width:120px; accent-color: var(--purple-lt);">
          <span id="heatmap-min-label" style="font-size:0.8125rem; color:var(--muted-lt); margin-left:6px;">2</span>
        </div>
      </div>

      <div id="heatmap-grid" style="overflow-x:auto; padding:0 20px 20px;"></div>
    </div>
  `;

  // ── Tooltip ──────────────────────────────────────
  tooltip = document.createElement('div');
  tooltip.className = 'heatmap-tooltip';
  tooltip.style.display = 'none';
  document.body.appendChild(tooltip);

  // ── Leaderboard sort ─────────────────────────────
  let currentSort = 'years';
  const sortContainer = document.getElementById('leaderboard-sort');

  sortContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill');
    if (!btn) return;
    const sort = btn.dataset.sort;
    if (sort === currentSort) return;
    currentSort = sort;
    sortContainer.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    renderLeaderboard(allDJs, currentSort);
  });

  // ── Heatmap filters ──────────────────────────────
  const stageFilter = document.getElementById('heatmap-stage-filter');
  const minSlider = document.getElementById('heatmap-min-slider');
  const minLabel = document.getElementById('heatmap-min-label');

  stageFilter.addEventListener('change', () => buildHeatmap());
  minSlider.addEventListener('input', () => {
    minLabel.textContent = minSlider.value;
    buildHeatmap();
  });

  function buildHeatmap() {
    const stageVal = stageFilter.value || null;
    const minApps = parseInt(minSlider.value) || 2;
    const gridData = computeGridData(index, stageVal, minApps);
    renderGrid(gridData, index.years);
  }

  // ── Initial render ───────────────────────────────
  renderLeaderboard(allDJs, currentSort);
  buildHeatmap();
}

// ── Leaderboard rendering ─────────────────────────

function renderLeaderboard(allDJs, sortMode) {
  const el = document.getElementById('leaderboard-container');
  if (!el) return;

  // Sort
  let sorted;
  if (sortMode === 'sets') {
    sorted = [...allDJs].sort((a, b) => b.totalSets - a.totalSets || b.yearsCount - a.yearsCount);
  } else if (sortMode === 'streak') {
    sorted = [...allDJs].sort((a, b) => b.streak - a.streak || b.yearsCount - a.yearsCount);
  } else {
    sorted = [...allDJs].sort((a, b) => b.yearsCount - a.yearsCount || b.totalSets - a.totalSets);
  }

  const top50 = sorted.slice(0, 50);
  if (top50.length === 0) {
    el.innerHTML = `
      <div class="empty-state" style="padding:24px;">
        <div class="empty-state-text">No DJ data available.</div>
      </div>
    `;
    return;
  }

  // Determine max value for bar width
  let maxVal;
  if (sortMode === 'sets') {
    maxVal = top50[0].totalSets;
  } else if (sortMode === 'streak') {
    maxVal = top50[0].streak;
  } else {
    maxVal = top50[0].yearsCount;
  }

  let html = '';
  top50.forEach((dj, i) => {
    const rank = i + 1;
    const top3 = rank <= 3 ? 'top3' : '';

    let pct, countVal, countLabel;
    if (sortMode === 'sets') {
      pct = maxVal > 0 ? (dj.totalSets / maxVal) * 100 : 0;
      countVal = dj.totalSets;
      countLabel = 'sets';
    } else if (sortMode === 'streak') {
      pct = maxVal > 0 ? (dj.streak / maxVal) * 100 : 0;
      countVal = dj.streak;
      countLabel = 'yr streak';
    } else {
      pct = maxVal > 0 ? (dj.yearsCount / maxVal) * 100 : 0;
      countVal = dj.yearsCount;
      countLabel = 'years';
    }

    html += `
      <div class="leaderboard-row" data-href="#/dj/${encodeURIComponent(dj.slug)}">
        <div class="leaderboard-rank ${top3}">${rank}</div>
        <div class="leaderboard-info">
          <div class="leaderboard-name">${dj.name}</div>
          <div class="leaderboard-meta">
            <span>${dj.firstYear}\u2013${dj.lastYear}</span>
            <span class="sep">\u00b7</span>
            <span>${dj.totalSets} sets</span>
            <span class="sep">\u00b7</span>
            <span>${dj.streak}yr streak</span>
          </div>
          <div class="leaderboard-bar">
            <div class="leaderboard-bar-fill" style="width:${pct.toFixed(1)}%"></div>
          </div>
        </div>
        <div>
          <div class="leaderboard-count">${countVal}</div>
          <div class="leaderboard-count-label">${countLabel}</div>
        </div>
      </div>
    `;
  });

  el.innerHTML = html;

  // Click handlers
  el.querySelectorAll('.leaderboard-row').forEach(row => {
    row.addEventListener('click', () => {
      location.hash = row.dataset.href;
    });
  });
}

// ── Compute grid data ─────────────────────────────

function computeGridData(index, stageFilter, minAppearances) {
  let sets = index.sets;
  if (stageFilter) {
    sets = sets.filter(s => s.stage === stageFilter);
  }

  const djData = new Map(); // slug -> { name, slug, yearCounts, total }

  for (const s of sets) {
    for (const d of s.djs) {
      if (!djData.has(d.slug)) {
        djData.set(d.slug, { name: d.name, slug: d.slug, yearCounts: new Map(), total: 0 });
      }
      const entry = djData.get(d.slug);
      entry.yearCounts.set(s.year, (entry.yearCounts.get(s.year) || 0) + 1);
      entry.total++;
    }
  }

  return [...djData.values()]
    .filter(d => d.total >= minAppearances)
    .sort((a, b) => b.total - a.total)
    .slice(0, 80);
}

// ── Render D3 heatmap grid ────────────────────────

function renderGrid(djList, years) {
  const gridEl = document.getElementById('heatmap-grid');
  if (!gridEl) return;
  gridEl.innerHTML = '';

  if (djList.length === 0) {
    gridEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-text">No DJs match the current filters.</div>
      </div>
    `;
    return;
  }

  const cellSize = 20;
  const cellGap = 1;
  const step = cellSize + cellGap;
  const labelWidth = 160;
  const headerHeight = 40;

  const width = labelWidth + years.length * step + 20;
  const height = headerHeight + djList.length * step + 10;

  const svg = d3.select(gridEl)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .style('display', 'block');

  // Year labels (x axis)
  const yearGroup = svg.append('g')
    .attr('transform', `translate(${labelWidth}, 0)`);

  yearGroup.selectAll('text')
    .data(years)
    .enter()
    .append('text')
    .attr('x', (d, i) => i * step + cellSize / 2)
    .attr('y', headerHeight - 6)
    .attr('text-anchor', 'middle')
    .attr('fill', '#94a3b8')
    .attr('font-size', years.length > 20 ? '8px' : '10px')
    .attr('font-family', "'Inter', system-ui, sans-serif")
    .text(d => {
      if (years.length > 20) {
        return d % 2 === 0 ? String(d).slice(2) : '';
      }
      return String(d).slice(2);
    });

  // DJ rows
  const rowGroup = svg.append('g')
    .attr('transform', `translate(0, ${headerHeight})`);

  djList.forEach((dj, rowIdx) => {
    const y = rowIdx * step;

    // DJ name label
    const label = rowGroup.append('text')
      .attr('x', labelWidth - 8)
      .attr('y', y + cellSize / 2 + 4)
      .attr('text-anchor', 'end')
      .attr('fill', '#e2e8f0')
      .attr('font-size', '11px')
      .attr('font-family', "'Inter', system-ui, sans-serif")
      .attr('cursor', 'pointer')
      .text(dj.name.length > 20 ? dj.name.substring(0, 18) + '...' : dj.name);

    label.on('click', () => {
      navigateTo(`#/dj/${encodeURIComponent(dj.slug)}`);
    });

    label.on('mouseover', function () {
      d3.select(this).attr('fill', '#8b5cf6');
    });

    label.on('mouseout', function () {
      d3.select(this).attr('fill', '#e2e8f0');
    });

    // Year cells
    years.forEach((year, colIdx) => {
      const count = dj.yearCounts.get(year) || 0;
      const x = labelWidth + colIdx * step;

      let fill;
      if (count === 0) {
        fill = 'rgba(30, 30, 46, 0.2)';
      } else if (count === 1) {
        fill = 'rgba(139, 92, 246, 0.35)';
      } else {
        fill = 'rgba(139, 92, 246, 0.8)';
      }

      const rect = rowGroup.append('rect')
        .attr('x', x)
        .attr('y', y)
        .attr('width', cellSize)
        .attr('height', cellSize)
        .attr('rx', 2)
        .attr('fill', fill)
        .attr('cursor', count > 0 ? 'pointer' : 'default');

      rect.on('mousemove', function (event) {
        if (!tooltip) return;
        tooltip.style.display = 'block';
        tooltip.textContent = `${dj.name} \u2014 ${year}: ${count} set${count !== 1 ? 's' : ''}`;
        tooltip.style.left = (event.clientX + 12) + 'px';
        tooltip.style.top = (event.clientY - 8) + 'px';
      });

      rect.on('mouseout', function () {
        if (!tooltip) return;
        tooltip.style.display = 'none';
      });

      if (count > 0) {
        rect.on('click', () => {
          navigateTo(`#/dj/${encodeURIComponent(dj.slug)}`);
        });
      }
    });
  });
}
