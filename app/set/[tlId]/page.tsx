import { loadIndex, loadSet, loadAllSets, getTrackHistory, trackKey, getDJHistory } from '@/lib/data';
import { getStageColor } from '@/lib/config';
import { fmt } from '@/lib/data';
import { trackSlug, slugify } from '@/lib/slugs';
import { StageBadge } from '@/components/StageBadge';
import Link from 'next/link';

export function generateStaticParams() {
  const index = loadIndex();
  return index.sets.filter((s) => s.hasSetFile).map((s) => ({ tlId: s.tlId }));
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
  loadAllSets();
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
  const stageColor = getStageColor(setData.stage);

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

  // Build enrichment data: DJ anthems and track popularity
  const djAnthems = new Map<string, number[]>();
  const trackPopularity = new Map<string, number>();

  for (const t of tracks) {
    if (t.type !== 'normal' && t.type !== 'blend') continue;
    if (isIDTrack(t.artist, t.title)) continue;
    const key = trackKey(t.artist, t.title);
    const history = getTrackHistory(t.artist, t.title);
    if (history.length > 0) {
      const djYears = history
        .filter(
          (a) => a.djSlugs?.includes(djSlug) && a.year !== setData.year
        )
        .map((a) => a.year);
      if (djYears.length > 0) {
        djAnthems.set(key, [...new Set(djYears)].sort((a, b) => a - b));
      }
      const otherDJs = new Set(
        history.filter((a) => !a.djSlugs?.includes(djSlug)).map((a) => a.dj)
      );
      if (otherDJs.size > 0) {
        trackPopularity.set(key, otherDJs.size);
      }
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
        <div
          style={{
            fontSize: '0.75rem',
            color: 'var(--muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '4px',
          }}
        >
          {setData.year} &middot; {setData.stage}
        </div>
        <h1 style={{ marginBottom: '8px' }}>
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
        </h1>
        <div className="detail-meta">
          <span>{dateFormatted}</span>
          <span className="separator">&middot;</span>
          <StageBadge stage={setData.stage} />
          {(setData as any).duration && (
            <>
              <span className="separator">&middot;</span>
              <span>{(setData as any).duration}</span>
            </>
          )}
          <span className="separator">&middot;</span>
          <span>{normalTracks.length} tracks</span>
          <span className="separator">&middot;</span>
          <a
            href={`https://www.1001tracklists.com/tracklist/${tlId}/`}
            target="_blank"
            rel="noopener"
            className="ext-link"
            style={{ color: 'var(--purple-lt)', fontSize: '0.8125rem' }}
          >
            1001Tracklists
          </a>
        </div>
        {/* Recording play buttons */}
        {(ytRec || scRec) && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
            {ytRec && (
              <a
                href={ytRec.url}
                target="_blank"
                rel="noopener"
                className="rec-btn rec-btn-yt"
              >
                &#9654; Play on YouTube
              </a>
            )}
            {scRec && (
              <a
                href={scRec.url}
                target="_blank"
                rel="noopener"
                className="rec-btn rec-btn-sc"
              >
                &#9654; Play on SoundCloud
              </a>
            )}
          </div>
        )}
      </div>

      {/* DJ's other sets */}
      {otherSets.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            marginBottom: '24px',
          }}
        >
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--muted)',
              alignSelf: 'center',
            }}
          >
            {djName} at Ultra:
          </span>
          {otherSets.slice(0, 12).map((s) => (
            <Link
              key={s.tlId}
              href={`/set/${s.tlId}`}
              className={`pill${s.year === setData.year ? ' pill-purple' : ''}`}
              style={{ cursor: 'pointer', fontSize: '0.6875rem' }}
            >
              {s.year}
              {s.stage === setData.stage
                ? ''
                : ` \u00B7 ${s.stage.split(' ')[0]}`}
            </Link>
          ))}
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
      )}

      {/* Tracklist */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div className="card-title">Tracklist</div>
          <div className="text-muted" style={{ fontSize: '0.75rem' }}>
            {(setData as any).tracksIdentified || 0} of{' '}
            {(setData as any).tracksTotal || tracks.length} identified
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
                      className="spotify-link"
                      style={{
                        fontSize: '0.625rem',
                        color: 'var(--green)',
                        opacity: 0.4,
                        textDecoration: 'none',
                      }}
                    >
                      &#9835;
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
    </>
  );
}
