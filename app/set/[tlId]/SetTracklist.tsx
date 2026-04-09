'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { seekPlayer } from '@/components/PlayerBar';

interface TrackRow {
  idx: number;
  pos: string;
  artist: string;
  title: string;
  remix: string;
  label: string;
  trackId: string;
  type: string;
  cueTime: number | null;
  slug: string | null;
  isID: boolean;
  anthemYears: number[] | null;
  otherDJCount: number | null;
  blendTracks: { artist: string; title: string; remix?: string; slug: string }[];
  spotifyQ: string;
  skipRender: boolean;
}

interface Props {
  tracks: TrackRow[];
  djName: string;
  tlId: string;
  hasCueTimes: boolean;
}

const playerBus = typeof window !== 'undefined'
  ? (window as any).__playerBus ||= new EventTarget()
  : null;

function fmtCueTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function SetTracklist({ tracks, djName, tlId, hasCueTimes }: Props) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!playerBus || !hasCueTimes) return;

    const handler = (e: Event) => {
      const { currentTime, tlId: playingTlId, playing } = (e as CustomEvent).detail;
      setIsPlaying(playing);

      // Only highlight if we're playing THIS set
      if (playingTlId !== tlId) {
        setActiveIdx(null);
        return;
      }
      if (!playing) return;

      // Find the last track whose cueTime <= currentTime
      let best: number | null = null;
      for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i];
        if (t.skipRender || t.isID || t.type === 'blend') continue;
        if (t.cueTime != null && currentTime >= t.cueTime) {
          best = i;
        }
      }
      setActiveIdx(best);
    };
    playerBus.addEventListener('progress', handler);
    return () => playerBus.removeEventListener('progress', handler);
  }, [tlId, tracks, hasCueTimes]);

  const handleSeek = useCallback((cueTime: number | null) => {
    if (cueTime == null) return;
    seekPlayer(cueTime);
  }, []);

  return (
    <div>
      {tracks.map((t) => {
        if (t.skipRender) return null;

        const isActive = activeIdx === t.idx && isPlaying;
        const canSeek = hasCueTimes && t.cueTime != null && t.type !== 'blend';

        if (t.isID) {
          return (
            <div
              key={t.idx}
              className={`set-track${isActive ? ' set-track-active' : ''}`}
              style={{ opacity: 0.4, cursor: canSeek ? 'pointer' : undefined }}
              onClick={canSeek ? () => handleSeek(t.cueTime) : undefined}
            >
              <div className="set-track-pos">{t.pos || ''}</div>
              <div className="set-track-info">
                <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
                  ID &mdash; ID
                </span>
              </div>
              {canSeek && t.cueTime != null && (
                <span className="set-track-cue">{fmtCueTime(t.cueTime)}</span>
              )}
            </div>
          );
        }

        if (t.type === 'blend') {
          return (
            <div
              key={t.idx}
              className="set-track blend-track"
              style={{
                marginLeft: '28px',
                borderLeft: '2px solid var(--pink)',
                paddingLeft: '12px',
              }}
            >
              <div className="set-track-pos" style={{ color: 'var(--pink)', fontSize: '0.75rem' }}>
                w/
              </div>
              <div className="set-track-info">
                <Link href={`/track/${t.slug}`} className="track-link" style={{ fontSize: '0.8125rem' }}>
                  <span style={{ fontWeight: 500 }}>{t.artist}</span>
                  <span style={{ color: 'var(--muted-lt)' }}> &mdash; {t.title}</span>
                  {t.remix && (
                    <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}> ({t.remix})</span>
                  )}
                </Link>
                {t.label && (
                  <div style={{ fontSize: '0.6875rem', color: 'var(--muted)', marginTop: '1px' }}>
                    {t.label}
                  </div>
                )}
              </div>
            </div>
          );
        }

        // Normal track
        return (
          <div key={t.idx}>
            <div
              className={`set-track${isActive ? ' set-track-active' : ''}`}
              style={{ cursor: canSeek ? 'pointer' : undefined }}
              onClick={canSeek ? () => handleSeek(t.cueTime) : undefined}
            >
              <div className="set-track-pos">{t.pos || ''}</div>
              <div className="set-track-info">
                <Link href={`/track/${t.slug}`} className="track-link" onClick={(e) => e.stopPropagation()}>
                  <span style={{ fontWeight: 500 }}>{t.artist}</span>
                  <span style={{ color: 'var(--muted-lt)' }}> &mdash; {t.title}</span>
                  {t.remix && (
                    <span style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}> ({t.remix})</span>
                  )}
                </Link>
                {t.label && (
                  <div style={{ fontSize: '0.6875rem', color: 'var(--muted)', marginTop: '1px' }}>
                    {t.label}
                  </div>
                )}
              </div>
              <div className="set-track-badges">
                {t.anthemYears && (
                  <span
                    className="pill pill-purple"
                    title={`Also played by ${djName} in ${t.anthemYears.join(', ')}`}
                    style={{ fontSize: '0.625rem', cursor: 'help' }}
                  >
                    &#9733; {t.anthemYears.length}yr
                  </span>
                )}
                {t.otherDJCount ? (
                  <span
                    className="pill"
                    title={`${t.otherDJCount} other DJs played this`}
                    style={{ fontSize: '0.625rem', cursor: 'help' }}
                  >
                    {t.otherDJCount} DJs
                  </span>
                ) : null}
                {canSeek && t.cueTime != null && (
                  <span className="set-track-cue" title="Jump to this track">
                    {fmtCueTime(t.cueTime)}
                  </span>
                )}
                <a
                  href={`https://open.spotify.com/search/${t.spotifyQ}`}
                  target="_blank"
                  rel="noopener"
                  title="Search on Spotify"
                  className="spotify-btn"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                </a>
              </div>
            </div>
            {/* Blend sub-tracks */}
            {t.blendTracks.length > 0 && (
              <div
                className={`set-track blend-track${isActive ? ' set-track-active' : ''}`}
                style={{
                  marginLeft: '28px',
                  borderLeft: '2px solid var(--pink)',
                  paddingLeft: '12px',
                }}
              >
                <div className="set-track-pos" style={{ color: 'var(--pink)', fontSize: '0.75rem' }}>
                  w/
                </div>
                <div className="set-track-info">
                  {t.blendTracks.map((bg, bi) => (
                    <span key={bi}>
                      {bi > 0 && (
                        <span style={{ color: 'var(--muted)', fontSize: '0.6875rem' }}> + </span>
                      )}
                      <Link
                        href={`/track/${bg.slug}`}
                        className="track-link"
                        style={{ fontSize: '0.8125rem' }}
                        onClick={(e) => e.stopPropagation()}
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
  );
}
