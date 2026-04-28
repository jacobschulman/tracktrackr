'use client';

import { useState, useEffect } from 'react';

export function RenameBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('rename-banner-dismissed')) setVisible(true);
  }, []);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem('rename-banner-dismissed', '1');
    setVisible(false);
  }

  return (
    <div className="rename-banner">
      <span>New name, who dis? TrackTrackr is now <strong>FestivalSets.info</strong></span>
      <button onClick={dismiss} aria-label="Dismiss">×</button>
    </div>
  );
}
