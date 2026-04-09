import { loadIndex } from '@/lib/data';
import { getAllFestivals } from '@/lib/festivals';
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
  festivals: string[];
}

function buildDJData(sets: SetMeta[]): DJAggregate[] {
  const map = new Map<string, { name: string; slug: string; years: Set<number>; totalSets: number; festivals: Set<string> }>();

  for (const s of sets) {
    for (const d of s.djs) {
      if (!map.has(d.slug)) {
        map.set(d.slug, { name: d.name, slug: d.slug, years: new Set(), totalSets: 0, festivals: new Set() });
      }
      const entry = map.get(d.slug)!;
      entry.years.add(s.year);
      entry.totalSets++;
      if (s.festival) entry.festivals.add(s.festival);
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
      festivals: [...dj.festivals],
    });
  }

  return result;
}

export default function DJsPage() {
  const index = loadIndex();

  // Build all DJs (holistic)
  const allDJs = buildDJData(index.sets);

  // Build per-festival DJ data
  const festivalConfigs = getAllFestivals();
  const availableFestivals = [...new Set(index.sets.map(s => s.festival).filter(Boolean))];
  const djsByFestival: Record<string, DJAggregate[]> = {};
  for (const festSlug of availableFestivals) {
    const festSets = index.sets.filter(s => s.festival === festSlug);
    djsByFestival[festSlug] = buildDJData(festSets);
  }

  // Festival labels for the chips
  const festivalLabels: { slug: string; shortName: string; accent: string }[] = availableFestivals
    .map(slug => {
      const cfg = festivalConfigs.find(f => f.slug === slug);
      return { slug, shortName: cfg?.shortName || slug, accent: cfg?.accent || '#64748b' };
    })
    .sort((a, b) => (djsByFestival[b.slug]?.length || 0) - (djsByFestival[a.slug]?.length || 0));

  return (
    <DJsPageClient
      allDJs={allDJs}
      djsByFestival={djsByFestival}
      festivalLabels={festivalLabels}
    />
  );
}
