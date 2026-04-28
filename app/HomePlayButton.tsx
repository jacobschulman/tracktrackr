'use client';

import { playInBar } from '@/components/PlayerBar';

export function HomePlayButton({
  platform,
  url,
  title,
  tlId,
}: {
  platform: 'youtube' | 'soundcloud';
  url: string;
  title: string;
  tlId: string;
}) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        playInBar(platform, url, title, tlId);
      }}
      aria-label={`Play ${title}`}
      style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: platform === 'youtube' ? 'rgba(255,0,0,0.15)' : 'rgba(255,85,0,0.15)',
        color: platform === 'youtube' ? '#f87171' : '#fb923c',
        border: 'none', cursor: 'pointer', padding: 0,
        transition: 'transform 150ms ease, background 150ms ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
    </button>
  );
}
