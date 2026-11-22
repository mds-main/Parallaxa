import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/admin/LoginForm';
import { getAdminSession, adminConfigured } from '@/lib/admin/auth';
import { getTranslations } from 'next-intl/server';
import { prefixFor, type Locale } from '@/i18n/languages';

export const metadata = { robots: { index: false, follow: false }, title: 'Admin' };

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (await getAdminSession()) redirect(`/${prefixFor(locale as Locale)}/admin`);
  const t = await getTranslations('admin.login');
  return (
    <main className="min-h-dvh px-4">
      {!adminConfigured() && <p role="alert" className="mx-auto mt-8 max-w-lg rounded-lg border-2 border-ink p-4 text-sm">{t('disabled')}</p>}
      <LoginForm />
    </main>
  );
}
