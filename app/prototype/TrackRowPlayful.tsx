import styles from './prototype.module.css';

type Props = {
  title: string;
  artist: string;
  count: number;
  years: number[];
  stage?: string;
};

export function TrackRowPlayful({ title, artist, count, years, stage }: Props) {
  const yearLabel =
    years.length === 1 ? String(years[0]) : `${Math.min(...years)}–${Math.max(...years)}`;
  return (
    <div className={styles.trackRow}>
      <button className={styles.trackPlay} aria-label={`Play ${title}`}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
      <div className={styles.trackBody}>
        <div className={styles.trackTitle}>{title}</div>
        <div className={styles.trackArtist}>{artist}</div>
      </div>
      <div className={styles.trackTags}>
        {stage && <span className={styles.tag}>{stage}</span>}
        <span className={styles.tag}>{yearLabel}</span>
      </div>
      <div>
        <div className={styles.trackCount}>{count}</div>
        <div className={styles.trackCountLabel}>plays</div>
      </div>
    </div>
  );
}
