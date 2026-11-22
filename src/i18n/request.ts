import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';
import { loadMessages } from './messages';
import type { Locale } from './languages';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = (hasLocale(routing.locales, requested) ? requested : routing.defaultLocale) as Locale;
  return {
    locale,
    messages: await loadMessages(locale),
  };
});
