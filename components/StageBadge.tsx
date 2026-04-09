import { getStageColor } from '@/lib/festivals';

export function StageBadge({ stage, festival }: { stage: string; festival?: string }) {
  const color = getStageColor(festival || 'ultra-miami', stage);
  return (
    <span className="stage-badge">
      <span className="dot" style={{ background: color }} />
      {stage}
    </span>
  );
}
