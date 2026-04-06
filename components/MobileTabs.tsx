'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/', icon: '◆', label: 'Home', view: 'overview' },
  { href: '/djs', icon: '◎', label: 'DJs', view: 'djs' },
  { href: '/tracks', icon: '♫', label: 'Tracks', view: 'tracks' },
  { href: '/year', icon: '◷', label: 'Sets', view: 'year' },
  { href: '/stages', icon: '⬡', label: 'Stages', view: 'stages' },
];

function getActiveView(pathname: string): string {
  if (pathname === '/') return 'overview';
  if (pathname.startsWith('/dj')) return 'djs';
  if (pathname.startsWith('/track') || pathname.startsWith('/set')) return 'tracks';
  if (pathname.startsWith('/year')) return 'year';
  if (pathname.startsWith('/stages')) return 'stages';
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
