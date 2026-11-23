import { getCorrections } from '@/lib/queries';
import { isLocale, prefixFor, DEFAULT_LOCALE } from '@/i18n/languages';
import { siteUrl } from '@/lib/site';

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

/** Public corrections feed (PRD F1 stage 9: "the corrections log is public and RSS-able"). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get('lang') ?? DEFAULT_LOCALE;
  const lang = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const site = siteUrl(url.origin);
  const items = (await getCorrections())
    .map((c) => {
      const link = `${site}/${prefixFor(lang)}/a/${c.analysisId}`;
      return `<item><title>${esc(c.reason[lang] ?? c.reason.en ?? 'Correction')}</title><link>${link}</link><guid isPermaLink="false">${c.id}</guid><pubDate>${c.createdAt.toUTCString()}</pubDate></item>`;
    })
    .join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Parallaxa corrections</title><link>${site}/${prefixFor(lang)}/trust/corrections</link><description>Every correction, with what changed and why.</description><language>${lang}</language>${items}</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}
