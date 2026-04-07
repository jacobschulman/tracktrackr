'use client';

import { useState } from 'react';
import Link from 'next/link';

interface B2BPair {
  djs: { slug: string; name: string }[];
  count: number;
  years: number[];
  sets: { tlId: string; date: string; stage: string; duration: string }[];
}

export function B2BClient({ pairs }: { pairs: B2BPair[] }) {
  const [openPairIdx, setOpenPairIdx] = useState<number | null>(null);

  return (
    <div>
      {pairs.map((pair, idx) => {
        const isOpen = openPairIdx === idx;

        return (
          <div key={pair.djs.map(d => d.slug).join('_')} style={{ borderBottom: '1px solid var(--border)' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', gap: 12, flexWrap: 'wrap', cursor: 'pointer' }}
              onClick={() => setOpenPairIdx(isOpen ? null : idx)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
                <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                  {pair.djs.map((d, i) => (
                    <span key={d.slug}>
                      {i > 0 && <span style={{ color: 'var(--muted)' }}> &amp; </span>}
                      <Link href={`/dj/${d.slug}`} className="dj-link" onClick={e => e.stopPropagation()}>{d.name}</Link>
                    </span>
                  ))}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <span className="pill pill-purple">{pair.count} joint set{pair.count > 1 ? 's' : ''}</span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {pair.years.map(y => (
                    <span key={y} className="year-pill" style={{ cursor: 'default', fontSize: '0.6875rem', padding: '2px 6px' }}>{y}</span>
                  ))}
                </div>
              </div>
            </div>
            {isOpen && (
              <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                <div className="section-title" style={{ marginTop: 12 }}>Joint Set History</div>
                <table className="data-table" style={{ marginBottom: 16 }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Stage</th>
                      <th>Duration</th>
                      <th>Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pair.sets.map(s => (
                      <tr key={s.tlId}>
                        <td>{s.date}</td>
                        <td>{s.stage}</td>
                        <td>{s.duration || '\u2014'}</td>
                        <td>
                          <Link href={`/set/${s.tlId}`} style={{ color: 'var(--purple-lt)', fontSize: '0.8125rem' }}>
                            View Set
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
