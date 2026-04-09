'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/', icon: '◆', label: 'Home', view: 'overview' },
  { href: '/djs', icon: '◎', label: 'DJs', view: 'djs' },
  { href: '/tracks', icon: '♫', label: 'Tracks', view: 'tracks' },
  { href: '/sets', icon: '◷', label: 'Sets', view: 'sets' },
  { href: '/festivals', icon: '⬡', label: 'Festivals', view: 'festivals' },
];

function getActiveView(pathname: string): string {
  if (pathname === '/') return 'overview';
  if (pathname.startsWith('/festivals')) return 'festivals';
  if (pathname.startsWith('/dj')) return 'djs';
  if (pathname.startsWith('/track')) return 'tracks';
  if (pathname.startsWith('/set') || pathname.startsWith('/year')) return 'sets';
  return '';
}

export function MobileTabs() {
  const pathname = usePathname();
  const activeView = getActiveView(pathname);

  return (
    <nav id="mobile-tabs">
      {tabs.map(tab => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`tab-link ${activeView === tab.view ? 'active' : ''}`}
          data-view={tab.view}
        >
          {tab.icon}<span>{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
