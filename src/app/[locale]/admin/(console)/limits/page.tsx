import { getLocale, getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/admin/auth';
import { getActiveConfig } from '@/lib/config/store';
import { ConfigEditor } from '@/components/admin/ConfigEditor';
import { SectionFields } from '@/components/admin/FieldInput';
import { LimitsExtras } from '@/components/admin/LimitsExtras';

export default async function LimitsPage() {
  const locale = await getLocale();
  await requireAdmin(locale);
  const t = await getTranslations('admin.limits');
  const { config } = await getActiveConfig();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className="max-w-3xl muted">{t('intro')}</p>
      <ConfigEditor initial={config}>
        <div className="space-y-6">
          <LimitsExtras />
          <SectionFields section="limits" />
        </div>
      </ConfigEditor>
    </div>
  );
}
