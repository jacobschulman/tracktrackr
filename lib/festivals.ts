export interface FestivalConfig {
  slug: string;
  name: string;
  shortName: string;
  stageColors: Record<string, string>;
  accent: string;
  emoji: string;
  hasWeekends?: boolean;
}

export const FESTIVALS: Record<string, FestivalConfig> = {
  'ultra-miami': {
    slug: 'ultra-miami',
    name: 'Ultra Music Festival Miami',
    shortName: 'Ultra Miami',
    accent: '#a855f7',
    emoji: '🟣',
    stageColors: {
      'Mainstage': '#a855f7',
      'Worldwide Stage': '#22c55e',
      'Live Stage': '#ec4899',
      'Resistance Megastructure': '#14b8a6',
      'Resistance The Cove': '#06b6d4',
      'Resistance Stage': '#6366f1',
      'Resistance Reflector': '#818cf8',
      'Carl Cox & Friends Arena': '#f97316',
      'Carl Cox Megastructure': '#fb923c',
      'ASOT Stage': '#eab308',
      'ASOT Festival': '#facc15',
      'ASOT 500 Festival': '#fbbf24',
      'ASOT 550 Festival': '#fbbf24',
      'ASOT 600 Festival': '#fbbf24',
      'ASOT 650 Festival': '#fbbf24',
      'ASOT 700 Festival': '#fbbf24',
      'ASOT 900 Festival': '#fbbf24',
      'ASOT 10th Anniversary': '#fbbf24',
      'UMF Radio Stage': '#8b5cf6',
      'Virtual Audio': '#64748b',
      'Revealed Stage': '#ef4444',
      'Oasis Stage': '#34d399',
      'mau5trap Stage': '#f87171',
      'Owsla Stage': '#c084fc',
      'Megastructure': '#94a3b8',
      'Underground Stage': '#78716c',
      'Jacked Stage': '#fb7185',
      'Brownies & Lemonade Stage': '#fcd34d',
      'Arrival Stage': '#a78bfa',
      'Purified Stage': '#67e8f9',
      'Group Therapy Stage': '#c4b5fd',
      'Toolroom Stage': '#fdba74',
      'Ibiza Space Arena': '#5eead4',
      'Stage 7': '#d4d4d8',
      'The Pavilion Stage': '#a1a1aa',
      'Biscayne Stage': '#93c5fd',
      'Groovejet Stage': '#86efac',
      'Ultra Worldwide': '#7dd3fc',
      'Radio/Podcast': '#475569',
      'Unknown Stage': '#334155',
    },
  },
  'tomorrowland': {
    slug: 'tomorrowland',
    name: 'Tomorrowland',
    shortName: 'Tomorrowland',
    accent: '#f59e0b',
    emoji: '🦋',
    stageColors: {},
  },
  'coachella': {
    slug: 'coachella',
    name: 'Coachella Valley Music and Arts Festival',
    shortName: 'Coachella',
    accent: '#f97316',
    emoji: '🌴',
    hasWeekends: true,
    stageColors: {},
  },
  'edc-las-vegas': {
    slug: 'edc-las-vegas',
    name: 'Electric Daisy Carnival Las Vegas',
    shortName: 'EDC Las Vegas',
    accent: '#06b6d4',
    emoji: '🎡',
    stageColors: {},
  },
  'edc-china': {
    slug: 'edc-china',
    name: 'Electric Daisy Carnival China',
    shortName: 'EDC China',
    accent: '#0ea5e9',
    emoji: '🎡',
    stageColors: {},
  },
  'edc-dallas': {
    slug: 'edc-dallas',
    name: 'Electric Daisy Carnival Dallas',
    shortName: 'EDC Dallas',
    accent: '#38bdf8',
    emoji: '🎡',
    stageColors: {},
  },
  'edc-los-angeles': {
    slug: 'edc-los-angeles',
    name: 'Electric Daisy Carnival Los Angeles',
    shortName: 'EDC Los Angeles',
    accent: '#22d3ee',
    emoji: '🎡',
    stageColors: {},
  },
  'edc-mexico': {
    slug: 'edc-mexico',
    name: 'Electric Daisy Carnival Mexico',
    shortName: 'EDC Mexico',
    accent: '#2dd4bf',
    emoji: '🎡',
    stageColors: {},
  },
  'edc-new-york': {
    slug: 'edc-new-york',
    name: 'Electric Daisy Carnival New York',
    shortName: 'EDC New York',
    accent: '#67e8f9',
    emoji: '🎡',
    stageColors: {},
  },
  'edc-orlando': {
    slug: 'edc-orlando',
    name: 'Electric Daisy Carnival Orlando',
    shortName: 'EDC Orlando',
    accent: '#5eead4',
    emoji: '🎡',
    stageColors: {},
  },
  'electric-zoo': {
    slug: 'electric-zoo',
    name: 'Electric Zoo',
    shortName: 'Electric Zoo',
    accent: '#22c55e',
    emoji: '⚡',
    stageColors: {},
  },
  'ultra-chile': {
    slug: 'ultra-chile',
    name: 'Ultra Chile',
    shortName: 'Ultra Chile',
    accent: '#c084fc',
    emoji: '🟣',
    stageColors: {},
  },
  'ultra-europe': {
    slug: 'ultra-europe',
    name: 'Ultra Europe',
    shortName: 'Ultra Europe',
    accent: '#d946ef',
    emoji: '🟣',
    stageColors: {},
  },
  'ultra-japan': {
    slug: 'ultra-japan',
    name: 'Ultra Japan',
    shortName: 'Ultra Japan',
    accent: '#e879f9',
    emoji: '🟣',
    stageColors: {},
  },
  'creamfields': {
    slug: 'creamfields',
    name: 'Creamfields',
    shortName: 'Creamfields',
    accent: '#ec4899',
    emoji: '🎶',
    stageColors: {},
  },
  'lollapalooza': {
    slug: 'lollapalooza',
    name: 'Lollapalooza',
    shortName: 'Lollapalooza',
    accent: '#8b5cf6',
    emoji: '🎸',
    stageColors: {},
  },
  'mysteryland': {
    slug: 'mysteryland',
    name: 'Mysteryland',
    shortName: 'Mysteryland',
    accent: '#14b8a6',
    emoji: '🔮',
    stageColors: {},
  },
  'parookaville': {
    slug: 'parookaville',
    name: 'Parookaville',
    shortName: 'Parookaville',
    accent: '#ef4444',
    emoji: '🏰',
    stageColors: {},
  },
};

export function getFestival(slug: string): FestivalConfig | undefined {
  return FESTIVALS[slug];
}

export function getAllFestivals(): FestivalConfig[] {
  return Object.values(FESTIVALS);
}

export function getAllFestivalSlugs(): string[] {
  return Object.keys(FESTIVALS);
}

export function getStageColor(festival: string, stage: string): string {
  const config = FESTIVALS[festival];
  if (config?.stageColors[stage]) return config.stageColors[stage];
  return '#64748b';
}
