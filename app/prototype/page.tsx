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

function loadDJ(slug: string): DJData {
  const file = path.join(process.cwd(), 'data', 'djs', `${slug}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export default function PrototypePage() {
  const anyma = loadDJ('anyma');
  const skrillex = loadDJ('skrillex');
  const fredagain = loadDJ('fredagain..');

  const djs: { data: DJData; accent: string }[] = [
    { data: anyma, accent: '#a78bfa' },
    { data: skrillex, accent: '#f472b6' },
    { data: fredagain, accent: '#6ee7b7' },
  ];

  const topTracks = anyma.signatureTracks.slice(0, 8).map((t, i) => ({
    ...t,
    stage: ['Main Stage', 'Sahara', 'Do LaB', 'Yuma', 'Mojave', 'Gobi', 'Sonora', 'Outdoor'][i % 8],
  }));

  return (
    <div className={styles.root}>
      <style dangerouslySetInnerHTML={{ __html: `
        #sidebar, #header, .site-footer, .mobile-tabs, .player-bar { display: none !important; }
        #content { margin-left: 0 !important; padding: 0 !important; max-width: none !important; }
        #view-container { max-width: none !important; }
      ` }} />

      <section className={styles.hero}>
        <div className={styles.heroLabel}>Design direction v2</div>
        <h1 className={styles.heroTitle}>TrackTrackr</h1>
        <p className={styles.heroSub}>
          Tighter, editorial, confident. Color as accent — not wallpaper.
          Real data, real components. Hover around.
        </p>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>DJs</div>
          <div className={styles.sectionCount}>{djs.length} shown</div>
        </div>
        <div className={styles.djGrid}>
          {djs.map(({ data, accent }) => (
            <DJCardPlayful
              key={data.name}
              name={data.name}
              initial={data.name[0]}
              accent={accent}
              streak={data.streak}
              totalSets={data.totalSets}
              uniqueTracks={data.totalUniqueTracks}
              idRate={data.idRate}
              signatureTracks={data.signatureTracks}
              festivals={data.festivals}
            />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>Tracks</div>
          <div className={styles.sectionCount}>Anyma&apos;s signatures</div>
        </div>
        <div className={styles.trackList}>
          {topTracks.map((t, i) => (
            <TrackRowPlayful
              key={i}
              title={t.title}
              artist={t.artist}
              count={t.count}
              years={t.years}
              stage={t.stage}
            />
          ))}
        </div>
      </section>

      <section className={styles.notes}>
        <div className={styles.notesTitle}>What changed from v1</div>
        <div className={styles.noteGrid}>
          <div className={styles.noteCard}>
            <div className={styles.noteLabel}>Restrained color</div>
            <div className={styles.noteBody}>
              Color is accent, not atmosphere. No gradient backgrounds,
              no tinted surfaces. White text does the heavy lifting.
            </div>
          </div>
          <div className={styles.noteCard}>
            <div className={styles.noteLabel}>Tighter density</div>
            <div className={styles.noteBody}>
              Track rows are a proper list, not isolated cards.
              Stats are inline, not boxed. Info-dense but scannable.
            </div>
          </div>
          <div className={styles.noteCard}>
            <div className={styles.noteLabel}>Editorial type</div>
            <div className={styles.noteBody}>
              Space Grotesk for display at large sizes.
              Tight letter-spacing, confident weight. Reads like
              a music publication, not a dashboard.
            </div>
          </div>
          <div className={styles.noteCard}>
            <div className={styles.noteLabel}>Quiet motion</div>
            <div className={styles.noteBody}>
              Subtle hover shifts — no springs, no bouncing.
              Play buttons invert on hover. Rows highlight.
              Interactions feel calm and intentional.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
