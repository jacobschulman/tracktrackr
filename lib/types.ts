export interface DJEntry {
  name: string;
  slug: string;
  aliases: string[];
}

export interface SetMeta {
  tlId: string;
  dj: string;
  djs: DJEntry[];
  stage: string;
  stageRaw: string;
  date: string;
  year: number;
  genre: string;
  tracksIdentified: number;
  tracksTotal: number;
  duration: string;
  views: number;
  likes: number;
  url: string;
  hasSetFile: boolean;
}

export interface FestivalIndex {
  festival: string;
  festivalName: string;
  years: number[];
  totalSets: number;
  scrapedSets: number;
  stages: string[];
  sets: SetMeta[];
}

export interface Track {
  pos: string;
  artist: string;
  title: string;
  remix: string;
  label: string;
  trackId: string;
  type: 'normal' | 'blend' | string;
  blendGroup: { artist: string; title: string; remix?: string }[] | null;
}

export interface Recording {
  platform: string;
  idMedia: string;
  idSource: string;
  url: string;
}

export interface SetData {
  tlId: string;
  dj: string;
  djs: DJEntry[];
  stage: string;
  date: string;
  year: number;
  tracks: Track[];
  recordings: Recording[];
}

export interface TrackAppearance {
  tlId: string;
  pos: string;
  year: number;
  dj: string;
  djSlugs: string[];
  stage: string;
  date: string;
  label: string;
  remix: string;
  artist: string;
  title: string;
  matchType?: string;
}

export interface TopTrack {
  artist: string;
  title: string;
  remix: string;
  key: string;
  playCount: number;
  years: number[];
  djs: string[];
  tlIds: string[];
  label: string;
}

export interface DJData {
  name: string;
  slug: string;
  yearsArr: number[];
  yearsCount: number;
  firstYear: number;
  lastYear: number;
  totalSets: number;
  streak: number;
  stages: Set<string>;
}

export interface BlendAppearance {
  tlId: string;
  year: number;
  dj: string;
  djSlugs: string[];
  stage: string;
  date: string;
  pairedWith: { artist: string; title: string; remix: string }[];
}
