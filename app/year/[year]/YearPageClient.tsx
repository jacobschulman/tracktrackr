'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { StageBadge } from '@/components/StageBadge';
import { FestivalBadge } from '@/components/FestivalBadge';
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
  festival: string;
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

export function FilterableSetGrid({ sets, festivalLabels }: { sets: SetCardData[]; festivalLabels: FestivalLabel[] }) {
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');
  const [festivalFilter, setFestivalFilter] = useState<string>('all');

  const filtered = sets.filter(s => {
    if (mediaFilter === 'youtube' && !s.hasYouTube) return false;
    if (mediaFilter === 'soundcloud' && !s.hasSoundCloud) return false;
    if (festivalFilter !== 'all' && s.festival !== festivalFilter) return false;
    return true;
  });

  const ytCount = sets.filter(s => s.hasYouTube).length;
  const scCount = sets.filter(s => s.hasSoundCloud).length;

  return (
    <>
      {/* Filters */}
      <div className="sets-filters" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        {/* Festival filters */}
        {festivalLabels.length > 1 && (
          <>
            <button
              className={`filter-chip${festivalFilter === 'all' ? ' active' : ''}`}
              onClick={() => setFestivalFilter('all')}
            >
              All Festivals
            </button>
            {festivalLabels.map(f => (
              <button
                key={f.slug}
                className={`filter-chip${festivalFilter === f.slug ? ' active' : ''}`}
                onClick={() => setFestivalFilter(f.slug)}
                style={festivalFilter === f.slug ? {
                  borderColor: f.accent,
                  color: f.accent,
                  background: `${f.accent}15`,
                  boxShadow: `0 0 0 1px ${f.accent}, 0 1px 4px ${f.accent}40`,
                } : undefined}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: f.accent, flexShrink: 0 }} />
                {f.shortName}
              </button>
            ))}
            <span style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
          </>
        )}

        {/* Media filters */}
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
            &#9654; YouTube ({ytCount})
          </button>
        )}
        {scCount > 0 && (
          <button
            className={`filter-chip filter-chip-sc${mediaFilter === 'soundcloud' ? ' active' : ''}`}
            onClick={() => setMediaFilter(mediaFilter === 'soundcloud' ? 'all' : 'soundcloud')}
          >
            &#9654; SoundCloud ({scCount})
          </button>
        )}
      </div>

      {/* Results count */}
      {(mediaFilter !== 'all' || festivalFilter !== 'all') && (
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
                <FestivalBadge festival={s.festival} size="sm" />
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
    </>
  );
}
