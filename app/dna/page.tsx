import { loadIndex } from '@/lib/data';
import { redirect } from 'next/navigation';

export default function DNAPage() {
  const index = loadIndex();
  redirect(`/dna/${Math.max(...index.years)}`);
}
