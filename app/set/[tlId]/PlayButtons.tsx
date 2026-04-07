'use client';

import { playInBar } from '@/components/PlayerBar';

interface PlayButtonsProps {
  ytUrl?: string;
  scUrl?: string;
  title: string;
  tlId: string;
}

export function PlayButtons({ ytUrl, scUrl, title, tlId }: PlayButtonsProps) {
  if (!ytUrl && !scUrl) return null;

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
      {ytUrl && (
        <button
          className="rec-btn rec-btn-yt"
          onClick={() => playInBar('youtube', ytUrl, title, tlId)}
        >
          &#9654; Play on YouTube
        </button>
      )}
      {scUrl && (
        <button
          className="rec-btn rec-btn-sc"
          onClick={() => playInBar('soundcloud', scUrl, title, tlId)}
        >
          &#9654; Play on SoundCloud
        </button>
      )}
    </div>
  );
}
