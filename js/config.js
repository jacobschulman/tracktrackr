/**
 * config.js — TrackTrackr global configuration
 */

export const CONFIG = {
  dataBase: 'data/ultra-miami',
  festival: 'Ultra Music Festival Miami',
  festivalShort: 'Ultra Miami',
  years: { min: 1999, max: 2026 },

  stageColors: {
    'Mainstage':              '#a855f7',
    'Worldwide Stage':        '#22c55e',
    'Live Stage':             '#ec4899',
    'Resistance Megastructure': '#14b8a6',
    'Resistance The Cove':    '#06b6d4',
    'Resistance Stage':       '#6366f1',
    'Resistance Reflector':   '#818cf8',
    'Carl Cox & Friends Arena': '#f97316',
    'Carl Cox Megastructure': '#fb923c',
    'ASOT Stage':             '#eab308',
    'ASOT Festival':          '#facc15',
    'ASOT 500 Festival':      '#fbbf24',
    'ASOT 550 Festival':      '#fbbf24',
    'ASOT 600 Festival':      '#fbbf24',
    'ASOT 650 Festival':      '#fbbf24',
    'ASOT 700 Festival':      '#fbbf24',
    'ASOT 900 Festival':      '#fbbf24',
    'ASOT 10th Anniversary':  '#fbbf24',
    'UMF Radio Stage':        '#8b5cf6',
    'Virtual Audio':          '#64748b',
    'Revealed Stage':         '#ef4444',
    'Oasis Stage':            '#34d399',
    'mau5trap Stage':         '#f87171',
    'Owsla Stage':            '#c084fc',
    'Megastructure':          '#94a3b8',
    'Underground Stage':      '#78716c',
    'Jacked Stage':           '#fb7185',
    'Brownies & Lemonade Stage': '#fcd34d',
    'Arrival Stage':          '#a78bfa',
    'Purified Stage':         '#67e8f9',
    'Group Therapy Stage':    '#c4b5fd',
    'Toolroom Stage':         '#fdba74',
    'Ibiza Space Arena':      '#5eead4',
    'Stage 7':                '#d4d4d8',
    'The Pavilion Stage':     '#a1a1aa',
    'Biscayne Stage':         '#93c5fd',
    'Groovejet Stage':        '#86efac',
    'Ultra Worldwide':        '#7dd3fc',
    'Radio/Podcast':          '#475569',
    'Unknown Stage':          '#334155',
  },
};

// Chart.js global defaults — applied after Chart.js loads
export function initChartDefaults() {
  if (typeof Chart === 'undefined') return;
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.borderColor = '#1e1e2e';
  Chart.defaults.font.family = "'Inter', system-ui, -apple-system, sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.animation.duration = 400;
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.plugins.tooltip.backgroundColor = '#1a1a24';
  Chart.defaults.plugins.tooltip.titleColor = '#e2e8f0';
  Chart.defaults.plugins.tooltip.bodyColor = '#94a3b8';
  Chart.defaults.plugins.tooltip.borderColor = '#1e1e2e';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;
}

export function getStageColor(stage) {
  return CONFIG.stageColors[stage] || '#64748b';
}
