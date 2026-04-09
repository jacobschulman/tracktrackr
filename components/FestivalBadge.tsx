import { FESTIVALS } from '@/lib/festivals';

export function FestivalBadge({ festival, size = 'sm' }: { festival: string; size?: 'sm' | 'md' }) {
  const config = FESTIVALS[festival];
  const name = config?.shortName || festival;
  const color = config?.accent || '#64748b';

  const fontSize = size === 'md' ? '0.75rem' : '0.625rem';
  const padding = size === 'md' ? '3px 8px' : '2px 6px';

  return (
    <span
      className="festival-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize,
        padding,
        borderRadius: 4,
        background: `${color}18`,
        color,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {name}
    </span>
  );
}
