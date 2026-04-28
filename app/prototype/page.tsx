import fs from 'node:fs';
import path from 'node:path';
import styles from './prototype.module.css';
import { DJCardPlayful } from './DJCardPlayful';
import { TrackRowPlayful } from './TrackRowPlayful';

export const metadata = { title: 'Prototype · TrackTrackr' };

type DJData = {
  name: string;
  totalSets: number;
  totalUniqueTracks: number;
  idRate: number;
  streak?: number;
  festivals: string[];
  signatureTracks: { artist: string; title: string; count: number; years: number[] }[];
};

type TrackData = {
  slug: string;
  artist: string;
  title: string;
  playCount: number;
  years: number[];
  history: {
    dj: string;
    date: string;
    festival: string;
    festivalName: string;
  }[];
  streak?: { streak: number; orbitByYear: Record<string, number> };
};

type LeaderboardEntry = {
  slug: string;
  artist: string;
  title: string;
  playCount: number;
  years: number[];
  djs: string[];
  festivalCounts: Record<string, number>;
  yearCounts: Record<string, number>;
};

function loadJSON<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), filePath), 'utf8'));
}

function getTrend(yearCounts: Record<string, number>): 'up' | 'down' | 'stable' {
  const recent = (yearCounts['2026'] ?? 0) + (yearCounts['2025'] ?? 0);
  const prior = (yearCounts['2024'] ?? 0) + (yearCounts['2023'] ?? 0);
  if (recent > prior * 1.2) return 'up';
  if (recent < prior * 0.8) return 'down';
  return 'stable';
}

function getPeak(yearCounts: Record<string, number>): { year: number; count: number } {
  let peakYear = 0;
  let peakCount = 0;
  for (const [y, c] of Object.entries(yearCounts)) {
    if (c > peakCount) {
      peakCount = c;
      peakYear = Number(y);
    }
  }
  return { year: peakYear, count: peakCount };
}

function getTopFestival(festivalCounts: Record<string, number>): { name: string; count: number } {
  let topName = '';
  let topCount = 0;
  for (const [f, c] of Object.entries(festivalCounts)) {
    if (c > topCount) {
      topCount = c;
      topName = f;
    }
  }
  return { name: topName.replace(/-/g, ' '), count: topCount };
}

export default function PrototypePage() {
  const anyma = loadJSON<DJData>('data/djs/anyma.json');
  const skrillex = loadJSON<DJData>('data/djs/skrillex.json');
  const fredagain = loadJSON<DJData>('data/djs/fredagain...json');

  const djs: { data: DJData; accent: string }[] = [
    { data: skrillex, accent: '#f472b6' },
    { data: anyma, accent: '#c4b5fd' },
    { data: fredagain, accent: '#6ee7b7' },
  ];

  // Load top tracks from leaderboard with full detail
  const leaderboard = loadJSON<LeaderboardEntry[]>('data/tracks-leaderboard.json');
  const topEntries = leaderboard.slice(0, 10);

  const trackRows = topEntries.map((entry) => {
    // Load the full track file for history
    const trackFile = loadJSON<TrackData>(`data/tracks/${entry.slug}.json`);
    const peak = getPeak(entry.yearCounts);
    const topFest = getTopFestival(entry.festivalCounts);
    const trend = getTrend(entry.yearCounts);
    const lastPlay = trackFile.history[0]; // history is sorted recent-first

    return {
      title: entry.title,
      artist: entry.artist,
      playCount: entry.playCount,
      djCount: entry.djs.length,
      streak: trackFile.streak?.streak ?? entry.years.length,
      peakYear: peak.year,
      peakCount: peak.count,
      years: entry.years,
      lastPlay,
      topFestival: topFest.name,
      topFestivalCount: topFest.count,
      trending: trend,
    };
  });

  return (
    <div className={styles.root}>
      <style dangerouslySetInnerHTML={{ __html: `
        #sidebar, #header, .site-footer, .mobile-tabs, .player-bar { display: none !important; }
        #content { margin-left: 0 !important; padding: 0 !important; max-width: none !important; }
        #view-container { max-width: none !important; }
      ` }} />

      <section className={styles.hero}>
        <div className={styles.heroLabel}>Design direction v3</div>
        <h1 className={styles.heroTitle}>TrackTrackr</h1>
        <p className={styles.heroSub}>
          Data is the product. Every row surfaces who played what,
          when, how often, and whether it&apos;s trending. This is what
          1001tl doesn&apos;t give you.
        </p>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>Most Played All Time</div>
          <div className={styles.sectionCount}>Top 10</div>
        </div>
        <div className={styles.trackList}>
          {trackRows.map((t, i) => (
            <TrackRowPlayful key={i} {...t} />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>DJs</div>
          <div className={styles.sectionCount}>{djs.length} shown</div>
        </div>
        <div className={styles.djGrid}>
          {djs.map(({ data, accent }, i) => (
            <DJCardPlayful
              key={data.name}
              name={data.name}
              accent={accent}
              streak={data.streak}
              totalSets={data.totalSets}
              uniqueTracks={data.totalUniqueTracks}
              idRate={data.idRate}
              signatureTracks={data.signatureTracks}
              festivals={data.festivals}
              featured={i === 0}
            />
          ))}
        </div>
      </section>

      <section className={styles.notes}>
        <div className={styles.notesTitle}>What&apos;s different now</div>
        <div className={styles.noteGrid}>
          <div className={styles.noteCard}>
            <div className={styles.noteLabel}>Inline insights</div>
            <div className={styles.noteBody}>
              Every track row shows DJ count, streak length,
              peak year, and trend direction. No click-through
              required to understand the story.
            </div>
          </div>
          <div className={styles.noteCard}>
            <div className={styles.noteLabel}>Last played</div>
            <div className={styles.noteBody}>
              Who dropped it most recently and where. Gives
              each track a living, current context — not
              just a static count.
            </div>
          </div>
          <div className={styles.noteCard}>
            <div className={styles.noteLabel}>Trend arrows</div>
            <div className={styles.noteBody}>
              Comparing recent 2 years vs prior 2 years.
              Green up = gaining momentum, red down =
              fading out. At a glance.
            </div>
          </div>
          <div className={styles.noteCard}>
            <div className={styles.noteLabel}>Real data</div>
            <div className={styles.noteBody}>
              These are the actual top 10 most-played tracks
              across all festivals. Not mock data —
              real leaderboard, real history.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
