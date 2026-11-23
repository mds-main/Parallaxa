import { getLocale, getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/admin/auth';
import { getActiveConfig, listConfigVersions } from '@/lib/config/store';
import { getCatalog } from '@/lib/ai/catalog';
import { getProviderUsage, getSlotStats, monthlyFreshAnalyses } from '@/lib/admin/metrics';
import { breakerSnapshot } from '@/lib/ai/breaker';
import { EditorWithCost } from '@/components/admin/EditorWithCost';
import { ModelsManager } from '@/components/admin/ModelsManager';
import { ProviderRouting } from '@/components/admin/ProviderRouting';
import { getGatewayModelIds } from '@/lib/ai/gateway-catalog';

/** Server actions posted from this page (model tests run real investigations) get the longest limit. */
export const maxDuration = 800;

export default async function ModelsPage() {
  const locale = await getLocale();
  await requireAdmin(locale);
  const t = await getTranslations('admin.models');
  const [{ config }, catalog, slotStats, versions, monthly, usage, gatewayIds] = await Promise.all([getActiveConfig(), getCatalog(), getSlotStats(7), listConfigVersions(30), monthlyFreshAnalyses(), getProviderUsage(24), getGatewayModelIds()]);
  // Only whether each key is set reaches the page, never the key itself.
  const keyStatus = {
    venice: { set: Boolean(process.env.VENICE_API_KEY), env: 'VENICE_API_KEY' },
    gateway: { set: Boolean(process.env.AI_GATEWAY_API_KEY), env: 'AI_GATEWAY_API_KEY' },
  };
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className="max-w-3xl muted">{t('intro')}</p>
      <EditorWithCost initial={config} catalog={catalog} monthlyAnalyses={monthly}>
        <div className="mb-4">
          <ProviderRouting keyStatus={keyStatus} usage={usage} gatewayIds={gatewayIds} />
        </div>
        <ModelsManager
          catalog={catalog}
          gatewayIds={gatewayIds}
          stats={slotStats.stats}
          matrix={slotStats.matrix}
          breakers={breakerSnapshot()}
          versions={versions.map((v) => ({ id: v.id, createdAt: v.createdAt.toISOString(), reason: v.reason, status: v.status }))}
        />
      </EditorWithCost>
    </div>
  );
}
