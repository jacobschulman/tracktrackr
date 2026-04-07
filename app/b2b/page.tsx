import Link from 'next/link';
import { loadIndex, getB2BSets } from '@/lib/data';
import { fmt } from '@/lib/data';
import { StageBadge } from '@/components/StageBadge';
import { B2BClient } from './B2BClient';

export default function B2BPage() {
  const index = loadIndex();
  const pairs = getB2BSets();

  if (!pairs || pairs.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">&harr;</div>
        <div className="empty-state-text">No B2B sets found.</div>
      </div>
    );
  }

  const totalB2BSets = pairs.reduce((s, p) => s + p.count, 0);
  const mostSets = pairs[0]?.count || 0;

  // Serialize pairs for client component
  const serializedPairs = pairs.map(p => ({
    djs: p.djs,
    count: p.count,
    years: p.years,
    sets: p.sets.map(s => ({
      tlId: s.tlId,
      date: s.date,
      stage: s.stage,
      duration: s.duration,
    })),
  }));

  return (
    <>
      <div className="stat-bar" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-number">{fmt(pairs.length)}</div>
          <div className="stat-label">B2B Pairings</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{fmt(totalB2BSets)}</div>
          <div className="stat-label">Total B2B Sets</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{mostSets}</div>
          <div className="stat-label">Most Sets Together</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">B2B Pair Rankings</div>
          <div className="text-muted" style={{ fontSize: '0.75rem' }}>Sorted by joint set count</div>
        </div>
        <B2BClient pairs={serializedPairs} />
      </div>
    </>
  );
}
