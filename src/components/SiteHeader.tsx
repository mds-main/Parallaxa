import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ScopeChip } from './ScopeChip';
import { BrandMark, Wordmark } from './BrandMark';
import { getPlaces } from '@/lib/queries';
import { getActiveConfig } from '@/lib/config/store';

export async function SiteHeader() {
  const t = await getTranslations('common');
  await getLocale();
  const places = await getPlaces();
  const { config } = await getActiveConfig();
  const disabled = Object.entries(config.content.languages).filter(([, on]) => on === false).map(([tag]) => tag);
  const placeNames = Object.fromEntries(places.map((p) => [p.id, p.names]));
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 whitespace-nowrap hyphens-none">
        <Link href="/" className="flex items-center gap-2 no-underline">
          <BrandMark height={28} id="plx-header" />
          <span className="font-serif text-xl font-semibold tracking-tight">
            <Wordmark name={t('appName')} />
          </span>
        </Link>
        <nav aria-label="Main" className="ml-4 hidden items-center gap-1 lg:flex">
          {(
            [
              ['/', 'check'],
              ['/today', 'today'],
              ['/ledger', 'ledger'],
              ['/quiz', 'quiz'],
              ['/trust', 'trust'],
            ] as const
          ).map(([href, key]) => (
            <Link key={href} href={href} className="rounded-full px-3 py-1.5 text-sm font-medium no-underline hover:bg-paper-2">
              {t(`nav.${key}`)}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ScopeChip placeNames={placeNames} />
          <Link href="/settings" className="hidden rounded-full px-3 py-1.5 text-sm no-underline hover:bg-paper-2 lg:inline">
            {t('nav.settings')}
          </Link>
          <div className="hidden sm:block">
            <LanguageSwitcher disabled={disabled} />
          </div>
        </div>
      </div>
    </header>
  );
}
