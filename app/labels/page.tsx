import { loadIndex, loadAllSets, getLabelTimeline } from '@/lib/data';
import { fmt } from '@/lib/data';
import { LabelsClient } from './LabelsClient';

export default function LabelsPage() {
  const index = loadIndex();
  loadAllSets();

  const labelData = getLabelTimeline();

  if (!labelData || labelData.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">~</div>
        <div className="empty-state-text">No label data available.</div>
      </div>
    );
  }

  // Determine years that have data
  const allYearsSet = new Set<number>();
  for (const l of labelData) {
    for (const y of Object.keys(l.playsByYear)) {
      allYearsSet.add(parseInt(y));
    }
  }
  const allYears = [...allYearsSet].sort((a, b) => a - b);
  const minYear = allYears[0];
  const maxYear = allYears[allYears.length - 1];
  const scrapedCount = index.scrapedSets || index.sets.filter(s => s.hasSetFile).length;

  const top15 = labelData.slice(0, 15);
  const top50 = labelData.slice(0, 50);

  return (
    <>
      <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginBottom: 16 }}>
        Based on {fmt(scrapedCount)} scraped sets from years {minYear}&ndash;{maxYear}
      </div>
      <LabelsClient top15={top15} top50={top50} allYears={allYears} />
    </>
  );
}
