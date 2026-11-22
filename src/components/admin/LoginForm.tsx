'use client';
import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { loginAction } from '@/app/[locale]/admin/actions';

export function LoginForm() {
  const t = useTranslations('admin.login');
  const locale = useLocale();
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="card mx-auto mt-16 max-w-sm space-y-4 p-6">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <input type="hidden" name="locale" value={locale} />
      <label className="block">
        <span className="label">{t('username')}</span>
        <input name="username" className="field mt-1" autoComplete="username" required />
      </label>
      <label className="block">
        <span className="label">{t('password')}</span>
        <input name="password" type="password" className="field mt-1" autoComplete="current-password" required />
      </label>
      {state?.error && <p role="alert" className="text-sm font-medium">{t(state.error === 'locked' ? 'locked' : state.error === 'disabled' ? 'disabled' : 'invalid')}</p>}
      <button className="btn w-full" disabled={pending}>{t('submit')}</button>
    </form>
  );
}
