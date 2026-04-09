export default function DisclaimerPage() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 0' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 32 }}>
        Disclaimer
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: '0.875rem', lineHeight: 1.7, color: 'var(--muted-lt)' }}>
            TrackTrackr is an independent fan project and is not affiliated with, endorsed by, or connected to any of the festivals, artists, or properties referenced within the experience.
          </div>
        </div>

        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--text-bright)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Data Accuracy
          </div>
          <div style={{ fontSize: '0.875rem', lineHeight: 1.7, color: 'var(--muted-lt)' }}>
            All data is sourced from publicly available sources and may not be 100% accurate.
          </div>
        </div>

        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--text-bright)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Content & Copyright
          </div>
          <div style={{ fontSize: '0.875rem', lineHeight: 1.7, color: 'var(--muted-lt)' }}>
            TrackTrackr does not host, stream, or distribute any copyrighted audio or video content. All recording links point directly to third-party platforms (YouTube, SoundCloud, Hearthis.at) where content is hosted by its respective owners.
          </div>
          <div style={{ fontSize: '0.875rem', lineHeight: 1.7, color: 'var(--muted-lt)', marginTop: 12 }}>
            If you are a rights holder and have concerns about content referenced here, please contact the platform where it was originally hosted — YouTube, SoundCloud, or Hearthis.at — as TrackTrackr does not host any audio or video content directly.
          </div>
        </div>

        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--text-bright)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Contact
          </div>
          <div style={{ fontSize: '0.875rem', lineHeight: 1.7, color: 'var(--muted-lt)' }}>
            Interested in how this was built?{' '}
            <a href="mailto:jacob@hedgebreeze.com" style={{ color: 'var(--purple-lt)', textDecoration: 'none' }}>
              jacob@hedgebreeze.com
            </a>
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--muted)', marginTop: 8 }}>
          Data last updated: April 2026
        </div>
      </div>
    </div>
  );
}
