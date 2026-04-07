import { getStageColor } from '@/lib/config';

export function StageBadge({ stage }: { stage: string }) {
  const color = getStageColor(stage);
  return (
    <span className="stage-badge">
      <span className="dot" style={{ background: color }} />
      {stage}
    </span>
  );
}
