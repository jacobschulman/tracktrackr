import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const BLOCKLIST_PATH = path.join(process.cwd(), 'data', 'blocklist.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'tracktrackr-admin';

function checkAuth(request: Request): boolean {
  const auth = request.headers.get('x-admin-password');
  return auth === ADMIN_PASSWORD;
}

function readBlocklist() {
  try {
    const raw = fs.readFileSync(BLOCKLIST_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { sets: [], festivals: [] };
  }
}

function writeBlocklist(data: { sets: string[]; festivals: string[] }) {
  fs.writeFileSync(BLOCKLIST_PATH, JSON.stringify({
    _comment: "Hidden sets and festivals. Sets: add tlId values. Festivals: add festival slugs to hide entirely.",
    sets: data.sets,
    festivals: data.festivals,
  }, null, 2) + '\n');
}

export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const data = readBlocklist();
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const current = readBlocklist();
  const action = body.action as string;

  if (action === 'block_set') {
    const tlId = String(body.tlId);
    if (!current.sets.includes(tlId)) {
      current.sets.push(tlId);
    }
  } else if (action === 'unblock_set') {
    const tlId = String(body.tlId);
    current.sets = current.sets.filter((id: string) => id !== tlId);
  } else if (action === 'hide_festival') {
    const slug = String(body.slug);
    if (!current.festivals.includes(slug)) {
      current.festivals.push(slug);
    }
  } else if (action === 'show_festival') {
    const slug = String(body.slug);
    current.festivals = current.festivals.filter((id: string) => id !== slug);
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  writeBlocklist(current);
  return NextResponse.json({ ok: true, ...current });
}
