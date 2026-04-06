'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', icon: '◆', label: 'Home', view: 'overview' },
  { href: '/djs', icon: '◎', label: 'DJs', view: 'djs' },
  { href: '/tracks', icon: '♫', label: 'Tracks', view: 'tracks' },
  { href: '/year', icon: '◷', label: 'Sets', view: 'year' },
  { href: '/stages', icon: '⬡', label: 'Stages', view: 'stages' },
];

const secondaryItems = [
  { href: '/versus', icon: '⚔', label: 'Versus', view: 'versus' },
  { href: '/journeys', icon: '↝', label: 'Journeys', view: 'journeys' },
  { href: '/dna', icon: '◉', label: 'DNA', view: 'dna' },
];

function getActiveView(pathname: string): string {
  if (pathname === '/') return 'overview';
  if (pathname.startsWith('/dj/') || pathname === '/djs') return 'djs';
  if (pathname.startsWith('/track/') || pathname === '/tracks') return 'tracks';
  if (pathname.startsWith('/set/')) return 'tracks';
  if (pathname.startsWith('/year')) return 'year';
  if (pathname.startsWith('/stages')) return 'stages';
  if (pathname.startsWith('/versus')) return 'versus';
  if (pathname.startsWith('/journeys')) return 'journeys';
  if (pathname.startsWith('/dna')) return 'dna';
  if (pathname.startsWith('/b2b')) return 'djs';
  if (pathname.startsWith('/labels')) return 'tracks';
  return '';
}

export function Sidebar() {
  const pathname = usePathname();
  const activeView = getActiveView(pathname);

  return (
    <nav id="sidebar">
      <Link href="/" className="logo">
        <span className="logo-icon">▦</span>
        <span className="logo-text">TrackTrackr</span>
      </Link>

      <div className="nav-links">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link ${activeView === item.view ? 'active' : ''}`}
            data-view={item.view}
          >
            <span className="nav-icon">{item.icon}</span> {item.label}
          </Link>
        ))}

        <div className="nav-divider" />

        {secondaryItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link ${activeView === item.view ? 'active' : ''}`}
            data-view={item.view}
          >
            <span className="nav-icon">{item.icon}</span> {item.label}
          </Link>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="data-credit">
          Data from <a href="https://www.1001tracklists.com" target="_blank" rel="noopener">1001Tracklists</a>
        </div>
      </div>
    </nav>
  );
}
