import { NextResponse } from 'next/server';
import { loadIndex } from '@/lib/data';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'tracktrackr-admin';

export async function GET(request: Request) {
  const auth = request.headers.get('x-admin-password');
  if (auth !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').toLowerCase().trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const index = loadIndex();
  const results = index.sets
    .filter(s => {
      const djName = s.dj?.toLowerCase() || '';
      const stage = s.stage?.toLowerCase() || '';
      return djName.includes(q) || stage.includes(q) || s.tlId.includes(q);
    })
    .slice(0, 50)
    .map(s => ({
      tlId: s.tlId,
      dj: s.dj,
      stage: s.stage,
      date: s.date,
      year: s.year,
      festival: s.festival,
      festivalName: s.festivalName,
      duration: s.duration,
    }));

  return NextResponse.json({ results });
}
