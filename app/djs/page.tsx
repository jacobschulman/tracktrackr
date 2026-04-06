import { loadIndex } from '@/lib/data';
import type { SetMeta } from '@/lib/types';
import { DJsPageClient } from './DJsPageClient';

interface DJAggregate {
  name: string;
  slug: string;
  yearsArr: number[];
  yearsCount: number;
  firstYear: number;
  lastYear: number;
  totalSets: number;
  streak: number;
}

function buildDJData(index: { sets: SetMeta[] }): DJAggregate[] {
  const map = new Map<string, { name: string; slug: string; years: Set<number>; totalSets: number; stages: Set<string> }>();

  for (const s of index.sets) {
    for (const d of s.djs) {
      if (!map.has(d.slug)) {
        map.set(d.slug, { name: d.name, slug: d.slug, years: new Set(), totalSets: 0, stages: new Set() });
      }
      const entry = map.get(d.slug)!;
      entry.years.add(s.year);
      entry.totalSets++;
      if (s.stage) entry.stages.add(s.stage);
    }
  }

  const result: DJAggregate[] = [];
  for (const dj of map.values()) {
    const sortedYears = [...dj.years].sort((a, b) => a - b);
    let best = 1, cur = 1;
    for (let i = 1; i < sortedYears.length; i++) {
      if (sortedYears[i] === sortedYears[i - 1] + 1) {
        cur++;
        if (cur > best) best = cur;
      } else {
        cur = 1;
      }
    }
    result.push({
      name: dj.name,
      slug: dj.slug,
      yearsArr: sortedYears,
      yearsCount: sortedYears.length,
      firstYear: sortedYears[0],
      lastYear: sortedYears[sortedYears.length - 1],
      totalSets: dj.totalSets,
      streak: sortedYears.length >= 1 ? best : 0,
    });
  }

  return result;
}

export default function DJsPage() {
  const index = loadIndex();
  const allDJs = buildDJData(index);
  const allStages = [...new Set(index.sets.map((s) => s.stage))].sort();

  // Build year counts per DJ for heatmap
  const djYearCounts: Record<string, Record<number, number>> = {};
  // Also build stage sets per DJ for filtering
  const djStages: Record<string, string[]> = {};

  for (const s of index.sets) {
    for (const d of s.djs) {
      if (!djYearCounts[d.slug]) djYearCounts[d.slug] = {};
      djYearCounts[d.slug][s.year] = (djYearCounts[d.slug][s.year] || 0) + 1;

      if (!djStages[d.slug]) djStages[d.slug] = [];
      if (!djStages[d.slug].includes(s.stage)) djStages[d.slug].push(s.stage);
    }
  }

  // Build stage-filtered year counts so the client can filter by stage
  const stageFilteredData: Record<string, Record<string, Record<number, number>>> = {};
  for (const s of index.sets) {
    const stage = s.stage;
    if (!stageFilteredData[stage]) stageFilteredData[stage] = {};
    for (const d of s.djs) {
      if (!stageFilteredData[stage][d.slug]) stageFilteredData[stage][d.slug] = {};
      stageFilteredData[stage][d.slug][s.year] = (stageFilteredData[stage][d.slug][s.year] || 0) + 1;
    }
  }

  return (
    <DJsPageClient
      allDJs={allDJs}
      years={index.years}
      allStages={allStages}
      djYearCounts={djYearCounts}
      djStages={djStages}
      stageFilteredData={stageFilteredData}
    />
  );
}
