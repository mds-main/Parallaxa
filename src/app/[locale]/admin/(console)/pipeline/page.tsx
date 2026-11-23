import { getLocale, getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/admin/auth';
import { getActiveConfig } from '@/lib/config/store';
import { ConfigEditor } from '@/components/admin/ConfigEditor';
import { SectionFields } from '@/components/admin/FieldInput';

export default async function PipelinePage() {
  const locale = await getLocale();
  await requireAdmin(locale);
  const t = await getTranslations('admin.pipeline');
  const { config } = await getActiveConfig();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className="max-w-3xl muted">{t('intro')}</p>
      <p className="text-sm">{t('promptVersion')}: <code>{config.pipeline.promptVersion}</code></p>
      <ConfigEditor initial={config}>
        <SectionFields section="pipeline" />
      </ConfigEditor>
    </div>
  );
}
