/**
 * discoveries.js — Auto-generated insights from Ultra Miami data
 * 10 discovery sections with Chart.js visualizations and scroll-reveal animations
 */

import { loadAllSets, isAllLoaded, computeDiscoveries, getTopTracks, trackKey } from '../data.js?v=5';
import { CONFIG, getStageColor } from '../config.js?v=5';
import { fmt, stageBadge, navigateTo } from '../app.js?v=5';

let charts = [];
let heroInterval = null;
let observer = null;

export function destroy() {
  charts.forEach(c => c.destroy());
  charts = [];
  if (heroInterval) {
    clearInterval(heroInterval);
    heroInterval = null;
  }
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

// ── Helpers ─────────────────────────────────────────

function djLink(name, slug) {
  return `<a class="dj-link" href="#/dj/${encodeURIComponent(slug)}">${name}</a>`;
}

function trackLink(artist, title, key) {
  return `<a class="track-link" href="#/track/${encodeURIComponent(key)}">${artist} — ${title}</a>`;
}

function createChart(canvas, config) {
  const chart = new Chart(canvas, config);
  charts.push(chart);
  return chart;
}

// ── Render ──────────────────────────────────────────

export async function render(container, index, params) {
  // Compute hero stats from index
  const djSlugs = new Set();
  for (const s of index.sets) {
    for (const d of s.djs) djSlugs.add(d.slug);
  }
  const yearSpan = index.years.length;
  const heroStats = [
    { value: yearSpan, label: `years of ${CONFIG.festivalShort}` },
    { value: fmt(djSlugs.size), label: 'unique DJs' },
    { value: fmt(index.totalSets), label: 'total sets' },
  ];

  // We'll add track-count stats after loading
  const heroStatsExtra = [];

  container.innerHTML = `
    <div class="hero-number-container" id="hero-container">
      ${heroStats.map((s, i) => `
        <div class="hero-stat ${i === 0 ? 'active' : ''}" data-hero="${i}">
          <div class="hero-value">${s.value}</div>
          <div class="hero-label">${s.label}</div>
        </div>
      `).join('')}
    </div>

    <div id="discoveries-progress" style="display:none; padding: 0 0 32px;">
      <div class="progress-label" id="disc-loading-label">Loading sets...</div>
      <div class="progress-bar-container">
        <div class="progress-bar" id="disc-loading-bar" style="width:0%"></div>
      </div>
    </div>

    <div id="discoveries-list"></div>
  `;

  // ── Hero rotation ───────────────────────────────
  let heroIdx = 0;
  const heroEls = container.querySelectorAll('.hero-stat');

  function rotateHero() {
    heroEls[heroIdx].classList.remove('active');
    heroIdx = (heroIdx + 1) % heroEls.length;
    heroEls[heroIdx].classList.add('active');
  }

  heroInterval = setInterval(rotateHero, 5000);

  // ── Load all sets ───────────────────────────────
  if (!isAllLoaded()) {
    const progressWrap = document.getElementById('discoveries-progress');
    const progressLabel = document.getElementById('disc-loading-label');
    const progressBar = document.getElementById('disc-loading-bar');
    progressWrap.style.display = 'block';

    await loadAllSets(null, (loaded, total) => {
      const pct = Math.round((loaded / total) * 100);
      progressLabel.textContent = `Loading ${loaded} of ${total} sets... ${pct}%`;
      progressBar.style.width = `${pct}%`;
    });

    progressWrap.style.display = 'none';
  }

  // Add extra hero stats now that tracks are loaded
  const topAll = getTopTracks(99999);
  const uniqueTrackCount = topAll.length;
  heroStatsExtra.push(
    { value: fmt(uniqueTrackCount), label: 'unique tracks' },
    { value: fmt(topAll.reduce((s, t) => s + t.playCount, 0)), label: 'total track plays' },
  );

  const heroContainer = document.getElementById('hero-container');
  for (const stat of heroStatsExtra) {
    const div = document.createElement('div');
    div.className = 'hero-stat';
    div.dataset.hero = heroEls.length;
    div.innerHTML = `
      <div class="hero-value">${stat.value}</div>
      <div class="hero-label">${stat.label}</div>
    `;
    heroContainer.appendChild(div);
  }

  // Re-query hero elements after adding extras and update the total count
  const allHeroEls = heroContainer.querySelectorAll('.hero-stat');
  // Patch the rotation to use the fresh list
  if (heroInterval) clearInterval(heroInterval);
  heroInterval = setInterval(() => {
    const els = heroContainer.querySelectorAll('.hero-stat');
    const active = heroContainer.querySelector('.hero-stat.active');
    if (active) active.classList.remove('active');
    heroIdx = (heroIdx + 1) % els.length;
    els[heroIdx].classList.add('active');
  }, 5000);

  // ── Compute discoveries ─────────────────────────
  const discoveries = computeDiscoveries();
  const listEl = document.getElementById('discoveries-list');

  if (discoveries.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">?</div>
        <div class="empty-state-text">No discoveries found. Try loading more data.</div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = discoveries.map((d, i) => `
    <div class="discovery-section" data-discovery="${i}">
      <div class="discovery-number">Discovery ${String(i + 1).padStart(2, '0')}</div>
      <div class="discovery-headline">${d.headline}</div>
      <div class="discovery-description">${d.description}</div>
      <div class="discovery-viz" id="disc-viz-${i}">
        <canvas id="disc-chart-${i}" style="max-height:300px"></canvas>
      </div>
    </div>
  `).join('');

  // ── IntersectionObserver for fade-in ────────────
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    }
  }, { threshold: 0.1 });

  listEl.querySelectorAll('.discovery-section').forEach(el => observer.observe(el));

  // ── Render each discovery visualization ─────────
  discoveries.forEach((d, i) => renderDiscoveryViz(d, i, index));
}

// ── Per-discovery visualizations ────────────────────

function renderDiscoveryViz(discovery, idx, index) {
  const vizEl = document.getElementById(`disc-viz-${idx}`);
  const canvas = document.getElementById(`disc-chart-${idx}`);
  if (!vizEl || !canvas) return;

  switch (discovery.type) {
    case 'immortal-track':
      renderImmortalTrack(canvas, vizEl, discovery, index);
      break;
    case 'ultra-anthem':
      renderUltraAnthem(canvas, vizEl, discovery);
      break;
    case 'ultra-veteran':
      renderUltraVeteran(canvas, vizEl, discovery, index);
      break;
    case 'loyal-dj':
      renderLoyalDJ(canvas, vizEl, discovery);
      break;
    case 'restless-dj':
      renderRestlessDJ(canvas, vizEl, discovery);
      break;
    case 'comeback':
      renderComeback(canvas, vizEl, discovery, index);
      break;
    case 'cultural-hijack':
      renderCulturalHijack(canvas, vizEl, discovery);
      break;
    case 'blend-longevity':
      renderBlendLongevity(canvas, vizEl, discovery, index);
      break;
    case 'tastemaker':
      renderTastemaker(canvas, vizEl, discovery);
      break;
    case 'stage-story':
      renderStageStory(canvas, vizEl, discovery, index);
      break;
    default:
      canvas.style.display = 'none';
      break;
  }
}

// 1. Immortal Track — bar chart of DJs per year (orbit)
function renderImmortalTrack(canvas, vizEl, discovery, index) {
  const data = discovery.data;
  const years = data.years;
  const orbit = data.orbitByYear;

  const labels = years.map(String);
  const values = years.map(y => orbit[y] || 0);

  createChart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'DJs who played it',
        data: values,
        backgroundColor: years.map(y => {
          const val = orbit[y] || 0;
          const max = Math.max(...values);
          const alpha = max > 0 ? 0.3 + 0.7 * (val / max) : 0.5;
          return `rgba(139, 92, 246, ${alpha})`;
        }),
        borderColor: 'rgba(139, 92, 246, 0.8)',
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.parsed.y} DJ${ctx.parsed.y !== 1 ? 's' : ''} played it in ${ctx.label}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: '#1e1e2e' },
          ticks: { color: '#94a3b8', font: { size: 11 } },
          title: { display: true, text: 'Year', color: '#64748b' },
        },
        y: {
          grid: { color: '#1e1e2e' },
          ticks: { color: '#94a3b8', stepSize: 1 },
          title: { display: true, text: 'DJs', color: '#64748b' },
          beginAtZero: true,
        },
      },
    },
  });

  // Add clickable track link below chart
  const link = document.createElement('div');
  link.style.cssText = 'margin-top:12px; font-size:0.875rem;';
  link.innerHTML = trackLink(data.artist, data.title, data.key);
  vizEl.appendChild(link);
}

// 2. Ultra Anthem — horizontal bar of top DJs who played it
function renderUltraAnthem(canvas, vizEl, discovery) {
  const data = discovery.data;
  const apps = data.apps;

  // Count plays per DJ
  const djCounts = new Map();
  const djSlugMap = new Map();
  for (const a of apps) {
    djCounts.set(a.dj, (djCounts.get(a.dj) || 0) + 1);
    if (!djSlugMap.has(a.dj) && a.djSlugs && a.djSlugs.length > 0) {
      djSlugMap.set(a.dj, a.djSlugs[0]);
    }
  }

  const sorted = [...djCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const labels = sorted.map(([name]) => name);
  const values = sorted.map(([, count]) => count);

  createChart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: sorted.map((_, i) => {
          const alpha = 0.4 + 0.6 * (1 - i / sorted.length);
          return `rgba(139, 92, 246, ${alpha})`;
        }),
        borderColor: 'rgba(139, 92, 246, 0.8)',
        borderWidth: 1,
        borderRadius: 4,
        barThickness: 18,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => `Played ${ctx.parsed.x} time${ctx.parsed.x !== 1 ? 's' : ''}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: '#1e1e2e' },
          ticks: { color: '#94a3b8', stepSize: 1 },
          title: { display: true, text: 'Times Played', color: '#64748b' },
          beginAtZero: true,
        },
        y: {
          grid: { display: false },
          ticks: { color: '#e2e8f0', font: { size: 12 } },
        },
      },
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const djName = labels[elements[0].index];
          const slug = djSlugMap.get(djName);
          if (slug) navigateTo(`#/dj/${encodeURIComponent(slug)}`);
        }
      },
      onHover: (e, elements) => {
        e.native.target.style.cursor = elements.length ? 'pointer' : 'default';
      },
    },
  });

  // Track link
  const link = document.createElement('div');
  link.style.cssText = 'margin-top:12px; font-size:0.875rem;';
  link.innerHTML = trackLink(data.artist, data.title, data.key);
  vizEl.appendChild(link);
}

// 3. Ultra Veteran — timeline bar showing years active vs gap years
function renderUltraVeteran(canvas, vizEl, discovery, index) {
  const data = discovery.data;
  const streak = data.streak;
  const allYears = streak.allYears || [];
  const gapYears = streak.gapYears || [];

  const minYear = CONFIG.years.min;
  const maxYear = CONFIG.years.max;
  const yearRange = [];
  for (let y = minYear; y <= maxYear; y++) yearRange.push(y);

  const activeSet = new Set(allYears);
  const gapSet = new Set(gapYears);

  createChart(canvas, {
    type: 'bar',
    data: {
      labels: yearRange.map(String),
      datasets: [{
        label: 'Active',
        data: yearRange.map(y => activeSet.has(y) ? 1 : 0),
        backgroundColor: yearRange.map(y => activeSet.has(y) ? 'rgba(0, 255, 136, 0.7)' : 'transparent'),
        borderColor: yearRange.map(y => activeSet.has(y) ? 'rgba(0, 255, 136, 0.9)' : 'transparent'),
        borderWidth: 1,
        borderRadius: 2,
      }, {
        label: 'Gap Year',
        data: yearRange.map(y => gapSet.has(y) ? 1 : 0),
        backgroundColor: yearRange.map(y => gapSet.has(y) ? 'rgba(248, 113, 113, 0.4)' : 'transparent'),
        borderColor: yearRange.map(y => gapSet.has(y) ? 'rgba(248, 113, 113, 0.6)' : 'transparent'),
        borderWidth: 1,
        borderRadius: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { color: '#94a3b8', boxWidth: 12 } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const year = yearRange[ctx.dataIndex];
              if (activeSet.has(year)) return `Played at Ultra in ${year}`;
              if (gapSet.has(year)) return `Gap year: ${year}`;
              return '';
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: '#1e1e2e' },
          ticks: {
            color: '#94a3b8',
            font: { size: 10 },
            maxRotation: 45,
            callback: function(value) {
              const year = yearRange[value];
              return year % 5 === 0 ? year : '';
            },
          },
        },
        y: {
          display: false,
          max: 1.5,
        },
      },
    },
  });

  // DJ link
  const link = document.createElement('div');
  link.style.cssText = 'margin-top:12px; font-size:0.875rem;';
  link.innerHTML = djLink(data.name, data.slug);
  vizEl.appendChild(link);
}

// 4. Loyal DJ — stat display
function renderLoyalDJ(canvas, vizEl, discovery) {
  const data = discovery.data;
  canvas.style.display = 'none';

  const statHtml = `
    <div style="display:flex; gap:24px; flex-wrap:wrap; margin-top:8px;">
      <div class="stat-card" style="flex:1; min-width:120px;">
        <div class="stat-number text-purple">${(data.rate * 100).toFixed(0)}%</div>
        <div class="stat-label">Repeat Rate</div>
      </div>
      <div class="stat-card" style="flex:1; min-width:120px;">
        <div class="stat-number">${fmt(data.repeatedTracks)}</div>
        <div class="stat-label">Repeated Tracks</div>
      </div>
      <div class="stat-card" style="flex:1; min-width:120px;">
        <div class="stat-number">${fmt(data.totalUniqueTracks)}</div>
        <div class="stat-label">Unique Tracks</div>
      </div>
      <div class="stat-card" style="flex:1; min-width:120px;">
        <div class="stat-number">${data.setCount}</div>
        <div class="stat-label">Sets Scraped</div>
      </div>
    </div>
    <div style="margin-top:12px; font-size:0.875rem;">
      ${djLink(data.name, data.slug)}
    </div>
  `;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = statHtml;
  vizEl.appendChild(wrapper);
}

// 5. Restless DJ — stat display
function renderRestlessDJ(canvas, vizEl, discovery) {
  const data = discovery.data;
  canvas.style.display = 'none';

  const uniquePct = ((1 - data.repeatRate) * 100).toFixed(0);
  const statHtml = `
    <div style="display:flex; gap:24px; flex-wrap:wrap; margin-top:8px;">
      <div class="stat-card" style="flex:1; min-width:120px;">
        <div class="stat-number text-green">${uniquePct}%</div>
        <div class="stat-label">Unique Tracks</div>
      </div>
      <div class="stat-card" style="flex:1; min-width:120px;">
        <div class="stat-number">${fmt(data.totalUniqueTracks)}</div>
        <div class="stat-label">Total Unique Tracks</div>
      </div>
      <div class="stat-card" style="flex:1; min-width:120px;">
        <div class="stat-number">${data.setCount}</div>
        <div class="stat-label">Ultra Appearances</div>
      </div>
    </div>
    <div style="margin-top:12px; font-size:0.875rem;">
      ${djLink(data.name, data.slug)}
    </div>
  `;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = statHtml;
  vizEl.appendChild(wrapper);
}

// 6. Comeback — timeline showing active years, gap, return
function renderComeback(canvas, vizEl, discovery, index) {
  const data = discovery.data;
  const years = data.years || [];

  const minYear = Math.min(...years) - 1;
  const maxYear = Math.max(...years) + 1;
  const yearRange = [];
  for (let y = minYear; y <= maxYear; y++) yearRange.push(y);

  const activeSet = new Set(years);

  // Color: active = green, gap between lastBefore and returnYear = red, other = transparent
  const colors = yearRange.map(y => {
    if (activeSet.has(y)) return 'rgba(0, 255, 136, 0.7)';
    if (y > data.lastBefore && y < data.returnYear) return 'rgba(248, 113, 113, 0.35)';
    return 'transparent';
  });

  const borderColors = yearRange.map(y => {
    if (activeSet.has(y)) return 'rgba(0, 255, 136, 0.9)';
    if (y > data.lastBefore && y < data.returnYear) return 'rgba(248, 113, 113, 0.5)';
    return 'transparent';
  });

  createChart(canvas, {
    type: 'bar',
    data: {
      labels: yearRange.map(String),
      datasets: [{
        data: yearRange.map(y => (activeSet.has(y) || (y > data.lastBefore && y < data.returnYear)) ? 1 : 0),
        backgroundColor: colors,
        borderColor: borderColors,
        borderWidth: 1,
        borderRadius: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const y = yearRange[ctx.dataIndex];
              if (activeSet.has(y)) return `Active in ${y}`;
              if (y > data.lastBefore && y < data.returnYear) return `Absent in ${y}`;
              return '';
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: '#1e1e2e' },
          ticks: { color: '#94a3b8', font: { size: 11 } },
        },
        y: { display: false, max: 1.5 },
      },
    },
  });

  // Link
  const link = document.createElement('div');
  link.style.cssText = 'margin-top:12px; font-size:0.875rem;';
  if (data.type === 'dj') {
    link.innerHTML = djLink(data.name, data.slug);
  } else {
    link.innerHTML = trackLink(data.artist, data.title, data.key);
  }
  vizEl.appendChild(link);
}

// 7. Cultural Hijack — simple bar showing the count (could be expanded)
function renderCulturalHijack(canvas, vizEl, discovery) {
  const data = discovery.data;
  canvas.style.display = 'none';

  const statHtml = `
    <div style="display:flex; gap:24px; flex-wrap:wrap; margin-top:8px;">
      <div class="stat-card" style="flex:1; min-width:120px;">
        <div class="stat-number text-pink">${data.count}</div>
        <div class="stat-label">Blend Appearances</div>
      </div>
      <div class="stat-card" style="flex:1; min-width:120px;">
        <div class="stat-number">${data.year}</div>
        <div class="stat-label">Year</div>
      </div>
      <div class="stat-card" style="flex:1; min-width:120px;">
        <div class="stat-number text-yellow">${data.artist}</div>
        <div class="stat-label">Artist</div>
      </div>
    </div>
  `;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = statHtml;
  vizEl.appendChild(wrapper);
}

// 8. Blend Longevity — timeline dots per year
function renderBlendLongevity(canvas, vizEl, discovery, index) {
  const data = discovery.data;
  const years = data.years || [];

  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const yearRange = [];
  for (let y = minYear; y <= maxYear; y++) yearRange.push(y);

  const activeSet = new Set(years);

  createChart(canvas, {
    type: 'bar',
    data: {
      labels: yearRange.map(String),
      datasets: [{
        label: 'Blended this year',
        data: yearRange.map(y => activeSet.has(y) ? 1 : 0),
        backgroundColor: yearRange.map(y =>
          activeSet.has(y) ? 'rgba(139, 92, 246, 0.7)' : 'rgba(30, 30, 46, 0.3)'
        ),
        borderColor: yearRange.map(y =>
          activeSet.has(y) ? 'rgba(139, 92, 246, 0.9)' : 'transparent'
        ),
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const y = yearRange[ctx.dataIndex];
              return activeSet.has(y) ? `Blended in ${y}` : `Not blended in ${y}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: '#1e1e2e' },
          ticks: { color: '#94a3b8', font: { size: 11 } },
        },
        y: { display: false, max: 1.5 },
      },
    },
  });

  // Track link
  const link = document.createElement('div');
  link.style.cssText = 'margin-top:12px; font-size:0.875rem;';
  link.innerHTML = trackLink(data.artist, data.title, data.key);
  vizEl.appendChild(link);
}

// 9. Tastemaker — list of example tracks debuted
function renderTastemaker(canvas, vizEl, discovery) {
  const data = discovery.data;
  canvas.style.display = 'none';

  let listHtml = `
    <div style="margin-top:8px;">
      <div style="display:flex; gap:24px; flex-wrap:wrap; margin-bottom:16px;">
        <div class="stat-card" style="flex:1; min-width:120px;">
          <div class="stat-number text-green">${data.firstPlays}</div>
          <div class="stat-label">Tracks Debuted First</div>
        </div>
      </div>
      <div class="section-title">Example Tracks Debuted</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Track</th>
            <th>Year Debuted</th>
          </tr>
        </thead>
        <tbody>
  `;

  for (const ex of (data.examples || []).slice(0, 5)) {
    listHtml += `
      <tr>
        <td>${trackLink(ex.artist, ex.title, ex.key)}</td>
        <td>${ex.year}</td>
      </tr>
    `;
  }

  listHtml += `
        </tbody>
      </table>
      <div style="margin-top:12px; font-size:0.875rem;">
        ${djLink(data.name, data.slug)}
      </div>
    </div>
  `;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = listHtml;
  vizEl.appendChild(wrapper);
}

// 10. Stage Story — bar chart of sets per year for that stage
function renderStageStory(canvas, vizEl, discovery, index) {
  const data = discovery.data;
  const stage = data.stage;
  if (!stage) {
    canvas.style.display = 'none';
    return;
  }

  const appearedYears = stage.appearedYears || [];
  const minYear = stage.firstYear || CONFIG.years.min;
  const maxYear = stage.lastYear || CONFIG.years.max;
  const yearRange = [];
  for (let y = minYear; y <= maxYear; y++) yearRange.push(y);

  // Count sets per year for this stage
  const countsPerYear = {};
  for (const s of index.sets) {
    if (s.stage === stage.stage) {
      countsPerYear[s.year] = (countsPerYear[s.year] || 0) + 1;
    }
  }

  const stageColor = getStageColor(stage.stage);

  createChart(canvas, {
    type: 'bar',
    data: {
      labels: yearRange.map(String),
      datasets: [{
        label: stage.stage,
        data: yearRange.map(y => countsPerYear[y] || 0),
        backgroundColor: yearRange.map(y =>
          countsPerYear[y] ? stageColor + 'b3' : 'transparent'
        ),
        borderColor: yearRange.map(y =>
          countsPerYear[y] ? stageColor : 'transparent'
        ),
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.parsed.y} sets in ${yearRange[ctx.dataIndex]}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: '#1e1e2e' },
          ticks: { color: '#94a3b8', font: { size: 11 } },
          title: { display: true, text: 'Year', color: '#64748b' },
        },
        y: {
          grid: { color: '#1e1e2e' },
          ticks: { color: '#94a3b8', stepSize: 1 },
          title: { display: true, text: 'Sets', color: '#64748b' },
          beginAtZero: true,
        },
      },
    },
  });
}
