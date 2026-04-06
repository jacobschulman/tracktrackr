'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DJItem {
  slug: string;
  name: string;
}

interface IndexData {
  sets: { djs: { slug: string; name: string }[]; year: number; stage: string }[];
  years: number[];
}

export default function VersusPage() {
  const [djList, setDJList] = useState<DJItem[]>([]);
  const [index, setIndex] = useState<IndexData | null>(null);
  const [selectedDJ1, setSelectedDJ1] = useState<DJItem | null>(null);
  const [selectedDJ2, setSelectedDJ2] = useState<DJItem | null>(null);
  const [query1, setQuery1] = useState('');
  const [query2, setQuery2] = useState('');
  const [dropdown1Open, setDropdown1Open] = useState(false);
  const [dropdown2Open, setDropdown2Open] = useState(false);

  useEffect(() => {
    fetch('/data/ultra-miami/index.json')
      .then(r => r.json())
      .then((data: IndexData) => {
        setIndex(data);
        const djMap = new Map<string, string>();
        for (const s of data.sets) {
          for (const d of s.djs) {
            if (!djMap.has(d.slug)) djMap.set(d.slug, d.name);
          }
        }
        setDJList([...djMap.entries()].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => {});
  }, []);

  const filterDJs = (q: string, excludeSlug: string | null) => {
    const lower = q.toLowerCase();
    return djList.filter(d => d.name.toLowerCase().includes(lower) && d.slug !== excludeSlug).slice(0, 20);
  };

  const results1 = query1.length >= 1 ? filterDJs(query1, selectedDJ2?.slug || null) : [];
  const results2 = query2.length >= 1 ? filterDJs(query2, selectedDJ1?.slug || null) : [];
  const ready = selectedDJ1 && selectedDJ2 && index;

  // Compute comparison data when both DJs are selected
  let comparison: any = null;
  if (ready && index) {
    const slug1 = selectedDJ1.slug;
    const slug2 = selectedDJ2.slug;
    const history1 = index.sets.filter(s => s.djs.some(d => d.slug === slug1));
    const history2 = index.sets.filter(s => s.djs.some(d => d.slug === slug2));
    const years1 = new Set(history1.map(s => s.year));
    const years2 = new Set(history2.map(s => s.year));

    const computeStreak = (years: Set<number>) => {
      const sorted = [...years].sort((a, b) => a - b);
      let best = 1, cur = 1;
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i - 1] + 1) { cur++; if (cur > best) best = cur; } else cur = 1;
      }
      return sorted.length > 0 ? best : 0;
    };

    const stages1: Record<string, number> = {};
    const stages2: Record<string, number> = {};
    for (const s of history1) stages1[s.stage] = (stages1[s.stage] || 0) + 1;
    for (const s of history2) stages2[s.stage] = (stages2[s.stage] || 0) + 1;

    const allStages = [...new Set([...Object.keys(stages1), ...Object.keys(stages2)])]
      .sort((a, b) => ((stages1[b] || 0) + (stages2[b] || 0)) - ((stages1[a] || 0) + (stages2[a] || 0)));
    const maxStageCount = Math.max(1, ...allStages.map(s => Math.max(stages1[s] || 0, stages2[s] || 0)));

    const minYear = Math.min(...index.years);
    const maxYear = Math.max(...index.years);
    let yearsBoth = 0, yearsOnly1 = 0, yearsOnly2 = 0;
    const dots: { year: number; in1: boolean; in2: boolean }[] = [];
    for (let y = minYear; y <= maxYear; y++) {
      const in1 = years1.has(y);
      const in2 = years2.has(y);
      dots.push({ year: y, in1, in2 });
      if (in1 && in2) yearsBoth++;
      else if (in1) yearsOnly1++;
      else if (in2) yearsOnly2++;
    }

    comparison = {
      sets1: history1.length, sets2: history2.length,
      years1: years1.size, years2: years2.size,
      streak1: computeStreak(years1), streak2: computeStreak(years2),
      stages1, stages2, allStages, maxStageCount,
      dots, yearsBoth, yearsOnly1, yearsOnly2, minYear, maxYear,
    };
  }

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h2 style={{ marginBottom: 8 }}>Versus</h2>
        <div style={{ color: 'var(--muted)', fontSize: '0.9375rem' }}>Compare two DJs head-to-head</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'start', maxWidth: 700, margin: '0 auto 40px' }}>
        {/* DJ 1 Picker */}
        <DJPicker
          selected={selectedDJ1}
          query={query1}
          setQuery={setQuery1}
          results={results1}
          dropdownOpen={dropdown1Open}
          setDropdownOpen={setDropdown1Open}
          onSelect={(d) => { setSelectedDJ1(d); setDropdown1Open(false); setQuery1(''); }}
          onClear={() => { setSelectedDJ1(null); setQuery1(''); }}
          color="var(--purple-lt)"
        />
        <div style={{ paddingTop: 10, fontSize: '1.25rem', fontWeight: 900, color: 'var(--purple-lt)' }}>VS</div>
        {/* DJ 2 Picker */}
        <DJPicker
          selected={selectedDJ2}
          query={query2}
          setQuery={setQuery2}
          results={results2}
          dropdownOpen={dropdown2Open}
          setDropdownOpen={setDropdown2Open}
          onSelect={(d) => { setSelectedDJ2(d); setDropdown2Open(false); setQuery2(''); }}
          onClear={() => { setSelectedDJ2(null); setQuery2(''); }}
          color="var(--green)"
        />
      </div>

      {/* Comparison Results */}
      {comparison && selectedDJ1 && selectedDJ2 && (
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
              <Link href={`/dj/${selectedDJ1.slug}`} style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--purple-lt)', textDecoration: 'none' }}>
                {selectedDJ1.name}
              </Link>
              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--purple-lt)' }}>vs</span>
              <Link href={`/dj/${selectedDJ2.slug}`} style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--green)', textDecoration: 'none' }}>
                {selectedDJ2.name}
              </Link>
            </div>
          </div>

          {/* Tale of the Tape */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header"><div className="card-title">Tale of the Tape</div></div>
            {[
              { label: 'Total Sets', v1: comparison.sets1, v2: comparison.sets2 },
              { label: 'Years Active', v1: comparison.years1, v2: comparison.years2 },
              { label: 'Longest Streak', v1: comparison.streak1, v2: comparison.streak2 },
            ].map(row => (
              <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ textAlign: 'right', fontSize: '1.125rem', fontWeight: 700, color: row.v1 > row.v2 ? 'var(--green)' : 'var(--text)' }}>{row.v1}</div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', minWidth: 100, textAlign: 'center' }}>{row.label}</div>
                <div style={{ textAlign: 'left', fontSize: '1.125rem', fontWeight: 700, color: row.v2 > row.v1 ? 'var(--green)' : 'var(--text)' }}>{row.v2}</div>
              </div>
            ))}
          </div>

          {/* Timeline Overlap */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header"><div className="card-title">Timeline Overlap</div></div>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', minWidth: 'max-content', padding: '8px 0' }}>
                {comparison.dots.map((d: any) => {
                  let bg: string;
                  if (d.in1 && d.in2) bg = 'var(--yellow)';
                  else if (d.in1) bg = 'var(--purple-lt)';
                  else if (d.in2) bg = 'var(--green)';
                  else bg = 'var(--border)';
                  return <div key={d.year} style={{ width: 12, height: 12, borderRadius: '50%', background: bg, flexShrink: 0 }} title={`${d.year}`} />;
                })}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12, fontSize: '0.8125rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--yellow)', display: 'inline-block' }} />
                <span style={{ color: 'var(--muted-lt)' }}><strong style={{ color: 'var(--text)' }}>{comparison.yearsBoth}</strong> years together</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--purple-lt)', display: 'inline-block' }} />
                <span style={{ color: 'var(--muted-lt)' }}><strong style={{ color: 'var(--text)' }}>{comparison.yearsOnly1}</strong> only {selectedDJ1.name}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
                <span style={{ color: 'var(--muted-lt)' }}><strong style={{ color: 'var(--text)' }}>{comparison.yearsOnly2}</strong> only {selectedDJ2.name}</span>
              </span>
            </div>
          </div>

          {/* Stage Comparison */}
          {comparison.allStages.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header"><div className="card-title">Stage Comparison</div></div>
              {comparison.allStages.map((stage: string) => {
                const c1 = comparison.stages1[stage] || 0;
                const c2 = comparison.stages2[stage] || 0;
                const pct1 = (c1 / comparison.maxStageCount) * 100;
                const pct2 = (c2 / comparison.maxStageCount) * 100;
                return (
                  <div key={stage} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center', padding: '6px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted-lt)', flexShrink: 0 }}>{c1 > 0 ? c1 : ''}</span>
                      <div style={{ height: 16, width: `${pct1}%`, background: 'var(--purple-lt)', borderRadius: '4px 0 0 4px', minWidth: c1 > 0 ? 4 : 0, marginLeft: 'auto' }} />
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--muted-lt)', minWidth: 120, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={stage}>
                      {stage}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ height: 16, width: `${pct2}%`, background: 'var(--green)', borderRadius: '0 4px 4px 0', minWidth: c2 > 0 ? 4 : 0 }} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted-lt)', flexShrink: 0 }}>{c2 > 0 ? c2 : ''}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DJPicker({ selected, query, setQuery, results, dropdownOpen, setDropdownOpen, onSelect, onClear, color }: {
  selected: DJItem | null;
  query: string;
  setQuery: (q: string) => void;
  results: DJItem[];
  dropdownOpen: boolean;
  setDropdownOpen: (o: boolean) => void;
  onSelect: (d: DJItem) => void;
  onClear: () => void;
  color: string;
}) {
  if (selected) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--surface2)', border: '1px solid var(--border-lt)', borderRadius: 'var(--radius-sm)' }}>
        <span style={{ fontWeight: 600, fontSize: '0.9375rem', flex: 1, color }}>{selected.name}</span>
        <button onClick={onClear} style={{ color: 'var(--muted)', fontSize: '1rem', lineHeight: 1, padding: '2px 6px', borderRadius: 4, background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        placeholder="Search DJ..."
        value={query}
        onChange={e => { setQuery(e.target.value); setDropdownOpen(true); }}
        onFocus={() => query.length >= 1 && setDropdownOpen(true)}
        autoComplete="off"
        style={{ width: '100%', padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border-lt)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.9375rem', outline: 'none', boxSizing: 'border-box' }}
      />
      {dropdownOpen && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: 240, overflowY: 'auto', background: 'var(--surface2)', border: '1px solid var(--border-lt)', borderTop: 'none', borderRadius: '0 0 var(--radius-sm) var(--radius-sm)', zIndex: 10 }}>
          {results.map(d => (
            <div key={d.slug} onClick={() => onSelect(d)} style={{ padding: '8px 14px', cursor: 'pointer', fontSize: '0.875rem' }}
              onMouseOver={e => (e.currentTarget.style.background = 'var(--surface3)')}
              onMouseOut={e => (e.currentTarget.style.background = '')}
            >{d.name}</div>
          ))}
        </div>
      )}
    </div>
  );
}
