import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { FESTIVALS } from '@/lib/festivals';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'tracktrackr-admin';
const DATA_ROOT = path.join(process.cwd(), 'data');

export async function GET(request: Request) {
  const auth = request.headers.get('x-admin-password');
  if (auth !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Read blocklist
  let hiddenFestivals: string[] = [];
  try {
    const raw = fs.readFileSync(path.join(DATA_ROOT, 'blocklist.json'), 'utf-8');
    const data = JSON.parse(raw);
    hiddenFestivals = data.festivals || [];
  } catch {}

  // Scan all festival dirs
  const festivals: { slug: string; name: string; accent: string; setCount: number; hidden: boolean }[] = [];
  try {
    const entries = fs.readdirSync(DATA_ROOT, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const indexPath = path.join(DATA_ROOT, entry.name, 'index.json');
      if (!fs.existsSync(indexPath)) continue;
      const raw = fs.readFileSync(indexPath, 'utf-8');
      const idx = JSON.parse(raw);
      const config = FESTIVALS[entry.name];
      festivals.push({
        slug: entry.name,
        name: config?.shortName || idx.festivalName || entry.name,
        accent: config?.accent || '#64748b',
        setCount: idx.sets?.length || 0,
        hidden: hiddenFestivals.includes(entry.name),
      });
    }
  } catch {}

  festivals.sort((a, b) => b.setCount - a.setCount);

  return NextResponse.json({ festivals });
}
