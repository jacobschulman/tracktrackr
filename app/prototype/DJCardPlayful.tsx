import styles from './prototype.module.css';

type SigTrack = { artist: string; title: string; count: number };

type Props = {
  name: string;
  initial: string;
  accent: string;
  streak?: number;
  totalSets: number;
  uniqueTracks: number;
  idRate: number;
  signatureTracks: SigTrack[];
  festivals: string[];
};

export function DJCardPlayful({
  name,
  initial,
  accent,
  streak,
  totalSets,
  uniqueTracks,
  idRate,
  signatureTracks,
  festivals,
}: Props) {
  return (
    <article className={styles.djCard} style={{ ['--card-accent' as string]: accent }}>
      <div className={styles.djTop}>
        <div className={styles.djInitial}>{initial}</div>
        <div className={styles.djInfo}>
          <div className={styles.djName}>{name}</div>
          <div className={styles.djMeta}>
            <span>{festivals.length} festivals</span>
            {streak !== undefined && streak > 1 && (
              <>
                <span>·</span>
                <span className={styles.streak}>{streak}yr streak</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className={styles.djStats}>
        <div className={styles.djStat}>
          <div className={styles.djStatNum}>{totalSets}</div>
          <div className={styles.djStatLabel}>Sets</div>
        </div>
        <div className={styles.djStat}>
          <div className={styles.djStatNum}>{uniqueTracks}</div>
          <div className={styles.djStatLabel}>Tracks</div>
        </div>
        <div className={styles.djStat}>
          <div className={styles.djStatNum}>{idRate}%</div>
          <div className={styles.djStatLabel}>ID&apos;d</div>
        </div>
      </div>

      <div className={styles.djTracksLabel}>Top tracks</div>
      {signatureTracks.slice(0, 3).map((t, i) => (
        <div key={i} className={styles.djTrack}>
          <span className={styles.djTrackNum}>{i + 1}</span>
          <div className={styles.djTrackBody}>
            <div className={styles.djTrackTitle}>{t.title}</div>
            <div className={styles.djTrackArtist}>{t.artist}</div>
          </div>
          <span className={styles.djTrackCount}>{t.count}x</span>
        </div>
      ))}

      <div className={styles.djFestivals}>
        {festivals.map((f) => (
          <span key={f} className={styles.festChip}>
            {f.replace(/-/g, ' ')}
          </span>
        ))}
      </div>
    </article>
  );
}
