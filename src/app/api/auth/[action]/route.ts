import { NextResponse } from 'next/server';
import { accountsEnabled, createUserSession, getUserSession, signOut } from '@/lib/accounts/session';
import { authenticationOptions, registrationOptions, signupOptions, verifyAuthentication, verifyRegistration } from '@/lib/accounts/passkeys';
import { isLocale, DEFAULT_LOCALE } from '@/i18n/languages';
import { rateLimit } from '@/lib/security/rate-limit';
import { clientIp, hashIp } from '@/lib/security/ip';
import { siteUrl } from '@/lib/site';
import { log, requestId } from '@/lib/log';

const origin = (req: Request) => siteUrl(new URL(req.url).origin);

export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  if (!accountsEnabled()) return NextResponse.json({ error: 'disabled' }, { status: 503 });
  const { action } = await params;
  const ipHash = await hashIp(clientIp(req.headers));
  if (!(await rateLimit(`auth:${ipHash}`, 30, 3600)).ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  /** A passkey check that throws or says no: logged with the hosts involved (the usual cause is a domain mismatch). */
  const checked = async <T,>(p: Promise<T | null>): Promise<T | null> => {
    const r = await p.catch((e: unknown) => {
      log.warn('auth.passkey_failed', { action, host: new URL(req.url).host, expected: origin(req), req: requestId(req.headers), error: e });
      return null;
    });
    if (r === null) log.info('auth.passkey_rejected', { action, host: new URL(req.url).host, expected: origin(req), req: requestId(req.headers) });
    return r;
  };

  switch (action) {
    case 'passkey-signup-options': {
      const lang = typeof body.lang === 'string' && isLocale(body.lang) ? body.lang : DEFAULT_LOCALE;
      return NextResponse.json(await signupOptions(origin(req), lang));
    }
    case 'passkey-signup-verify': {
      const userId = await checked(verifyRegistration(body as never, origin(req)));
      if (!userId) return NextResponse.json({ error: 'invalid' }, { status: 400 });
      await createUserSession(userId);
      return NextResponse.json({ ok: true });
    }
    case 'passkey-register-options': {
      const s = await getUserSession();
      if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      return NextResponse.json(await registrationOptions(s.userId, origin(req)));
    }
    case 'passkey-register-verify': {
      if (!(await getUserSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      const ok = Boolean(await checked(verifyRegistration(body as never, origin(req))));
      return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
    }
    case 'passkey-login-options':
      return NextResponse.json(await authenticationOptions(origin(req)));
    case 'passkey-login-verify': {
      const userId = await checked(verifyAuthentication(body as never, origin(req)));
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
