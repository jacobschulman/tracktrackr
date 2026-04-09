import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'TrackTrackr';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1028 50%, #0f0f1a 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ fontSize: 80, marginBottom: 16 }}>🔊</div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '-0.03em',
            marginBottom: 20,
          }}
        >
          TrackTrackr
        </div>
        <div
          style={{
            fontSize: 28,
            color: '#94a3b8',
            maxWidth: 800,
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          Listen to festival sets. Dive deep into tracklists. Discover your next favorite track.
        </div>
      </div>
    ),
    { ...size }
  );
}
