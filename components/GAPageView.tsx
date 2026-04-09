'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export function GAPageView() {
  const pathname = usePathname();

  useEffect(() => {
    if (!window.gtag) return;

    // Parse structured data from the URL path
    const segments = pathname.split('/').filter(Boolean);
    const params: Record<string, string> = {};

    if (segments[0] === 'dj' && segments[1]) {
      params.page_type = 'dj';
      params.dj_slug = segments[1];
    } else if (segments[0] === 'set' && segments[1]) {
      params.page_type = 'set';
      params.set_id = segments[1];
    } else if (segments[0] === 'track' && segments[1]) {
      params.page_type = 'track';
      params.track_slug = segments[1];
    } else if (segments[0] === 'festivals' && segments[1]) {
      params.page_type = 'festival';
      params.festival_slug = segments[1];
    } else if (segments[0] === 'year' && segments[1]) {
      params.page_type = 'year';
      params.year = segments[1];
    } else if (segments[0] === 'sets') {
      params.page_type = 'sets';
    } else if (segments[0] === 'tracks') {
      params.page_type = 'tracks';
    } else if (segments[0] === 'djs') {
      params.page_type = 'djs';
    } else if (segments.length === 0) {
      params.page_type = 'home';
    } else {
      params.page_type = segments[0];
    }

    window.gtag('event', 'page_view', {
      page_path: pathname,
      ...params,
    });
  }, [pathname]);

  return null;
}
