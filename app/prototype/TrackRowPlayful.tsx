import styles from './prototype.module.css';

type Props = {
  title: string;
  artist: string;
  count: number;
  years: number[];
  accent: string;
  stage?: string;
};

export function TrackRowPlayful({ title, artist, count, years, accent, stage }: Props) {
  const yearLabel =
    years.length === 1 ? String(years[0]) : `${Math.min(...years)}–${Math.max(...years)}`;
  return (
    <div className={styles.trackRow} style={{ ['--accent' as string]: accent }}>
      <button className={styles.playBtn} aria-label={`Play ${title}`}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
      <div className={styles.trackMain}>
        <div className={styles.trackTitle}>{title}</div>
        <div className={styles.trackArtist}>{artist}</div>
      </div>
      <div className={styles.trackMeta}>
        {stage && <span className={styles.trackStagePill}>{stage}</span>}
        <span className={styles.trackYearPill}>{yearLabel}</span>
        <span className={styles.trackCount}>{count}</span>
      </div>
    </div>
  );
}
