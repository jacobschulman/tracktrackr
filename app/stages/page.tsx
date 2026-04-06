import { loadIndex, getStageHistory, fmt } from '@/lib/data';
import { CONFIG, getStageColor } from '@/lib/config';
import StageTimeline from './StageTimeline';

export default function StagesPage() {
  const index = loadIndex();
  const stageData = getStageHistory();

  const stages = stageData
    .filter(s => s.stage !== 'Radio/Podcast' && s.stage !== 'Unknown Stage')
    .sort((a, b) => a.firstYear - b.firstYear || b.totalSets - a.totalSets);

  const minYear = CONFIG.years.min;
  const maxYear = CONFIG.years.max;
  const years: number[] = [];
  for (let y = minYear; y <= maxYear; y++) years.push(y);

  // Build stage data with colors for client component
  const stagesWithColors = stages.map(s => ({
    ...s,
    color: getStageColor(s.stage),
  }));

  // Build per-stage year-by-year set counts for detail panels
  const stageSetCounts: Record<string, Record<number, number>> = {};
  for (const s of index.sets) {
    if (!stageSetCounts[s.stage]) stageSetCounts[s.stage] = {};
    stageSetCounts[s.stage][s.year] = (stageSetCounts[s.stage][s.year] || 0) + 1;
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">Stage Timeline</div>
          <div className="text-muted" style={{ fontSize: '0.75rem' }}>
            {stages.length} stages across {years.length} years
          </div>
        </div>
        <StageTimeline
          stages={stagesWithColors}
          years={years}
          minYear={minYear}
          maxYear={maxYear}
          stageSetCounts={stageSetCounts}
        />
      </div>
    </div>
  );
}
