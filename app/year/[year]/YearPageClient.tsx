'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { StageBadge } from '@/components/StageBadge';
import { playInBar } from '@/components/PlayerBar';

// ── Year selector as pill buttons ──────────────────────────────────

export function YearSelect({ years, current }: { years: number[]; current: number }) {
  const router = useRouter();
  return (
    <div className="sets-filter-row">
      {years.map(y => (
        <button
          key={y}
          className={`filter-chip${y === current ? ' active' : ''}`}
          onClick={() => router.push(`/year/${y}`)}
        >
          {y}
        </button>
      ))}
    </div>
  );
}

// ── Filterable set grid ────────────────────────────────────────────

interface SetCardData {
  tlId: string;
  djName: string;
  stage: string;
  stageColor: string;
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

type MediaFilter = 'all' | 'youtube' | 'soundcloud';

export function FilterableSetGrid({ sets, stages }: { sets: SetCardData[]; stages: string[] }) {
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');

  const filtered = sets.filter(s => {
    if (mediaFilter === 'youtube' && !s.hasYouTube) return false;
    if (mediaFilter === 'soundcloud' && !s.hasSoundCloud) return false;
    if (stageFilter !== 'all' && s.stage !== stageFilter) return false;
    return true;
  });

  const ytCount = sets.filter(s => s.hasYouTube).length;
  const scCount = sets.filter(s => s.hasSoundCloud).length;

  return (
    <>
      {/* Filters */}
      <div className="sets-filters">
        {/* Media filters */}
        <div className="sets-filter-row">
          <span className="filter-label">Listen</span>
          <button
            className={`filter-chip${mediaFilter === 'all' ? ' active' : ''}`}
            onClick={() => setMediaFilter('all')}
          >
            All sets
          </button>
          {ytCount > 0 && (
            <button
              className={`filter-chip filter-chip-yt${mediaFilter === 'youtube' ? ' active' : ''}`}
              onClick={() => setMediaFilter(mediaFilter === 'youtube' ? 'all' : 'youtube')}
            >
              ▶ YouTube ({ytCount})
            </button>
          )}
          {scCount > 0 && (
            <button
              className={`filter-chip filter-chip-sc${mediaFilter === 'soundcloud' ? ' active' : ''}`}
              onClick={() => setMediaFilter(mediaFilter === 'soundcloud' ? 'all' : 'soundcloud')}
            >
              ▶ SoundCloud ({scCount})
            </button>
          )}
        </div>

        {/* Stage filters */}
        {stages.length > 1 && (
          <div className="sets-filter-row">
            <span className="filter-label">Stage</span>
            <button
              className={`filter-chip${stageFilter === 'all' ? ' active' : ''}`}
              onClick={() => setStageFilter('all')}
            >
              All
            </button>
            {stages.map(stage => (
              <button
                key={stage}
                className={`filter-chip${stageFilter === stage ? ' active' : ''}`}
                onClick={() => setStageFilter(stageFilter === stage ? 'all' : stage)}
              >
                {stage}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results count */}
      {(mediaFilter !== 'all' || stageFilter !== 'all') && (
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 12 }}>
          Showing {filtered.length} of {sets.length} sets
        </div>
      )}

      {/* Set grid */}
      <div className="set-grid">
        {filtered.map((s) => (
          <div key={s.tlId} className="set-card" style={{ borderLeft: `3px solid ${s.stageColor}` }}>
            <Link
              href={`/set/${s.tlId}`}
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              <div className="set-card-dj">{s.djName}</div>
              <div className="set-card-meta" style={{ marginBottom: 8 }}>
                <StageBadge stage={s.stage} />
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
            {/* Inline play buttons */}
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
                    ▶ YouTube
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
                    ▶ SoundCloud
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
