import type { MetadataRoute } from 'next';
import { desc, eq } from 'drizzle-orm';
import { ENABLED_LANGUAGES } from '@/i18n/languages';
import { getDb } from '@/lib/db/client';
import { analyses } from '@/lib/db/schema';
import { siteUrl } from '@/lib/site';

const SITE = siteUrl();
const STATIC = ['', '/today', '/ledger', '/quiz', '/trust', '/trust/models', '/trust/methodology', '/trust/corrections', '/trust/audits', '/trust/funding', '/trust/privacy'];

/** Localized sitemap with hreflang alternates for every enabled language (TODO 4.14). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const alt = (path: string) => ({ languages: Object.fromEntries(ENABLED_LANGUAGES.map((l) => [l.tag, `${SITE}/${l.prefix}${path}`])) });
  const db = await getDb();
  const recent = await db.select({ id: analyses.id, at: analyses.publishedAt }).from(analyses).where(eq(analyses.status, 'published')).orderBy(desc(analyses.publishedAt)).limit(5000);
  return [
    ...STATIC.map((path) => ({ url: `${SITE}/en${path}`, alternates: alt(path), changeFrequency: path === '/today' ? ('daily' as const) : ('weekly' as const) })),
    ...recent.map((a) => ({ url: `${SITE}/en/a/${a.id}`, lastModified: a.at ?? undefined, alternates: alt(`/a/${a.id}`) })),
  ];
}
