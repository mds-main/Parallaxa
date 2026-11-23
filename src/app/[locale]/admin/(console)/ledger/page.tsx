import { getLocale, getTranslations } from 'next-intl/server';
import { eq, sql } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin/auth';
import { getDb } from '@/lib/db/client';
import { actorClaims, actors } from '@/lib/db/schema';
import { LedgerManager } from '@/components/admin/LedgerManager';

export default async function LedgerAdminPage() {
  const locale = await getLocale();
  await requireAdmin(locale);
  const t = await getTranslations('admin.ledger');
  const db = await getDb();
  const rows = await db
    .select({ a: actors, claims: sql<number>`count(${actorClaims.analysisId})::int` })
    .from(actors)
    .leftJoin(actorClaims, eq(actorClaims.actorId, actors.id))
    .groupBy(actors.id)
    .orderBy(actors.name);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className="max-w-3xl muted">{t('intro')}</p>
      <LedgerManager actors={rows.map((r) => ({ id: r.a.id, slug: r.a.slug, name: r.a.name, type: r.a.type, country: r.a.country, published: r.a.published, claims: r.claims, publicRole: r.a.publicRole }))} />
    </div>
  );
}
