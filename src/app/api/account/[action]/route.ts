import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { accountsEnabled, getUserSession, signOut } from '@/lib/accounts/session';
import { PLACEMENTS, deleteAccount, deleteSelfPlacement, exportAccount, loadPreferencesFor, savePreferencesFor, setSelfPlacement } from '@/lib/accounts/data';
import { getDb } from '@/lib/db/client';
import { passkeys, userPoliticalSelfId } from '@/lib/db/schema';

async function session() {
  if (!accountsEnabled()) return null;
  return getUserSession();
}

export async function GET(_req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const s = await session();
  if (action === 'status') {
    if (!s) return NextResponse.json({ enabled: accountsEnabled(), signedIn: false });
    const db = await getDb();
    const [pk] = await db.select({ n: sql<number>`count(*)::int` }).from(passkeys).where(eq(passkeys.userId, s.userId));
    const [self] = await db.select({ n: sql<number>`count(*)::int` }).from(userPoliticalSelfId).where(eq(userPoliticalSelfId.userId, s.userId));
    return NextResponse.json({ enabled: true, signedIn: true, passkeys: pk?.n ?? 0, hasSelfPlacement: (self?.n ?? 0) > 0 }, { headers: { 'Cache-Control': 'no-store' } });
  }
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (action === 'preferences') return NextResponse.json({ preferences: await loadPreferencesFor(s.userId) }, { headers: { 'Cache-Control': 'no-store' } });
  if (action === 'export') {
    return new NextResponse(JSON.stringify(await exportAccount(s.userId), null, 2), {
      headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="parallaxa-account.json"', 'Cache-Control': 'no-store' },
    });
  }
  return NextResponse.json({ error: 'not_found' }, { status: 404 });
}

export async function PUT(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const s = await session();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (action === 'preferences') {
    const parsed = z.object({ preferences: z.record(z.string(), z.unknown()) }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
    await savePreferencesFor(s.userId, parsed.data.preferences);
    return NextResponse.json({ ok: true });
  }
  if (action === 'self-placement') {
    const parsed = z.object({ placement: z.enum(PLACEMENTS), consent: z.literal(true) }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'consent_required' }, { status: 400 });
    await setSelfPlacement(s.userId, parsed.data.placement, parsed.data.consent);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'not_found' }, { status: 404 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const s = await session();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (action === 'self-placement') {
    await deleteSelfPlacement(s.userId);
    return NextResponse.json({ ok: true });
  }
  if (action === 'account') {
    const body = (await req.json().catch(() => ({}))) as { confirm?: string };
    if (body.confirm !== 'DELETE') return NextResponse.json({ error: 'confirm_required' }, { status: 400 });
    await deleteAccount(s.userId);
    await signOut();
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'not_found' }, { status: 404 });
}
