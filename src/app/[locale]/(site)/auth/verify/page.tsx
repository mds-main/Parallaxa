import { setRequestLocale } from 'next-intl/server';
import { VerifySignIn } from '@/components/VerifySignIn';

export const metadata = { robots: { index: false } };

export default async function VerifyPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  return <VerifySignIn token={token ?? ''} />;
}
