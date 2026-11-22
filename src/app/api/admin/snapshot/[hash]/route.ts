import { eq } from 'drizzle-orm';
import { getAdminSession } from '@/lib/admin/auth';
import { getDb } from '@/lib/db/client';
import { sourceSnapshots } from '@/lib/db/schema';

/** Archived source text, for reviewers only (snapshots stay private; the public site shows short quotes). */
export async function GET(_req: Request, { params }: { params: Promise<{ hash: string }> }) {
  if (!(await getAdminSession())) return new Response('Unauthorized', { status: 401 });
  const { hash } = await params;
  if (!/^[0-9a-f]{64}$/.test(hash)) return new Response('Not found', { status: 404 });
  const db = await getDb();
  const [snap] = await db.select().from(sourceSnapshots).where(eq(sourceSnapshots.hash, hash));
  if (!snap) return new Response('Not found', { status: 404 });
  return new Response(`${snap.title ?? ''}\n${snap.url}\nArchived ${snap.fetchedAt.toISOString()}\nSHA-256 ${snap.hash}\n\n${snap.text}`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex', 'Cache-Control': 'private, no-store' },
  });
}
