import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

const ICONS: Record<string, React.ReactNode> = {
  check: <path d="M4 12.5 9 17.5 20 6.5" fill="none" stroke="currentColor" strokeWidth="2" />,
  today: (
    <>
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  ledger: <path d="M5 4h11l3 3v13H5zM8 10h8M8 14h8M8 18h5" fill="none" stroke="currentColor" strokeWidth="2" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="19" cy="12" r="1.8" fill="currentColor" />
    </>
  ),
};

/** Mobile bottom navigation (PRD 8.3): Check · Today · Ledger · More. */
export async function BottomNav() {
  const t = await getTranslations('common.nav');
  const items = [
    ['/', 'check'],
    ['/today', 'today'],
    ['/ledger', 'ledger'],
    ['/more', 'more'],
  ] as const;
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {items.map(([href, key]) => (
          <li key={key}>
            <Link href={href} className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium no-underline">
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                {ICONS[key]}
              </svg>
              {t(key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
