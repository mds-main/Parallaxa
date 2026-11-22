import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('errors');
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <p className="font-serif text-2xl">{t('notFound')}</p>
      <Link href="/" className="btn mt-6 no-underline">{t('home')}</Link>
    </div>
  );
}
