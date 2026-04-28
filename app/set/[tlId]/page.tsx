import { loadIndex, loadSet, loadDJIndex, trackKey, getDJHistory } from '@/lib/data';
import { getStageColor, getFestival } from '@/lib/festivals';
import { fmt } from '@/lib/data';
import { trackSlug, slugify } from '@/lib/slugs';
import { StageBadge } from '@/components/StageBadge';
import { FestivalBadge } from '@/components/FestivalBadge';
import Link from 'next/link';
import { PlayButtons } from './PlayButtons';
import { SetTracklist } from './SetTracklist';
import type { Metadata } from 'next';

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ tlId: string }> }): Promise<Metadata> {
  const { tlId } = await params;
  const setData = loadSet(tlId);
  if (!setData) return { title: 'Set | TrackTrackr' };
  const djName = setData.dj || 'Unknown DJ';
  const festival = setData.festivalName || setData.festival || '';
  const year = setData.year;
  const title = `${djName} at ${festival} ${year} | TrackTrackr`;
  const tracks = (setData.tracks || []).filter(t => t.type === 'normal' || t.type === 'blend').length;
  const desc = `${djName} at ${festival} ${year} — ${tracks} tracks`;
  return {
    title,
    description: desc,
    openGraph: { title, description: desc },
    twitter: { title, description: desc },
  };
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
  const setMeta = index.sets.find(s => s.tlId === tlId);
  const festivalConfig = getFestival(setData.festival || '');
  const weekend = setMeta?.weekend ?? null;

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
          {weekend && (
            <span style={{
              marginLeft: 8,
              fontSize: '0.75rem',
              fontWeight: 700,
              color: festivalConfig?.accent || 'var(--muted)',
              background: `${festivalConfig?.accent || '#64748b'}18`,
              padding: '2px 7px',
              borderRadius: 4,
            }}>
              W{weekend}
            </span>
          )}
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
        <SetTracklist
          tlId={tlId}
          djName={djName}
          hasCueTimes={tracks.some(t => t.cueTime != null && t.cueTime > 0)}
          tracks={tracks.map((t, idx) => {
            const isID = isIDTrack(t.artist, t.title);
            const key = !isID ? trackKey(t.artist, t.title) : null;
            const slug = key ? trackSlug(t.artist, t.title) : null;
            const anthemYears = key ? djAnthems.get(key) || null : null;
            const otherDJCount = key ? trackPopularity.get(key) || null : null;
            const skipRender = t.type === 'blend' && !!t.trackId && blendGroupTrackIds.has(t.trackId);
            const hasBlend = t.type === 'normal' && t.blendGroup && t.blendGroup.length >= 2;
            const blendTracks = hasBlend
              ? t.blendGroup!
                  .filter((bg) => !isIDTrack(bg.artist, bg.title) && (bg as any).trackId !== t.trackId)
                  .map((bg) => ({ artist: bg.artist, title: bg.title, remix: bg.remix || '', slug: trackSlug(bg.artist, bg.title) }))
              : [];

            return {
              idx,
              pos: t.pos,
              artist: t.artist,
              title: t.title,
              remix: t.remix,
              label: t.label,
              trackId: t.trackId,
              type: t.type,
              cueTime: t.cueTime ?? null,
              slug,
              isID,
              anthemYears,
              otherDJCount,
              blendTracks,
              spotifyQ: encodeURIComponent(`${t.artist} ${t.title}`),
              skipRender,
            };
          })}
        />
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
