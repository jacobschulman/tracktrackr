import { loadIndex } from '@/lib/data';
import { redirect } from 'next/navigation';

export default function YearPage() {
  const index = loadIndex();
  const latestYear = Math.max(...index.years);
  redirect(`/year/${latestYear}`);
}
