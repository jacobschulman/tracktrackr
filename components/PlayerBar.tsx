'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// ── Types ─────────────────────────────────────────
type Platform = 'youtube' | 'soundcloud' | 'spotify' | null;

interface PlayerState {
  platform: Platform;
  playing: boolean;
  duration: number;
  currentTime: number;
  title: string;
  tlId: string;
  externalUrl: string;
  visible: boolean;
}

// ── API script loaders (load once) ────────────────
let _scApiPromise: Promise<void> | null = null;
function loadSCApi(): Promise<void> {
  if (_scApiPromise) return _scApiPromise;
  _scApiPromise = new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://w.soundcloud.com/player/api.js';
    s.onload = () => resolve();
    s.onerror = () => resolve(); // degrade gracefully
    document.head.appendChild(s);
  });
  return _scApiPromise;
}

let _ytApiPromise: Promise<void> | null = null;
function loadYTApi(): Promise<void> {
  if (_ytApiPromise) return _ytApiPromise;
  _ytApiPromise = new Promise((resolve) => {
    (window as any).onYouTubeIframeAPIReady = resolve;
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });
  return _ytApiPromise;
}

// ── Helpers ───────────────────────────────────────
function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Singleton event target so other components can trigger playback ──
const playerBus = typeof window !== 'undefined'
  ? (window as any).__playerBus ||= new EventTarget()
  : null;

/**
 * Call this from anywhere to start playback in the persistent player bar.
 */
export function playInBar(platform: string, url: string, title: string, tlId?: string) {
  playerBus?.dispatchEvent(
    new CustomEvent('play', { detail: { platform, url, title, tlId: tlId || '' } })
  );
}

// ── Component ─────────────────────────────────────
export function PlayerBar() {
  const [state, setState] = useState<PlayerState>({
    platform: null,
    playing: false,
    duration: 0,
    currentTime: 0,
    title: '',
    tlId: '',
    externalUrl: '',
    visible: false,
  });

  const widgetRef = useRef<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iframeWrapRef = useRef<HTMLDivElement>(null);
  const embedRef = useRef<HTMLDivElement>(null);

  // ── Cleanup ──────────────────────────────────────
  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (widgetRef.current) {
      try {
        if (state.platform === 'youtube' && widgetRef.current.destroy) {
          widgetRef.current.destroy();
        }
      } catch (_) { /* ignore */ }
    }
    widgetRef.current = null;
    if (iframeWrapRef.current) iframeWrapRef.current.innerHTML = '';
    if (embedRef.current) embedRef.current.innerHTML = '';
  }, [state.platform]);

  // ── Close the player bar ────────────────────────
  const handleClose = useCallback(() => {
    cleanup();
    document.body.classList.remove('player-open');
    setState((prev) => ({
      ...prev,
      visible: false,
      playing: false,
      platform: null,
      duration: 0,
      currentTime: 0,
    }));
  }, [cleanup]);

  // ── Play / Pause toggle ─────────────────────────
  const handlePlayPause = useCallback(() => {
    if (!widgetRef.current) return;
    setState((prev) => {
      const next = !prev.playing;
      if (prev.platform === 'youtube') {
        if (next) widgetRef.current.playVideo();
        else widgetRef.current.pauseVideo();
      } else if (prev.platform === 'soundcloud') {
        if (next) widgetRef.current.play();
        else widgetRef.current.pause();
      }
      return { ...prev, playing: next };
    });
  }, []);

  // ── Progress bar click (seek) ───────────────────
  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!widgetRef.current || !state.duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      if (state.platform === 'youtube') {
        widgetRef.current.seekTo(pct * state.duration, true);
      } else if (state.platform === 'soundcloud') {
        widgetRef.current.seekTo(pct * state.duration);
      }
    },
    [state.duration, state.platform]
  );

  // ── Start playback (called via bus event) ───────
  const startPlayback = useCallback(
    async (platform: Platform, url: string, title: string, tlId: string) => {
      cleanup();

      let externalUrl = '';
      if (platform === 'youtube') {
        const ytId = url.includes('youtube.com/watch')
          ? new URL(url).searchParams.get('v') || ''
          : url.split('/').pop() || '';
        externalUrl = `https://www.youtube.com/watch?v=${ytId}`;
      } else if (platform === 'soundcloud') {
        externalUrl = url;
      }

      setState({
        platform,
        playing: false,
        duration: 0,
        currentTime: 0,
        title,
        tlId,
        externalUrl,
        visible: true,
      });
      document.body.classList.add('player-open');

      if (platform === 'youtube') {
        await loadYTApi();
        const YT = (window as any).YT;
        if (!YT?.Player) return;
        const ytId = url.includes('youtube.com/watch')
          ? new URL(url).searchParams.get('v') || ''
          : url.split('/').pop() || '';

        if (!iframeWrapRef.current) return;
        iframeWrapRef.current.innerHTML = '<div id="player-yt"></div>';

        widgetRef.current = new YT.Player('player-yt', {
          height: '1',
          width: '1',
          videoId: ytId,
          playerVars: { autoplay: 1, controls: 0 },
          events: {
            onReady: (e: any) => {
              e.target.playVideo();
              const dur = e.target.getDuration();
              setState((prev) => ({ ...prev, playing: true, duration: dur }));
              // Start polling for progress
              pollRef.current = setInterval(() => {
                try {
                  const cur = e.target.getCurrentTime();
                  const d = e.target.getDuration() || dur;
                  setState((prev) => ({ ...prev, currentTime: cur, duration: d }));
                } catch (_) { /* ignore */ }
              }, 500);
            },
            onStateChange: (e: any) => {
              if (e.data === YT.PlayerState.ENDED) {
                setState((prev) => ({ ...prev, playing: false }));
              }
            },
          },
        });
      } else if (platform === 'soundcloud') {
        await loadSCApi();
        const SC = (window as any).SC;
        if (!SC?.Widget) return;

        const scUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23f97316&auto_play=true&buying=false&sharing=false&download=false&show_artwork=false&show_playcount=false&show_user=false&hide_related=true&show_comments=false&show_reposts=false&show_teaser=false&visual=false`;

        if (!iframeWrapRef.current) return;
        iframeWrapRef.current.innerHTML = `<iframe id="player-sc" width="1" height="1" scrolling="no" frameborder="no" allow="autoplay" src="${scUrl}"></iframe>`;

        const widget = SC.Widget(document.getElementById('player-sc'));
        widgetRef.current = widget;

        widget.bind(SC.Widget.Events.READY, () => {
          widget.getDuration((d: number) => {
            setState((prev) => ({ ...prev, duration: d }));
          });
          widget.play();
          setState((prev) => ({ ...prev, playing: true }));
        });
        widget.bind(SC.Widget.Events.PLAY_PROGRESS, (e: any) => {
          setState((prev) => ({
            ...prev,
            currentTime: e.currentPosition / 1000,
            duration: prev.duration > 0 ? prev.duration : 1,
          }));
        });
        widget.bind(SC.Widget.Events.FINISH, () => {
          setState((prev) => ({ ...prev, playing: false }));
        });
      } else if (platform === 'spotify') {
        // Spotify: show embed, no custom controls
        let embedUrl = url;
        if (!embedUrl.includes('embed')) {
          embedUrl = embedUrl.replace('open.spotify.com/', 'open.spotify.com/embed/');
        }
        if (embedRef.current) {
          embedRef.current.innerHTML = `<iframe src="${embedUrl}" width="100%" height="80" frameborder="0" allow="encrypted-media" loading="lazy" style="display:block;"></iframe>`;
        }
      }
    },
    [cleanup]
  );

  // ── Listen for play events from other components ──
  useEffect(() => {
    if (!playerBus) return;
    const handler = (e: Event) => {
      const { platform, url, title, tlId } = (e as CustomEvent).detail;
      startPlayback(platform, url, title, tlId);
    };
    playerBus.addEventListener('play', handler);
    return () => playerBus.removeEventListener('play', handler);
  }, [startPlayback]);

  // ── Derived values ──────────────────────────────
  const progressPct =
    state.duration > 0 ? (state.currentTime / (state.platform === 'soundcloud' ? state.duration / 1000 : state.duration)) * 100 : 0;
  const isSpotify = state.platform === 'spotify';
  const setHref = state.tlId ? `/set/${state.tlId}` : '/';

  return (
    <div
      id="player-bar"
      className={`player-bar${state.visible ? '' : ' hidden'}`}
    >
      {/* Header row */}
      <div className="player-bar-header">
        <span className="player-bar-label">NOW PLAYING</span>
        <a id="player-bar-title" className="player-bar-title" href={setHref}>
          {state.title}
        </a>
        {state.externalUrl ? (
          <a
            id="player-bar-ext"
            className="player-bar-ext"
            href={state.externalUrl}
            target="_blank"
            rel="noopener"
            aria-label="Open in app"
            title="Open in app"
          >
            &#8599;
          </a>
        ) : null}
        <button
          id="player-bar-close"
          className="player-bar-close"
          aria-label="Close player"
          onClick={handleClose}
        >
          &times;
        </button>
      </div>

      {/* Controls (hidden for Spotify which uses its own embed) */}
      {!isSpotify && (
        <div className="player-bar-controls" id="player-bar-controls">
          <button
            id="player-bar-play"
            className="player-bar-play"
            aria-label="Play/Pause"
            onClick={handlePlayPause}
            dangerouslySetInnerHTML={{
              __html: state.playing ? '&#9646;&#9646;' : '&#9654;',
            }}
          />
          <div
            className="player-bar-progress"
            id="player-bar-progress"
            onClick={handleProgressClick}
          >
            <div
              className="player-bar-progress-fill"
              id="player-bar-progress-fill"
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          </div>
          <span id="player-bar-time" className="player-bar-time">
            {fmtTime(state.currentTime)}
          </span>
        </div>
      )}

      {/* Spotify embed area */}
      <div id="player-bar-embed" className="player-bar-embed" ref={embedRef} />

      {/* Hidden iframe container for YT/SC players */}
      <div
        id="player-bar-iframe-wrap"
        ref={iframeWrapRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          opacity: 0,
          pointerEvents: 'none',
          left: '-9999px',
        }}
      />
    </div>
  );
}
