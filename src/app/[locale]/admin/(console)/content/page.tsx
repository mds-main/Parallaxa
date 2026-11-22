import { getLocale, getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/admin/auth';
import { getActiveConfig } from '@/lib/config/store';
import { ConfigEditor } from '@/components/admin/ConfigEditor';
import { SectionFields } from '@/components/admin/FieldInput';
import { LanguagesToggle, QuizManager } from '@/components/admin/ContentExtras';
import { getDb } from '@/lib/db/client';
import { quizItems } from '@/lib/db/schema';
import { getTopics } from '@/lib/queries';

export default async function ContentPage() {
  const locale = await getLocale();
  await requireAdmin(locale);
  const t = await getTranslations('admin.content');
  const { config } = await getActiveConfig();
  const db = await getDb();
  const items = await db.select().from(quizItems);
  const topics = await getTopics();
  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className="muted">{t('intro')}</p>
      <QuizManager items={items} topics={topics.filter((x) => !x.parentId)} />
      <ConfigEditor initial={config}>
        <div className="space-y-6">
          <LanguagesToggle />
          <SectionFields section="content" />
        </div>
      </ConfigEditor>
    </div>
  );
}
