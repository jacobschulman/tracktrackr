'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const viewLabels: Record<string, string> = {
  djs: 'DJs',
  dj: 'DJs',
  tracks: 'Tracks',
  track: 'Tracks',
  set: 'Sets',
  year: 'Years',
  stages: 'Stages',
  labels: 'Labels',
  versus: 'Versus',
  journeys: 'Journeys',
  dna: 'DNA',
  b2b: 'B2B',
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) return <div id="breadcrumbs" />;

  const crumbs: { label: string; href?: string }[] = [{ label: 'Home', href: '/' }];

  if (segments[0]) {
    const label = viewLabels[segments[0]] || segments[0];
    if (segments.length > 1) {
      crumbs.push({ label, href: `/${segments[0] === 'dj' ? 'djs' : segments[0] === 'track' ? 'tracks' : segments[0]}` });
    } else {
      crumbs.push({ label });
    }
  }

  return (
    <div id="breadcrumbs">
      {crumbs.map((c, i) => (
        <span key={i}>
          {i === crumbs.length - 1 ? (
            <span className="text-muted-lt">{c.label}</span>
          ) : (
            <>
              <Link href={c.href!}>{c.label}</Link>
              <span className="separator">&rsaquo;</span>
            </>
          )}
        </span>
      ))}
    </div>
  );
}
