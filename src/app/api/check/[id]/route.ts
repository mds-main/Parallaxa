import { NextResponse } from 'next/server';
import { getAnalysis } from '@/lib/queries';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await getAnalysis(id);
  if (!found) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const a = found.analysis;
  const reused = a.error?.startsWith('reused:') ? a.error.slice(7) : undefined;
  return NextResponse.json(
    {
      id: a.id,
      status: reused ? 'reused' : a.status,
      reusedFrom: reused,
      progress: a.progress,
      error: a.status === 'failed' && !reused ? a.error : undefined,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
