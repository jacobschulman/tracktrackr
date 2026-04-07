'use client';

import { useRouter } from 'next/navigation';

export function YearSelect({ years, current }: { years: number[]; current: number }) {
  const router = useRouter();
  return (
    <select
      className="sets-select"
      value={current}
      onChange={(e) => router.push(`/year/${e.target.value}`)}
      style={{ padding: '7px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.8125rem', cursor: 'pointer', outline: 'none' }}
    >
      {years.map(y => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  );
}
