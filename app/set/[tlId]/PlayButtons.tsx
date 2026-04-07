'use client';

interface PlayButtonsProps {
  ytUrl?: string;
  scUrl?: string;
  title: string;
  tlId: string;
}

export function PlayButtons({ ytUrl, scUrl, title, tlId }: PlayButtonsProps) {
  const handlePlay = (platform: string, url: string) => {
    // Trigger the PlayerBar via the global event bus
    if (typeof window !== 'undefined' && (window as any).__playerBus) {
      (window as any).__playerBus({ platform, url, title, tlId });
    }
  };

  if (!ytUrl && !scUrl) return null;

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
      {ytUrl && (
        <button
          className="rec-btn rec-btn-yt"
          onClick={() => handlePlay('youtube', ytUrl)}
        >
          &#9654; Play on YouTube
        </button>
      )}
      {scUrl && (
        <button
          className="rec-btn rec-btn-sc"
          onClick={() => handlePlay('soundcloud', scUrl)}
        >
          &#9654; Play on SoundCloud
        </button>
      )}
    </div>
  );
}
