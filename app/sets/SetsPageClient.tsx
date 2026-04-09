'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { StageBadge } from '@/components/StageBadge';
import { FestivalBadge } from '@/components/FestivalBadge';
import { FestivalSelect } from '@/components/FestivalSelect';
import { playInBar } from '@/components/PlayerBar';

interface SetCardData {
  tlId: string;
  djName: string;
  stage: string;
  stageColor: string;
  festival: string;
  year: number;
  date: string;
  dateFormatted: string;
  duration: string;
  tracksIdentified: number;
  hasYouTube: boolean;
  hasSoundCloud: boolean;
  ytUrl?: string;
  scUrl?: string;
  tracks: { artist: string; title: string; remix: string }[];
  totalTracks: number;
}

interface FestivalLabel {
  slug: string;
  shortName: string;
  accent: string;
}

type MediaFilter = 'all' | 'youtube' | 'soundcloud';

const PAGE_SIZE = 50;

export function SetsPageClient({ sets, festivalLabels, years, totalSets }: {
  sets: SetCardData[];
  festivalLabels: FestivalLabel[];
  years: number[];
  totalSets: number;
}) {
  const [festivalFilter, setFestivalFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('');
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    return sets.filter(s => {
      if (festivalFilter !== 'all' && s.festival !== festivalFilter) return false;
      if (yearFilter && s.year !== parseInt(yearFilter)) return false;
      if (mediaFilter === 'youtube' && !s.hasYouTube) return false;
      if (mediaFilter === 'soundcloud' && !s.hasSoundCloud) return false;
      return true;
    });
  }, [sets, festivalFilter, yearFilter, mediaFilter]);

  // Reset visible count when filters change
  const displayed = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const ytCount = filtered.filter(s => s.hasYouTube).length;
  const scCount = filtered.filter(s => s.hasSoundCloud).length;

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>
          Sets
        </h1>
        <p className="hero-subtitle">{totalSets.toLocaleString()} sets across {festivalLabels.length} festivals</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <FestivalSelect
          festivalLabels={festivalLabels}
          value={festivalFilter === 'all' ? '' : festivalFilter}
          onChange={(v) => { setFestivalFilter(v || 'all'); setVisibleCount(PAGE_SIZE); }}
        />
        <select
          className="filter-select"
          value={yearFilter}
          onChange={(e) => { setYearFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}
        >
          <option value="">All Years</option>
          {years.map(y => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>

        {/* Media filters */}
        <button
          className={`filter-chip${mediaFilter === 'all' ? ' active' : ''}`}
          onClick={() => { setMediaFilter('all'); setVisibleCount(PAGE_SIZE); }}
        >
          All
        </button>
        {ytCount > 0 && (
          <button
            className={`filter-chip filter-chip-yt${mediaFilter === 'youtube' ? ' active' : ''}`}
            onClick={() => { setMediaFilter(mediaFilter === 'youtube' ? 'all' : 'youtube'); setVisibleCount(PAGE_SIZE); }}
          >
            &#9654; YouTube ({ytCount})
          </button>
        )}
        {scCount > 0 && (
          <button
            className={`filter-chip filter-chip-sc${mediaFilter === 'soundcloud' ? ' active' : ''}`}
            onClick={() => { setMediaFilter(mediaFilter === 'soundcloud' ? 'all' : 'soundcloud'); setVisibleCount(PAGE_SIZE); }}
          >
            &#9654; SoundCloud ({scCount})
          </button>
        )}
      </div>

      {/* Results count */}
      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 12 }}>
        {filtered.length === totalSets
          ? `${totalSets.toLocaleString()} sets`
          : `Showing ${filtered.length.toLocaleString()} of ${totalSets.toLocaleString()} sets`}
      </div>

      {/* Set grid */}
      <div className="set-grid">
        {displayed.map((s) => (
          <div key={s.tlId} className="set-card" style={{ borderLeft: `3px solid ${s.stageColor}` }}>
            <Link
              href={`/set/${s.tlId}`}
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              <div className="set-card-dj">{s.djName}</div>
              <div className="set-card-meta" style={{ marginBottom: 8 }}>
                <FestivalBadge festival={s.festival} size="sm" />
                <StageBadge stage={s.stage} />
                <span className="separator">&middot;</span>
                <span>{s.year}</span>
                <span className="separator">&middot;</span>
                <span>{s.dateFormatted}</span>
                {s.duration && (
                  <>
                    <span className="separator">&middot;</span>
                    <span>{s.duration}</span>
                  </>
                )}
              </div>
              {s.tracks.length > 0 && (
                <div className="set-card-track-preview">
                  {s.tracks.map((t, i) => (
                    <div key={i} className="set-card-track-line">
                      {t.artist} &mdash; {t.title}{t.remix ? ` (${t.remix})` : ''}
                    </div>
                  ))}
                  {s.totalTracks > 2 && (
                    <div className="set-card-track-more">+ {s.totalTracks - 2} more tracks</div>
                  )}
                </div>
              )}
              {s.tracks.length === 0 && (
                <div className="set-card-meta">
                  <span>{s.tracksIdentified || 0} tracks ID&apos;d</span>
                </div>
              )}
            </Link>
            {(s.hasYouTube || s.hasSoundCloud) && (
              <div className="set-card-play" style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {s.hasYouTube && (
                  <button
                    className="rec-btn rec-btn-yt"
                    onClick={(e) => {
                      e.stopPropagation();
                      playInBar('youtube', s.ytUrl!, `${s.djName} @ ${s.stage}`, s.tlId);
                    }}
                  >
                    &#9654; YouTube
                  </button>
                )}
                {s.hasSoundCloud && (
                  <button
                    className="rec-btn rec-btn-sc"
                    onClick={(e) => {
                      e.stopPropagation();
                      playInBar('soundcloud', s.scUrl!, `${s.djName} @ ${s.stage}`, s.tlId);
                    }}
                  >
                    &#9654; SoundCloud
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Load more */}
      {hasMore && (
        <button
          className="expand-btn"
          onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
          style={{ width: '100%', marginTop: 16 }}
        >
          Show more ({filtered.length - visibleCount} remaining)
        </button>
      )}
    </>
  );
}
