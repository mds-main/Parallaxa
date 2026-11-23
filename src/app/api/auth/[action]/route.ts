import { NextResponse } from 'next/server';
import { z } from 'zod';
import { accountsEnabled, createUserSession, emailHash, getUserSession, signOut } from '@/lib/accounts/session';
import { requestMagicLink, verifyMagicLink } from '@/lib/accounts/magic';
import { authenticationOptions, registrationOptions, verifyAuthentication, verifyRegistration } from '@/lib/accounts/passkeys';
import { rateLimit } from '@/lib/security/rate-limit';
import { clientIp, hashIp } from '@/lib/security/ip';
import { siteUrl } from '@/lib/site';

const origin = (req: Request) => siteUrl(new URL(req.url).origin);

export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  if (!accountsEnabled()) return NextResponse.json({ error: 'disabled' }, { status: 503 });
  const { action } = await params;
  const ipHash = await hashIp(clientIp(req.headers));
  if (!(await rateLimit(`auth:${ipHash}`, 30, 3600)).ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  switch (action) {
    case 'email': {
      const parsed = z.object({ email: z.string().email().max(254), lang: z.string().max(10) }).safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
      if (!(await rateLimit(`auth-email:${emailHash(parsed.data.email)}`, 3, 3600)).ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
      const r = await requestMagicLink(parsed.data.email, parsed.data.lang, origin(req));
      return NextResponse.json({ ok: r.sent, devLink: r.devLink });
    }
    case 'verify': {
      const token = typeof body.token === 'string' ? body.token : '';
      const r = token ? await verifyMagicLink(token) : null;
      if (!r) return NextResponse.json({ error: 'invalid_or_expired' }, { status: 400 });
      await createUserSession(r.userId);
      return NextResponse.json({ ok: true });
    }
    case 'passkey-register-options': {
      const s = await getUserSession();
      if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      return NextResponse.json(await registrationOptions(s.userId, origin(req)));
    }
    case 'passkey-register-verify': {
      if (!(await getUserSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      const ok = await verifyRegistration(body as never, origin(req)).catch(() => false);
      return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
    }
    case 'passkey-login-options':
      return NextResponse.json(await authenticationOptions(origin(req)));
    case 'passkey-login-verify': {
      const userId = await verifyAuthentication(body as never, origin(req)).catch(() => null);
      if (!userId) return NextResponse.json({ error: 'invalid' }, { status: 400 });
      await createUserSession(userId);
      return NextResponse.json({ ok: true });
    }
    case 'logout':
      await signOut();
      return NextResponse.json({ ok: true });
    default:
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
}
