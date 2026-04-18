import styles from './prototype.module.css';

type HistoryEntry = {
  dj: string;
  date: string;
  festival: string;
  festivalName: string;
};

type Props = {
  title: string;
  artist: string;
  playCount: number;
  djCount: number;
  streak: number;
  peakYear: number;
  peakCount: number;
  years: number[];
  lastPlay: HistoryEntry;
  topFestival: string;
  topFestivalCount: number;
  trending: 'up' | 'down' | 'stable';
};

export function TrackRowPlayful({
  title,
  artist,
  playCount,
  djCount,
  streak,
  peakYear,
  peakCount,
  years,
  lastPlay,
  topFestival,
  topFestivalCount,
  trending,
}: Props) {
  const yearSpan = `${Math.min(...years)}–${Math.max(...years)}`;
  const trendIcon = trending === 'up' ? '↑' : trending === 'down' ? '↓' : '→';
  const trendClass =
    trending === 'up' ? styles.trendUp : trending === 'down' ? styles.trendDown : styles.trendFlat;

  const lastDate = new Date(lastPlay.date);
  const lastDateStr = lastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

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

      <div className={styles.trackInsights}>
        <span className={styles.insight}>
          <span className={styles.insightNum}>{djCount}</span> DJs
        </span>
        <span className={styles.insightDot}>·</span>
        <span className={styles.insight}>
          <span className={styles.insightNum}>{streak}</span>yr streak
        </span>
        <span className={styles.insightDot}>·</span>
        <span className={styles.insight}>
          Peak <span className={styles.insightNum}>{peakCount}</span> in {peakYear}
        </span>
      </div>

      <div className={styles.trackLastPlay}>
        <div className={styles.lastPlayLine}>
          Last: <strong>{lastPlay.dj}</strong>
        </div>
        <div className={styles.lastPlaySub}>
          {lastDateStr} · {topFestival}
        </div>
      </div>

      <div className={styles.trackCountWrap}>
        <div className={styles.trackCount}>{playCount}</div>
        <div className={`${styles.trackTrend} ${trendClass}`}>{trendIcon}</div>
      </div>
    </div>
  );
}
