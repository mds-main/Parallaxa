import { getLocale, getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/admin/auth';
import { getActiveConfig, listConfigVersions } from '@/lib/config/store';
import { getCatalog } from '@/lib/ai/catalog';
import { getSlotStats, monthlyFreshAnalyses } from '@/lib/admin/metrics';
import { breakerSnapshot } from '@/lib/ai/breaker';
import { EditorWithCost } from '@/components/admin/EditorWithCost';
import { ModelsManager } from '@/components/admin/ModelsManager';

export default async function ModelsPage() {
  const locale = await getLocale();
  await requireAdmin(locale);
  const t = await getTranslations('admin.models');
  const [{ config }, catalog, slotStats, versions, monthly] = await Promise.all([getActiveConfig(), getCatalog(), getSlotStats(7), listConfigVersions(30), monthlyFreshAnalyses()]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className="max-w-3xl muted">{t('intro')}</p>
      <EditorWithCost initial={config} catalog={catalog} monthlyAnalyses={monthly}>
        <ModelsManager
          catalog={catalog}
          stats={slotStats.stats}
          matrix={slotStats.matrix}
          breakers={breakerSnapshot()}
          versions={versions.map((v) => ({ id: v.id, createdAt: v.createdAt.toISOString(), reason: v.reason, status: v.status }))}
        />
      </EditorWithCost>
    </div>
  );
}
