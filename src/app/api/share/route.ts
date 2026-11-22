import { NextResponse } from 'next/server';
import { resolveLocale } from '@/i18n/negotiate';
import { prefixFor } from '@/i18n/languages';

/**
 * PWA share target (PRD 8.5): the OS share sheet POSTs title/text/url here. We prefill the check form
 * instead of auto-running, so nothing is checked without the user pressing "Check it".
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const locale = resolveLocale({ savedLocale: req.headers.get('cookie')?.match(/NEXT_LOCALE=([^;]+)/)?.[1], acceptLanguage: req.headers.get('accept-language') });
  const params = new URLSearchParams();
  for (const k of ['title', 'text', 'url']) {
    const v = form.get(k);
    if (typeof v === 'string' && v.trim()) params.set(k, v.slice(0, 4000));
  }
  return NextResponse.redirect(new URL(`/${prefixFor(locale)}?${params}`, req.url), 303);
}
