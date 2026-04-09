'use client';

interface FestivalLabel {
  slug: string;
  shortName: string;
  accent: string;
}

export function FestivalSelect({ festivalLabels, value, onChange }: {
  festivalLabels: FestivalLabel[];
  value: string;
  onChange: (slug: string) => void;
}) {
  if (festivalLabels.length <= 1) return null;

  return (
    <select
      className="filter-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">All Festivals</option>
      {festivalLabels.map(f => (
        <option key={f.slug} value={f.slug}>{f.shortName}</option>
      ))}
    </select>
  );
}
