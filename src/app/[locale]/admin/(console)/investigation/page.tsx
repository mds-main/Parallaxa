import { getLocale, getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/admin/auth';
import { getActiveConfig } from '@/lib/config/store';
import { getCatalog } from '@/lib/ai/catalog';
import { EditorWithCost } from '@/components/admin/EditorWithCost';
import { InvestigationSettings } from '@/components/admin/InvestigationSettings';
import { SearchEngines } from '@/components/admin/SearchEngines';
import { engineKeyStatus } from '@/lib/ai/search';
import { monthlyFreshAnalyses } from '@/lib/admin/metrics';

export default async function InvestigationPage() {
  const locale = await getLocale();
  await requireAdmin(locale);
  const t = await getTranslations('admin.investigation');
  const [{ config }, catalog, monthly] = await Promise.all([getActiveConfig(), getCatalog(), monthlyFreshAnalyses()]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className="max-w-3xl muted">{t('intro')}</p>
      <EditorWithCost initial={config} catalog={catalog} monthlyAnalyses={monthly}>
        <div className="mb-4">
          {/* Only whether each key is set reaches the page, never the key itself. */}
          <SearchEngines keyStatus={engineKeyStatus()} />
        </div>
        <InvestigationSettings catalog={catalog} />
      </EditorWithCost>
    </div>
  );
}
