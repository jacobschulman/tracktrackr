'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function HashRedirect() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#/')) {
      const path = hash.replace(/^#\/?/, '/');
      // Convert old track URLs: #/track/artist%7C%7C%7Ctitle -> just redirect to /tracks for now
      router.replace(path);
    }
  }, [router]);

  return null;
}
