'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface DJResult {
  type: 'dj';
  slug: string;
  name: string;
}

interface TrackResult {
  type: 'track';
  artist: string;
  title: string;
  slug: string;
  playCount: number;
  years: number;
  djs: number;
}

type SearchResult = DJResult | TrackResult;

export function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const [djIndex, setDjIndex] = useState<any[] | null>(null);
  const [trackIndex, setTrackIndex] = useState<any[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchTimeoutRef = useRef<NodeJS.Timeout>(undefined);

  const loadData = useCallback(async () => {
    if (djIndex) return;
    try {
      const res = await fetch('/api/search');
      const data = await res.json();
      setDjIndex(data.djs);
      setTrackIndex(data.tracks);
    } catch (e) {
      console.error('Failed to load search data', e);
    }
  }, [djIndex]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const performSearch = useCallback((q: string) => {
    if (!djIndex || q.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const lower = q.toLowerCase();
    const allResults: SearchResult[] = [];

    // Search DJs
    const djMatches = djIndex
      .filter((d: any) => d.name.toLowerCase().includes(lower))
      .slice(0, 8);
    for (const d of djMatches) {
      allResults.push({ type: 'dj', slug: d.slug, name: d.name });
    }

    // Search tracks
    if (trackIndex) {
      const trackMatches = trackIndex
        .filter((t: any) => `${t.a} ${t.t}`.toLowerCase().includes(lower))
        .slice(0, 8);
      for (const t of trackMatches) {
        allResults.push({ type: 'track', artist: t.a, title: t.t, slug: t.s, playCount: t.p, years: t.y, djs: t.d });
      }
    }

    setResults(allResults);
    setIsOpen(allResults.length > 0);
    setFocusedIdx(-1);
  }, [djIndex, trackIndex]);

  const handleInput = (value: string) => {
    setQuery(value);
    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => performSearch(value.trim()), 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && focusedIdx >= 0 && results[focusedIdx]) {
      e.preventDefault();
      const r = results[focusedIdx];
      router.push(r.type === 'dj' ? `/dj/${r.slug}` : `/track/${r.slug}`);
      setIsOpen(false);
      setQuery('');
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleSelect = (r: SearchResult) => {
    router.push(r.type === 'dj' ? `/dj/${r.slug}` : `/track/${r.slug}`);
    setIsOpen(false);
    setQuery('');
  };

  function titleCase(str: string) {
    return str.replace(/\b\w/g, c => c.toUpperCase());
  }

  const djResults = results.filter(r => r.type === 'dj') as DJResult[];
  const trackResults = results.filter(r => r.type === 'track') as TrackResult[];

  const closeMobileSearch = () => {
    containerRef.current?.classList.remove('search-open');
    setIsOpen(false);
    setQuery('');
  };

  const toggleMobileSearch = () => {
    const el = containerRef.current;
    if (!el) return;
    if (el.classList.contains('search-open')) {
      closeMobileSearch();
    } else {
      el.classList.add('search-open');
      loadData();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  return (
    <div id="search-container" ref={containerRef}>
      <button className="search-toggle" onClick={toggleMobileSearch} aria-label="Search">
        &#128269;
      </button>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          id="global-search"
          placeholder="Search DJs & tracks..."
          autoComplete="off"
          value={query}
          onFocus={loadData}
          onChange={e => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); setIsOpen(false); inputRef.current?.focus(); }}
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              fontSize: '1.125rem',
              cursor: 'pointer',
              padding: '0 4px',
              lineHeight: 1,
            }}
            aria-label="Clear search"
          >
            &times;
          </button>
        )}
      </div>
      {isOpen && results.length > 0 && (
        <div className="search-dropdown">
          {djResults.length > 0 && (
            <>
              <div className="search-group-title">DJs ({djResults.length})</div>
              {djResults.map((dj, i) => (
                <div
                  key={dj.slug}
                  className={`search-item ${results.indexOf(dj) === focusedIdx ? 'focused' : ''}`}
                  onClick={() => handleSelect(dj)}
                >
                  <div>
                    <div className="search-item-name">{dj.name}</div>
                  </div>
                </div>
              ))}
            </>
          )}
          {trackResults.length > 0 && (
            <>
              <div className="search-group-title">Tracks ({trackResults.length})</div>
              {trackResults.map((t) => (
                <div
                  key={t.slug}
                  className={`search-item ${results.indexOf(t) === focusedIdx ? 'focused' : ''}`}
                  onClick={() => handleSelect(t)}
                >
                  <div>
                    <div className="search-item-name">{titleCase(t.artist)} &mdash; {titleCase(t.title)}</div>
                    <div className="search-item-sub">{t.playCount} plays &middot; {t.years} years</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
