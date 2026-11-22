import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { LANGUAGES, localeFromPrefix, prefixFor } from './i18n/languages';
import { resolveLocale } from './i18n/negotiate';
import { buildCsp, createNonce } from './lib/security/csp';
import { clientIp, ipAllowed } from './lib/security/ip';

const intl = createMiddleware(routing);
const PREFIXES = new Set<string>(LANGUAGES.map((l) => l.prefix));
const ADMIN_COOKIE = 'plx_admin';

function withCsp(res: NextResponse, csp: string) {
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const nonce = createNonce();
  const csp = buildCsp(nonce, process.env.NODE_ENV === 'development');

  const first = pathname.split('/')[1] ?? '';
  const urlLocale = PREFIXES.has(first) ? localeFromPrefix(first) : undefined;

  // No locale prefix: pick one (saved choice → browser settings → English) and redirect (PRD F7).
  if (!urlLocale) {
    const locale = resolveLocale({
      savedLocale: request.cookies.get('NEXT_LOCALE')?.value,
      acceptLanguage: request.headers.get('accept-language'),
    });
    const url = request.nextUrl.clone();
    url.pathname = `/${prefixFor(locale)}${pathname === '/' ? '' : pathname}`;
    url.search = search;
    const res = NextResponse.redirect(url, 302);
    res.headers.set('Vary', 'Accept-Language, Cookie');
    return res;
  }

  // Admin console: optional IP allowlist and an optimistic session check. Every admin page and
  // action re-verifies the session server-side (TODO 22.5).
  const rest = pathname.slice(first.length + 1);
  if (rest === '/admin' || rest.startsWith('/admin/')) {
    if (!ipAllowed(clientIp(request.headers), process.env.ADMIN_IP_ALLOWLIST)) {
      return new NextResponse('Not found', { status: 404 });
    }
    const isLogin = rest === '/admin/login';
    if (!isLogin && !request.cookies.get(ADMIN_COOKIE)) {
      const url = request.nextUrl.clone();
      url.pathname = `/${first}/admin/login`;
      url.search = '';
      return NextResponse.redirect(url, 302);
    }
  }

  request.headers.set('x-nonce', nonce);
  request.headers.set('Content-Security-Policy', csp);
  const res = intl(request);
  res.headers.set('X-Robots-Tag', rest.startsWith('/admin') ? 'noindex, nofollow' : 'all');
  return withCsp(res, csp);
}

export const config = {
  matcher: [
    {
      source: '/((?!api|rss|_next/static|_next/image|favicon.ico|icons/|sw.js|robots.txt|sitemap.xml|manifest).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
