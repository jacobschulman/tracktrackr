import { Space_Grotesk } from 'next/font/google';
import fs from 'node:fs';
import path from 'node:path';
import styles from './prototype.module.css';
import { DJCardPlayful } from './DJCardPlayful';
import { TrackRowPlayful } from './TrackRowPlayful';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700'],
});

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

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function PrototypePage() {
  const anyma = loadDJ('anyma');
  const skrillex = loadDJ('skrillex');
  const fredagain = loadDJ('fredagain..');

  const djs = [
    { data: anyma, accent: '#a855f7' },
    { data: skrillex, accent: '#fb7185' },
    { data: fredagain, accent: '#34d399' },
  ];

  const trackAccents = ['#a855f7', '#fb923c', '#34d399', '#38bdf8', '#fbbf24', '#fb7185'];
  const topTracks = anyma.signatureTracks.slice(0, 6).map((t, i) => ({
    ...t,
    accent: trackAccents[i % trackAccents.length],
    stage: ['Main Stage', 'Sahara', 'Do LaB', 'Yuma', 'Mojave', 'Gobi'][i % 6],
  }));

  return (
    <div className={`${styles.root} ${spaceGrotesk.variable}`}>
      <section className={styles.hero}>
        <span className={styles.heroEyebrow}>Design prototype · v0.1</span>
        <h1 className={styles.heroTitle}>
          Fun, not<br />spreadsheet.
        </h1>
        <p className={styles.heroSub}>
          A playful direction for TrackTrackr — bold color, confident type, and
          a little bounce. Real data below.
        </p>
      </section>

      <div className={styles.grid}>
        <div>
          <div className={styles.sectionLabel}>DJ Cards</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {djs.map(({ data, accent }) => (
              <DJCardPlayful
                key={data.name}
                name={data.name}
                initials={initialsOf(data.name)}
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
        </div>
        <div>
          <div className={styles.sectionLabel}>Track Rows · Anyma signatures</div>
          <div className={styles.trackList}>
            {topTracks.map((t, i) => (
              <TrackRowPlayful
                key={i}
                title={t.title}
                artist={t.artist}
                count={t.count}
                years={t.years}
                stage={t.stage}
                accent={t.accent}
              />
            ))}
          </div>
        </div>
      </div>

      <section className={styles.compare}>
        <div className={styles.compareHead}>What's different here</div>
        <p className={styles.compareNote}>
          This prototype is completely isolated — it doesn't touch your current
          styles. Scroll around, hover things, compare with the rest of the site.
          If the vibe lands, we'll codify the tokens and start migrating real pages.
        </p>
        <div className={styles.notes}>
          <div className={styles.noteCard} style={{ ['--noteAccent' as string]: '#a855f7' }}>
            <div className={styles.noteTitle}>Color</div>
            <div className={styles.noteBody}>
              Warmer background, each DJ/track gets an accent hue. Gradients
              and radial glows replace flat surfaces.
            </div>
          </div>
          <div className={styles.noteCard} style={{ ['--noteAccent' as string]: '#fb923c' }}>
            <div className={styles.noteTitle}>Shape</div>
            <div className={styles.noteBody}>
              Bigger radii (14–28px). Pills for badges. Circular play buttons.
              Nothing feels like a data grid anymore.
            </div>
          </div>
          <div className={styles.noteCard} style={{ ['--noteAccent' as string]: '#34d399' }}>
            <div className={styles.noteTitle}>Type</div>
            <div className={styles.noteBody}>
              Space Grotesk for display / numbers — more character than Inter
              alone. Inter stays for body copy.
            </div>
          </div>
          <div className={styles.noteCard} style={{ ['--noteAccent' as string]: '#38bdf8' }}>
            <div className={styles.noteTitle}>Motion</div>
            <div className={styles.noteBody}>
              Springy hover states (cubic-bezier overshoot). Rows slide, cards
              lift, play buttons tilt. All CSS — no framer-motion yet.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
