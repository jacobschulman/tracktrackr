export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { loadIndex, getFestivalSummaries, getSetRecordings, fmt } from '@/lib/data';
import { FestivalBadge } from '@/components/FestivalBadge';
import { SpotifyButton } from '@/components/SpotifyButton';
import fs from 'fs';
import path from 'path';

type LeaderboardEntry = {
  slug: string;
  key: string;
  artist: string;
  title: string;
  playCount: number;
  years: number[];
  djs: string[];
  festivals: string[];
  festivalCounts: Record<string, number>;
  yearCounts: Record<string, number>;
};

type TrackFile = {
  slug: string;
  artist: string;
  title: string;
  playCount: number;
  years: number[];
  streak?: { streak: number };
  history: { dj: string; date: string; festival: string; festivalName: string }[];
};

/** Pick the single most interesting fact about a track */
function pickInsight(entry: LeaderboardEntry, trackFile: TrackFile, rank: number): string {
  const streak = trackFile.streak?.streak ?? entry.years.length;
  const djCount = entry.djs.length;
  const yearCounts = entry.yearCounts;

  // Peak year
  let peakYear = 0, peakCount = 0;
  for (const [y, c] of Object.entries(yearCounts)) {
    if (c > peakCount) { peakCount = c; peakYear = Number(y); }
  }

  // Trend: compare last 2 years vs prior 2
  const recent = (yearCounts['2026'] ?? 0) + (yearCounts['2025'] ?? 0);
  const prior = (yearCounts['2024'] ?? 0) + (yearCounts['2023'] ?? 0);
  const surgingHard = recent > prior * 2 && recent > 30;

  // Top festival
  let topFest = '', topFestCount = 0;
  for (const [f, c] of Object.entries(entry.festivalCounts)) {
    if (c > topFestCount) { topFestCount = c; topFest = f; }
  }

  // Pick the most remarkable thing
  if (streak >= 15) return `${streak}-year streak — played every year since ${entry.years[0]}`;
  if (djCount >= 150) return `Played by ${djCount}+ DJs across ${entry.festivals.length} festivals`;
  if (surgingHard) return `Surging — ${recent} plays in the last 2 years, up from ${prior}`;
  if (streak >= 10) return `${streak}-year streak since ${entry.years[0]}`;
  if (djCount >= 80) return `${djCount} different DJs have dropped this`;
  if (peakCount >= 40) return `Peaked in ${peakYear} with ${peakCount} plays`;
  if (entry.festivals.length >= 8) return `Crossed ${entry.festivals.length} festivals worldwide`;
  return `${djCount} DJs · ${streak}yr streak`;
}

export default function HomePage() {
  const index = loadIndex();
  const totalSets = index.sets.length;
  const totalDJs = new Set(index.sets.flatMap(s => s.djs.map(d => d.slug))).size;
  const festivalSummaries = getFestivalSummaries();
  const totalFestivals = festivalSummaries.length;

  // Recent festival
  const recentFestival = festivalSummaries
    .map(f => {
      const fSets = index.sets.filter(s => s.festival === f.slug);
      const maxDate = fSets.reduce((max, s) => s.date > max ? s.date : max, '');
      const maxYear = fSets.reduce((max, s) => s.year > max ? s.year : max, 0);
      const latestYearSets = fSets.filter(s => s.year === maxYear);
      const hasW1 = latestYearSets.some(s => /-weekend-1\b/i.test(s.url || ''));
      const hasW2 = latestYearSets.some(s => /-weekend-2\b/i.test(s.url || ''));
      const weekendLabel = hasW1 && !hasW2 ? 'Weekend 1' : !hasW1 && hasW2 ? 'Weekend 2' : '';
      return { ...f, maxDate, maxYear, setCount: latestYearSets.length, weekendLabel };
    })
    .sort((a, b) => b.maxDate.localeCompare(a.maxDate))[0];

  // --- PLAY NOW: random playable sets from this year ---
  const latestYear = Math.max(...index.years);

  // Collect ALL playable sets from this year, then shuffle for variety
  const allPlayable: {
    tlId: string;
    dj: string;
    stage: string;
    festival: string;
    festivalName: string;
    date: string;
    platform: 'youtube' | 'soundcloud';
    url: string;
    tracksIdentified: number;
    tracksTotal: number;
  }[] = [];

  for (const s of index.sets.filter(s => s.year === latestYear)) {
    const rec = getSetRecordings(s.tlId);
    if (!rec) continue;
    const platform = rec.ytUrl ? 'youtube' : 'soundcloud';
    const url = rec.ytUrl || rec.scUrl!;
    allPlayable.push({
      tlId: s.tlId,
      dj: s.dj,
      stage: s.stage,
      festival: s.festival!,
      festivalName: s.festivalName!,
      date: s.date,
      platform,
      url,
      tracksIdentified: s.tracksIdentified,
      tracksTotal: s.tracksTotal,
    });
  }

  // Fisher-Yates shuffle so every page load is different
  for (let i = allPlayable.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allPlayable[i], allPlayable[j]] = [allPlayable[j], allPlayable[i]];
  }
  const playableSets = allPlayable.slice(0, 6);
  const totalPlayable = allPlayable.length;

  // --- TRENDING TRACKS with per-track insights ---
  let allLeaderboard: LeaderboardEntry[] = [];
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'data', 'tracks-leaderboard.json'), 'utf-8');
    allLeaderboard = JSON.parse(raw);
  } catch {}

  const topTracksThisYear = allLeaderboard
    .filter(t => t.years.includes(latestYear))
    .sort((a, b) => (b.yearCounts?.[latestYear] || 0) - (a.yearCounts?.[latestYear] || 0))
    .slice(0, 8);

  const topTracksAllTime = allLeaderboard.slice(0, 8);

  function loadTrackFile(slug: string): TrackFile | null {
    try {
      return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'tracks', `${slug}.json`), 'utf-8'));
    } catch { return null; }
  }

  const thisYearRows = topTracksThisYear.map((entry, i) => {
    const tf = loadTrackFile(entry.slug);
    const insight = tf ? pickInsight(entry, tf, i) : `${entry.djs.length} DJs`;
    const yearCount = entry.yearCounts?.[latestYear] ?? entry.playCount;
    const lastPlay = tf?.history?.[0];
    return { entry, insight, yearCount, lastPlay };
  });

  const allTimeRows = topTracksAllTime.map((entry, i) => {
    const tf = loadTrackFile(entry.slug);
    const insight = tf ? pickInsight(entry, tf, i) : `${entry.djs.length} DJs`;
    const lastPlay = tf?.history?.[0];
    return { entry, insight, lastPlay };
  });

  const maxPlayThisYear = thisYearRows[0]?.yearCount ?? 1;

  // Up Next
  const upNextSlug = recentFestival?.slug === 'coachella' ? 'edc-las-vegas' : 'coachella';
  const upNextFestival = festivalSummaries.find(f => f.slug === upNextSlug) || null;

  const topFestivals = festivalSummaries.slice(0, 6);

  return (
    <>
      {/* Hero — minimal */}
      <div style={{ padding: '40px 0 20px' }}>
        <h1 style={{ fontSize: '2.75rem', fontWeight: 900, letterSpacing: '-0.03em', margin: 0, lineHeight: 1.1 }}>
          TrackTrackr
        </h1>
        <p style={{ fontSize: '1.0625rem', color: 'var(--muted-lt)', marginTop: 12, maxWidth: 500, lineHeight: 1.5 }}>
          Listen to festival sets. Dive deep into tracklists. Discover your next favorite track.
        </p>
      </div>

      {/* Global stats — inline, not boxed */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 28, fontSize: '0.8125rem', color: 'var(--muted-lt)' }}>
        <span><strong style={{ color: 'var(--text-bright)', fontSize: '1.25rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmt(totalFestivals)}</strong> festivals</span>
        <span><strong style={{ color: 'var(--text-bright)', fontSize: '1.25rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmt(totalDJs)}</strong> DJs</span>
        <span><strong style={{ color: 'var(--text-bright)', fontSize: '1.25rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmt(index.years.length)}</strong> years</span>
      </div>

      {/* ──── PLAY NOW ──── */}
      {playableSets.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div className="card-header" style={{ marginBottom: 0 }}>
            <div className="card-title">Jump In</div>
            <Link href="/sets" style={{ fontSize: '0.75rem', color: 'var(--purple-lt)', textDecoration: 'none' }}>All {totalPlayable} sets from {latestYear} &rarr;</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, marginTop: 12 }}>
            {playableSets.map(s => (
              <Link
                key={s.tlId}
                href={`/set/${s.tlId}`}
                className="card"
                style={{ display: 'block', textDecoration: 'none', color: 'inherit', padding: '16px 18px' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: 3 }}>{s.dj}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                      {s.stage} · {new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    {s.tracksTotal > 0 && (
                      <div style={{ fontSize: '0.6875rem', color: 'var(--muted)', marginTop: 4 }}>
                        {s.tracksIdentified}/{s.tracksTotal} tracks ID&apos;d
                      </div>
                    )}
                  </div>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: s.platform === 'youtube' ? 'rgba(255,0,0,0.15)' : 'rgba(255,85,0,0.15)',
                    color: s.platform === 'youtube' ? '#f87171' : '#fb923c',
                  }}>
                    {s.platform === 'youtube' ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    )}
                  </div>
                </div>
                <FestivalBadge festival={s.festival} size="sm" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Latest festival spotlight */}
      {recentFestival && (
        <Link
          href={`/festivals/${recentFestival.slug}`}
          className="card"
          style={{
            display: 'block',
            marginBottom: 12,
            textDecoration: 'none',
            color: 'inherit',
            borderLeft: `4px solid ${recentFestival.accent}`,
          }}
        >
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 6 }}>
                  Latest Festival
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4 }}>
                  {recentFestival.shortName} {recentFestival.maxYear}
                  {recentFestival.weekendLabel && (
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: recentFestival.accent, marginLeft: 8, letterSpacing: '0.02em' }}>
                      {recentFestival.weekendLabel}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--muted-lt)' }}>
                  {recentFestival.setCount} sets &middot; {fmt(recentFestival.totalSets)} total across {recentFestival.years.length} years
                </div>
              </div>
              <div style={{ fontSize: '0.8125rem', color: recentFestival.accent, fontWeight: 600 }}>
                Explore &rarr;
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Up Next */}
      {upNextFestival && (
        <Link
          href={`/festivals/${upNextFestival.slug}`}
          className="card"
          style={{
            display: 'block',
            marginBottom: 28,
            textDecoration: 'none',
            color: 'inherit',
            borderLeft: `4px solid ${upNextFestival.accent}`,
          }}
        >
          <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Up Next:</div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>{upNextFestival.shortName}</div>
            </div>
            <div style={{ fontSize: '0.8125rem', color: upNextFestival.accent, fontWeight: 600 }}>
              View history &rarr;
            </div>
          </div>
        </Link>
      )}

      {/* ──── TRENDING THIS YEAR ──── */}
      {thisYearRows.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div className="card-title">Most Played in {latestYear}</div>
            <Link href="/tracks" style={{ fontSize: '0.75rem', color: 'var(--purple-lt)', textDecoration: 'none' }}>View all &rarr;</Link>
          </div>
          {thisYearRows.map(({ entry, insight, yearCount, lastPlay }, i) => {
            const rank = i + 1;
            const pct = (yearCount / maxPlayThisYear) * 100;
            return (
              <Link
                key={entry.key}
                href={`/track/${entry.slug}`}
                className="leaderboard-row"
                style={{ textDecoration: 'none', cursor: 'pointer' }}
              >
                <div className={`leaderboard-rank ${rank <= 3 ? 'top3' : ''}`}>{rank}</div>
                <div className="leaderboard-info">
                  <div className="leaderboard-name">{entry.artist} &mdash; {entry.title}</div>
                  <div className="leaderboard-meta">
                    <span style={{ color: 'var(--purple-lt)', fontWeight: 600 }}>{insight}</span>
                    {lastPlay && (
                      <>
                        <span className="sep">&middot;</span>
                        <span>Last: {lastPlay.dj}, {new Date(lastPlay.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </>
                    )}
                  </div>
                  <div className="leaderboard-bar">
                    <div className="leaderboard-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="leaderboard-count">{yearCount}</div>
                  <div className="leaderboard-count-label">plays</div>
                </div>
                <SpotifyButton artist={entry.artist} title={entry.title} />
              </Link>
            );
          })}
        </div>
      )}

      {/* ──── ALL TIME ──── */}
      {allTimeRows.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div className="card-title">Most Played All Time</div>
            <Link href="/tracks" style={{ fontSize: '0.75rem', color: 'var(--purple-lt)', textDecoration: 'none' }}>View all &rarr;</Link>
          </div>
          {allTimeRows.map(({ entry, insight, lastPlay }, i) => {
            const rank = i + 1;
            const maxAll = allTimeRows[0].entry.playCount;
            const pct = (entry.playCount / maxAll) * 100;
            return (
              <Link
                key={entry.key}
                href={`/track/${entry.slug}`}
                className="leaderboard-row"
                style={{ textDecoration: 'none', cursor: 'pointer' }}
              >
                <div className={`leaderboard-rank ${rank <= 3 ? 'top3' : ''}`}>{rank}</div>
                <div className="leaderboard-info">
                  <div className="leaderboard-name">{entry.artist} &mdash; {entry.title}</div>
                  <div className="leaderboard-meta">
                    <span style={{ color: 'var(--green)', fontWeight: 600 }}>{insight}</span>
                    {lastPlay && (
                      <>
                        <span className="sep">&middot;</span>
                        <span>Last: {lastPlay.dj}, {new Date(lastPlay.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </>
                    )}
                  </div>
                  <div className="leaderboard-bar">
                    <div className="leaderboard-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="leaderboard-count">{fmt(entry.playCount)}</div>
                  <div className="leaderboard-count-label">plays</div>
                </div>
                <SpotifyButton artist={entry.artist} title={entry.title} />
              </Link>
            );
          })}
        </div>
      )}

      {/* Festivals grid */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">Explore Festivals</div>
          <Link href="/festivals" style={{ fontSize: '0.75rem', color: 'var(--purple-lt)', textDecoration: 'none' }}>View all &rarr;</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, padding: '4px 0' }}>
          {topFestivals.map(f => (
            <Link
              key={f.slug}
              href={`/festivals/${f.slug}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                background: 'var(--surface)',
                borderRadius: 8,
                textDecoration: 'none',
                color: 'inherit',
                borderLeft: `3px solid ${f.accent}`,
                transition: 'background 0.15s',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{f.shortName}</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--muted)' }}>
                  {fmt(f.totalSets)} sets &middot; {f.years.length} years
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div style={{ fontSize: '0.6875rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 10, textAlign: 'center' }}>
        Explore More
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
        <Link href="/djs" className="card" style={{ textDecoration: 'none', color: 'inherit', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>&#9678;</div>
          <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>DJs</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Leaderboards & profiles</div>
        </Link>
        <Link href="/sets" className="card" style={{ textDecoration: 'none', color: 'inherit', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>&#9719;</div>
          <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Sets</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Browse & listen</div>
        </Link>
        <Link href="/tracks" className="card" style={{ textDecoration: 'none', color: 'inherit', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>&#9835;</div>
          <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Tracks</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Most played & trending</div>
        </Link>
        <Link href="/festivals" className="card" style={{ textDecoration: 'none', color: 'inherit', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>&#9733;</div>
          <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Festivals</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>All {totalFestivals} festivals</div>
        </Link>
      </div>
    </>
  );
}
