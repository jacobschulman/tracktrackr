/**
 * stages.js — Stage Archaeology view
 * Route: #/stages
 */

import { getStageHistory } from '../data.js?v=5';
import { CONFIG, getStageColor } from '../config.js?v=5';
import { fmt, navigateTo } from '../app.js?v=5';

let charts = [];
let svgRef = null;
let selectedStage = null;

export function destroy() {
  charts.forEach(c => c.destroy());
  charts = [];
  if (svgRef) {
    svgRef.remove();
    svgRef = null;
  }
  selectedStage = null;
}

export async function render(container, index, params) {
  const stageData = getStageHistory();

  // Filter out Radio/Podcast and Unknown Stage, sort by firstYear asc then totalSets desc
  const stages = stageData
    .filter(s => s.stage !== 'Radio/Podcast' && s.stage !== 'Unknown Stage')
    .sort((a, b) => a.firstYear - b.firstYear || b.totalSets - a.totalSets);

  const minYear = CONFIG.years.min;
  const maxYear = CONFIG.years.max;
  const years = [];
  for (let y = minYear; y <= maxYear; y++) years.push(y);

  container.innerHTML = `
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header">
        <div class="card-title">Stage Timeline</div>
        <div class="text-muted" style="font-size:0.75rem;">${stages.length} stages across ${years.length} years</div>
      </div>
      <div class="viz-container stage-desktop" style="overflow-x:auto;" id="stage-timeline-container"></div>
      <div class="stage-card-list" id="stage-card-list"></div>
    </div>
    <div id="stage-detail-panel"></div>
  `;

  // Render desktop SVG timeline
  renderTimeline(stages, years);

  // Render mobile card list
  renderMobileCards(stages);

  /* ── Desktop SVG timeline ─────────────────────────── */
  function renderTimeline(stages, years) {
    const timelineContainer = document.getElementById('stage-timeline-container');
    if (!timelineContainer) return;

    // Dimensions
    const labelWidth = 200;
    const margin = { top: 30, right: 20, bottom: 10, left: labelWidth };
    const rowHeight = 26;
    const barHeight = 16;
    const width = Math.max(800, timelineContainer.clientWidth || 800);
    const height = margin.top + margin.bottom + stages.length * rowHeight;

    const svg = d3.select(timelineContainer)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('display', 'block');

    svgRef = svg.node();

    const chartWidth = width - margin.left - margin.right;
    const xScale = d3.scaleLinear()
      .domain([minYear, maxYear])
      .range([0, chartWidth]);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Year axis labels at top
    const yearTicks = years.filter(y => y % 5 === 0 || y === minYear || y === maxYear);
    g.selectAll('.year-label')
      .data(yearTicks)
      .enter()
      .append('text')
      .attr('x', d => xScale(d))
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('fill', '#64748b')
      .attr('font-size', '10px')
      .attr('font-family', "'Inter', system-ui, sans-serif")
      .text(d => d);

    // Gridlines
    g.selectAll('.grid-line')
      .data(yearTicks)
      .enter()
      .append('line')
      .attr('x1', d => xScale(d))
      .attr('x2', d => xScale(d))
      .attr('y1', 0)
      .attr('y2', stages.length * rowHeight)
      .attr('stroke', '#1e1e2e')
      .attr('stroke-dasharray', '2,3');

    // Stage rows
    stages.forEach((stage, i) => {
      const y = i * rowHeight;
      const color = getStageColor(stage.stage);

      // Stage name label
      svg.append('text')
        .attr('x', margin.left - 10)
        .attr('y', margin.top + y + rowHeight / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'central')
        .attr('fill', '#94a3b8')
        .attr('font-size', '11px')
        .attr('font-family', "'Inter', system-ui, sans-serif")
        .attr('cursor', 'pointer')
        .text(stage.stage.length > 24 ? stage.stage.substring(0, 22) + '...' : stage.stage)
        .on('click', () => showDetail(stage));

      // Hover background for entire row
      g.append('rect')
        .attr('x', 0)
        .attr('y', y)
        .attr('width', chartWidth)
        .attr('height', rowHeight)
        .attr('fill', 'transparent')
        .attr('cursor', 'pointer')
        .on('mouseover', function() { d3.select(this).attr('fill', 'rgba(255,255,255,0.03)'); })
        .on('mouseout', function() { d3.select(this).attr('fill', 'transparent'); })
        .on('click', () => showDetail(stage));

      // Active year bars
      for (const yr of stage.appearedYears) {
        const barX = xScale(yr) - (xScale(1) - xScale(0)) / 2 + 1;
        const barW = Math.max((xScale(1) - xScale(0)) - 2, 3);

        g.append('rect')
          .attr('x', barX)
          .attr('y', y + (rowHeight - barHeight) / 2)
          .attr('width', barW)
          .attr('height', barHeight)
          .attr('rx', 2)
          .attr('fill', color)
          .attr('opacity', 0.85)
          .attr('cursor', 'pointer')
          .on('mouseover', function() { d3.select(this).attr('opacity', 1); })
          .on('mouseout', function() { d3.select(this).attr('opacity', 0.85); })
          .on('click', () => showDetail(stage));
      }
    });
  }

  /* ── Mobile card list ─────────────────────────────── */
  function renderMobileCards(stages) {
    const list = document.getElementById('stage-card-list');
    if (!list) return;

    list.innerHTML = stages.map(stage => {
      const color = getStageColor(stage.stage);
      return `
        <div class="stage-card" data-stage="${stage.stage}">
          <div class="stage-card-header">
            <span class="dot" style="background:${color}; width:10px; height:10px; border-radius:50%; display:inline-block"></span>
            <span class="stage-card-name">${stage.stage}</span>
          </div>
          <div class="stage-card-meta">Active: ${stage.firstYear}\u2013${stage.lastYear} \u00b7 ${stage.totalYears} years \u00b7 ${stage.totalSets} sets</div>
          <div class="stage-card-years">
            ${stage.appearedYears.map(y => `<span class="year-pill">${y}</span>`).join('')}
          </div>
        </div>
      `;
    }).join('');

    // Click handlers for mobile cards
    list.querySelectorAll('.stage-card').forEach(card => {
      card.addEventListener('click', () => {
        const stageName = card.dataset.stage;
        const stage = stages.find(s => s.stage === stageName);
        if (stage) showDetail(stage);
      });
    });
  }

  /* ── Detail panel (shared by desktop + mobile) ──── */
  function showDetail(stage) {
    const panel = document.getElementById('stage-detail-panel');
    if (!panel) return;

    // If clicking the same stage, toggle off
    if (selectedStage === stage.stage) {
      panel.innerHTML = '';
      selectedStage = null;
      return;
    }
    selectedStage = stage.stage;

    const color = getStageColor(stage.stage);

    // Build year-by-year set counts for the sparkline
    const yearsWithSets = {};
    for (const s of index.sets) {
      if (s.stage !== stage.stage) continue;
      yearsWithSets[s.year] = (yearsWithSets[s.year] || 0) + 1;
    }

    const sparkYears = [];
    const sparkCounts = [];
    for (let y = stage.firstYear; y <= stage.lastYear; y++) {
      sparkYears.push(y);
      sparkCounts.push(yearsWithSets[y] || 0);
    }

    panel.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title" style="display:flex;align-items:center;gap:8px;">
            <span class="dot" style="background:${color};width:10px;height:10px;border-radius:50%;display:inline-block;"></span>
            ${stage.stage}
          </div>
          <button id="close-detail-btn" style="font-size:1.25rem;color:var(--muted);cursor:pointer;background:none;border:none;">&times;</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
          <div>
            <div class="section-title">Overview</div>
            <div style="font-size:0.875rem;color:var(--text);margin-bottom:8px;">
              <strong>${fmt(stage.totalSets)}</strong> total sets across <strong>${stage.totalYears}</strong> years
            </div>
            <div style="font-size:0.875rem;color:var(--muted-lt);margin-bottom:8px;">
              Active: ${stage.firstYear} &ndash; ${stage.lastYear}
            </div>
            <div style="font-size:0.8125rem;color:var(--muted);margin-bottom:4px;">Active years:</div>
            <div class="year-pills" style="margin-bottom:12px;">
              ${stage.appearedYears.map(y =>
                `<span class="year-pill" style="cursor:default;">${y}</span>`
              ).join('')}
            </div>
            ${stage.missingYears.length > 0 ? `
              <div style="font-size:0.8125rem;color:var(--muted);margin-bottom:4px;">Gap years:</div>
              <div class="year-pills">
                ${stage.missingYears.map(y =>
                  `<span class="year-pill" style="cursor:default;opacity:0.5;">${y}</span>`
                ).join('')}
              </div>
            ` : ''}
          </div>
          <div>
            <div class="section-title">Sets per Year</div>
            <div class="chart-container" style="height:100px;">
              <canvas id="stage-spark-chart"></canvas>
            </div>
          </div>
        </div>
      </div>
    `;

    // Close button
    document.getElementById('close-detail-btn').addEventListener('click', () => {
      panel.innerHTML = '';
      selectedStage = null;
    });

    // Render sparkline bar chart
    const sparkCanvas = document.getElementById('stage-spark-chart');
    if (sparkCanvas && sparkYears.length > 0) {
      const sparkChart = new Chart(sparkCanvas, {
        type: 'bar',
        data: {
          labels: sparkYears.map(String),
          datasets: [{
            data: sparkCounts,
            backgroundColor: color,
            borderRadius: 2,
            barPercentage: 0.8,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.parsed.y} sets`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: {
                color: '#64748b',
                font: { size: 9 },
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: 10,
              },
            },
            y: {
              beginAtZero: true,
              grid: { color: '#1e1e2e' },
              ticks: {
                color: '#64748b',
                font: { size: 9 },
                stepSize: 1,
              },
            },
          },
        },
      });
      charts.push(sparkChart);
    }

    // Scroll to panel
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
