import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { MobileTabs } from '@/components/MobileTabs';
import { Search } from '@/components/Search';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { HashRedirect } from '@/components/HashRedirect';
import { PlayerBar } from '@/components/PlayerBar';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TrackTrackr',
  description: '25+ years of Ultra Music Festival DJ sets, tracklists, and hidden patterns — visualized.',
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
              <span className="header-brand-icon">&#9638;</span>
              <span className="header-brand-text">TrackTrackr</span>
            </a>
            <Breadcrumbs />
            <Search />
          </header>
          <div id="view-container">
            {children}
          </div>
        </main>
        <PlayerBar />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
