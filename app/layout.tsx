import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { MobileTabs } from '@/components/MobileTabs';
import { Search } from '@/components/Search';
import { HashRedirect } from '@/components/HashRedirect';
import { PlayerBar } from '@/components/PlayerBar';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TrackTrackr',
  description: 'Listen to festival sets. Dive deep into tracklists. Discover your next favorite track.',
  openGraph: {
    title: 'TrackTrackr',
    description: 'Listen to festival sets. Dive deep into tracklists. Discover your next favorite track.',
    siteName: 'TrackTrackr',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TrackTrackr',
    description: 'Listen to festival sets. Dive deep into tracklists. Discover your next favorite track.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <HashRedirect />
        <Sidebar />
        <MobileTabs />
        <main id="content">
          <header id="header">
            <a href="/" className="header-brand">
              <span className="header-brand-icon">🔊</span>
              <span className="header-brand-text">TrackTrackr</span>
            </a>
            <Search />
          </header>
          <div id="view-container">
            {children}
            <footer className="site-footer">
              <div>
                <a href="/disclaimer">Disclaimer</a>
                <span className="footer-sep">&middot;</span>
                <span>Data last updated April 2026</span>
              </div>
              <div className="footer-watermark">
                <span>Powered by</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/hedgebreeze.png" alt="Hedgebreeze" className="footer-hb-logo" />
              </div>
            </footer>
          </div>
        </main>
        <PlayerBar />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
