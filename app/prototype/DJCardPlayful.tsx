import styles from './prototype.module.css';

type SigTrack = { artist: string; title: string; count: number };

type Props = {
  name: string;
  initials: string;
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
  initials,
  accent,
  streak,
  totalSets,
  uniqueTracks,
  idRate,
  signatureTracks,
  festivals,
}: Props) {
  return (
    <article className={styles.djCard} style={{ ['--accent' as string]: accent }}>
      <div className={styles.djCardHead}>
        <div className={styles.djAvatar}>{initials}</div>
        <div className={styles.djNameWrap}>
          <div className={styles.djName}>{name}</div>
          <div className={styles.djMeta}>
            <span>{festivals.length} festivals</span>
            {streak !== undefined && streak > 1 && (
              <span className={styles.streakPill}>🔥 {streak}y streak</span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <div className={styles.statNum}>{totalSets}</div>
          <div className={styles.statLabel}>Sets</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statNum}>{uniqueTracks}</div>
          <div className={styles.statLabel}>Tracks</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statNum}>{idRate}%</div>
          <div className={styles.statLabel}>ID'd</div>
        </div>
      </div>

      <div className={styles.sigHead}>Signature tracks</div>
      <div className={styles.sigList}>
        {signatureTracks.slice(0, 4).map((t, i) => (
          <div key={i} className={styles.sigItem}>
            <span className={styles.sigRank}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className={styles.sigTitle}>{t.title}</div>
              <div className={styles.sigArtist}>{t.artist}</div>
            </div>
            <span className={styles.sigCount}>×{t.count}</span>
          </div>
        ))}
      </div>

      <div className={styles.festivalPills}>
        {festivals.map((f) => (
          <span key={f} className={styles.festPill}>
            {f.replace(/-/g, ' ')}
          </span>
        ))}
      </div>
    </article>
  );
}
