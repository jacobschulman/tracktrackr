import { loadIndex, loadSet, loadDJIndex, trackKey, getDJHistory } from '@/lib/data';
import { getStageColor } from '@/lib/festivals';
import { fmt } from '@/lib/data';
import { trackSlug, slugify } from '@/lib/slugs';
import { StageBadge } from '@/components/StageBadge';
import { FestivalBadge } from '@/components/FestivalBadge';
import Link from 'next/link';
import { PlayButtons } from './PlayButtons';

// Only pre-build recent sets; rest rendered on-demand by Vercel
export function generateStaticParams() {
  return [];
}

function isIDTrack(artist: string, title: string): boolean {
  const a = (artist || '').toLowerCase().trim();
  const t = (title || '').toLowerCase().trim();
  return (
    a === 'id' || t === 'id' || a === '' || t === '' ||
    t.startsWith('id (') || t === 'id?' || a === 'id?'
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '\u2014';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default async function SetPage({ params }: { params: Promise<{ tlId: string }> }) {
  const { tlId } = await params;
  const index = loadIndex();
  const setData = loadSet(tlId);

  if (!setData) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">?</div>
        <div className="empty-state-text">Set not found.</div>
      </div>
    );
  }

  const djSlug = setData.djs?.[0]?.slug || '';
  const djName = setData.dj || 'Unknown DJ';
  const dateFormatted = formatDate(setData.date);
  const stageColor = getStageColor(setData.festival || 'ultra-miami', setData.stage);

  // Same day sets on same stage
  const sameDaySets = index.sets
    .filter(
      (s) =>
        s.date === setData.date &&
        s.stage === setData.stage &&
        s.tlId !== tlId
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  // DJ's other sets
  const djHistory = djSlug ? getDJHistory(djSlug) : [];
  const otherSets = djHistory.filter((s) => s.tlId !== tlId);

  const tracks = setData.tracks || [];
  const normalTracks = tracks.filter(
    (t) => t.type === 'normal' || t.type === 'blend'
  );

  // Build enrichment data from pre-built DJ index (no loadAllSets needed)
  const djAnthems = new Map<string, number[]>();
  const trackPopularity = new Map<string, number>();

  const djIdx = djSlug ? loadDJIndex(djSlug) : null;
  if (djIdx) {
    // Signature tracks = tracks this DJ plays repeatedly (anthems)
    const sigMap = new Map<string, number[]>();
    for (const st of (djIdx.signatureTracks || [])) {
      sigMap.set(st.key, st.years);
    }
    for (const t of tracks) {
      if (t.type !== 'normal' && t.type !== 'blend') continue;
      if (isIDTrack(t.artist, t.title)) continue;
      const key = trackKey(t.artist, t.title);
      const sigYears = sigMap.get(key);
      if (sigYears && sigYears.length > 0) {
        const otherYears = sigYears.filter((y: number) => y !== setData.year);
        if (otherYears.length > 0) djAnthems.set(key, otherYears);
      }
    }
    // Supported tracks = tracks by this DJ played by others
    for (const st of (djIdx.supportedTracks || [])) {
      trackPopularity.set(st.key, st.playedByCount);
    }
  }

  // Build set of trackIds that appear in a parent's blendGroup
  const blendGroupTrackIds = new Set<string>();
  for (const t of tracks) {
    if (t.type === 'normal' && t.blendGroup && t.blendGroup.length >= 2) {
      for (const bg of t.blendGroup) {
        if ((bg as any).trackId && (bg as any).trackId !== t.trackId)
          blendGroupTrackIds.add((bg as any).trackId);
      }
    }
  }

  // Recordings
  const recordings = (setData as any).recordings || [];
  const ytRec = recordings.find((r: any) => r.platform === 'youtube');
  const scRec = recordings.find((r: any) => r.platform === 'soundcloud');

  // Compute real identified count from actual track data
  const identifiedTracks = normalTracks.filter(t => !isIDTrack(t.artist, t.title));
  const festivalDisplayName = setData.festivalName || 'Festival';

  return (
    <>
      {/* Hero */}
      <div
        style={{
          borderLeft: `4px solid ${stageColor}`,
          paddingLeft: '20px',
          marginBottom: '32px',
        }}
      >
        <h1 style={{ marginBottom: '6px', fontSize: '2rem' }}>
          {djSlug ? (
            <Link
              href={`/dj/${djSlug}`}
              className="dj-link"
              style={{ color: 'var(--text-bright)' }}
            >
              {djName}
            </Link>
          ) : (
            djName
          )}
          <span style={{ color: 'var(--muted-lt)', fontWeight: 400 }}> at {festivalDisplayName}</span>
        </h1>
        <div style={{ fontSize: '0.9375rem', color: 'var(--muted-lt)', marginBottom: 12 }}>
          {dateFormatted}
          {(setData as any).duration && <> &middot; {(setData as any).duration}</>}
          &nbsp;&middot;&nbsp;
          <StageBadge stage={setData.stage} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <FestivalBadge festival={setData.festival || 'ultra-miami'} size="md" />
          <span style={{ fontSize: '0.8125rem', color: 'var(--muted-lt)' }}>{identifiedTracks.length} of {normalTracks.length} tracks identified</span>
          <a
            href={`https://www.1001tracklists.com/tracklist/${tlId}/`}
            target="_blank"
            rel="noopener"
            className="ext-link"
            style={{ color: 'var(--purple-lt)', fontSize: '0.8125rem' }}
          >
            1001Tracklists &rarr;
          </a>
        </div>
        {/* Recording play buttons */}
        <PlayButtons
          ytUrl={ytRec?.url}
          scUrl={scRec?.url}
          title={`${djName} @ ${setData.stage} · ${festivalDisplayName} · ${setData.year}`}
          tlId={tlId}
        />
      </div>

      {/* Tracklist */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div className="card-title">Tracklist</div>
          <div className="text-muted" style={{ fontSize: '0.75rem' }}>
            {identifiedTracks.length} of {normalTracks.length} identified
          </div>
        </div>
        <div>
          {tracks.map((t, idx) => {
            const isID = isIDTrack(t.artist, t.title);
            const key = !isID ? trackKey(t.artist, t.title) : null;
            const slug = key ? trackSlug(t.artist, t.title) : null;
            const anthemYears = key ? djAnthems.get(key) : null;
            const otherDJCount = key ? trackPopularity.get(key) : null;

            // Skip blend-type tracks whose trackId is already shown in a parent's blendGroup
            if (t.type === 'blend' && t.trackId && blendGroupTrackIds.has(t.trackId)) {
              return null;
            }

            if (isID) {
              return (
                <div key={idx} className="set-track" style={{ opacity: 0.4 }}>
                  <div className="set-track-pos">{t.pos || ''}</div>
                  <div className="set-track-info">
                    <span
                      style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}
                    >
                      ID &mdash; ID
                    </span>
                  </div>
                </div>
              );
            }

            // Blend sub-tracks for this normal track
            const hasBlend = t.blendGroup && t.blendGroup.length >= 2;
            const blendTracks = hasBlend
              ? t.blendGroup!.filter(
                  (bg) =>
                    !isIDTrack(bg.artist, bg.title) &&
                    (bg as any).trackId !== t.trackId
                )
              : [];

            if (t.type === 'blend') {
              // Standalone w/ track
              return (
                <div
                  key={idx}
                  className="set-track blend-track"
                  style={{
                    marginLeft: '28px',
                    borderLeft: '2px solid var(--pink)',
                    paddingLeft: '12px',
                  }}
                >
                  <div
                    className="set-track-pos"
                    style={{ color: 'var(--pink)', fontSize: '0.75rem' }}
                  >
                    w/
                  </div>
                  <div className="set-track-info">
                    <Link
                      href={`/track/${slug}`}
                      className="track-link"
                      style={{ fontSize: '0.8125rem' }}
                    >
                      <span style={{ fontWeight: 500 }}>{t.artist}</span>
                      <span style={{ color: 'var(--muted-lt)' }}>
                        {' '}
                        &mdash; {t.title}
                      </span>
                      {t.remix && (
                        <span
                          style={{
                            color: 'var(--muted)',
                            fontSize: '0.75rem',
                          }}
                        >
                          {' '}
                          ({t.remix})
                        </span>
                      )}
                    </Link>
                    {t.label && (
                      <div
                        style={{
                          fontSize: '0.6875rem',
                          color: 'var(--muted)',
                          marginTop: '1px',
                        }}
                      >
                        {t.label}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            const spotifyQ = encodeURIComponent(`${t.artist} ${t.title}`);

            return (
              <div key={idx}>
                <div className="set-track">
                  <div className="set-track-pos">{t.pos || ''}</div>
                  <div className="set-track-info">
                    <Link href={`/track/${slug}`} className="track-link">
                      <span style={{ fontWeight: 500 }}>{t.artist}</span>
                      <span style={{ color: 'var(--muted-lt)' }}>
                        {' '}
                        &mdash; {t.title}
                      </span>
                      {t.remix && (
                        <span
                          style={{
                            color: 'var(--muted)',
                            fontSize: '0.8125rem',
                          }}
                        >
                          {' '}
                          ({t.remix})
                        </span>
                      )}
                    </Link>
                    {t.label && (
                      <div
                        style={{
                          fontSize: '0.6875rem',
                          color: 'var(--muted)',
                          marginTop: '1px',
                        }}
                      >
                        {t.label}
                      </div>
                    )}
                  </div>
                  <div className="set-track-badges">
                    {anthemYears && (
                      <span
                        className="pill pill-purple"
                        title={`Also played by ${djName} in ${anthemYears.join(', ')}`}
                        style={{ fontSize: '0.625rem', cursor: 'help' }}
                      >
                        &#9733; {anthemYears.length}yr
                      </span>
                    )}
                    {otherDJCount ? (
                      <span
                        className="pill"
                        title={`${otherDJCount} other DJs played this`}
                        style={{ fontSize: '0.625rem', cursor: 'help' }}
                      >
                        {otherDJCount} DJs
                      </span>
                    ) : null}
                    <a
                      href={`https://open.spotify.com/search/${spotifyQ}`}
                      target="_blank"
                      rel="noopener"
                      title="Search on Spotify"
                      className="spotify-btn"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                    </a>
                  </div>
                </div>
                {/* Blend sub-tracks */}
                {blendTracks.length > 0 && (
                  <div
                    className="set-track blend-track"
                    style={{
                      marginLeft: '28px',
                      borderLeft: '2px solid var(--pink)',
                      paddingLeft: '12px',
                    }}
                  >
                    <div
                      className="set-track-pos"
                      style={{ color: 'var(--pink)', fontSize: '0.75rem' }}
                    >
                      w/
                    </div>
                    <div className="set-track-info">
                      {blendTracks.map((bg, bi) => (
                        <span key={bi}>
                          {bi > 0 && (
                            <span
                              style={{
                                color: 'var(--muted)',
                                fontSize: '0.6875rem',
                              }}
                            >
                              {' '}
                              +{' '}
                            </span>
                          )}
                          <Link
                            href={`/track/${trackSlug(bg.artist, bg.title)}`}
                            className="track-link"
                            style={{ fontSize: '0.8125rem' }}
                          >
                            {bg.artist} &mdash; {bg.title}
                            {bg.remix ? ` (${bg.remix})` : ''}
                          </Link>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Same day sets */}
      {sameDaySets.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              Also on {setData.stage} &middot; {dateFormatted}
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {sameDaySets.map((s) => (
              <Link
                key={s.tlId}
                href={`/set/${s.tlId}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  background: 'var(--surface2)',
                  borderRadius: '8px',
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                {s.djs.map((d) => d.name).join(' & ')}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* More sets by this DJ */}
      {otherSets.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <div className="card-title">More sets by {djName}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {otherSets.slice(0, 12).map((s) => {
              const label = s.festival === setData.festival && s.stage === setData.stage
                ? `${s.year}`
                : `${s.year} \u00B7 ${s.festivalName || s.festival}`;
              return (
                <Link
                  key={s.tlId}
                  href={`/set/${s.tlId}`}
                  className={`pill${s.year === setData.year && s.festival === setData.festival ? ' pill-purple' : ''}`}
                  style={{ cursor: 'pointer', fontSize: '0.6875rem' }}
                >
                  {label}
                </Link>
              );
            })}
            {otherSets.length > 12 && (
              <Link
                href={`/dj/${djSlug}`}
                className="pill"
                style={{ cursor: 'pointer', fontSize: '0.6875rem' }}
              >
                +{otherSets.length - 12} more
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
