'use client';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useHistory } from '@/lib/prefs/hooks';

export function RecentChecks() {
  const t = useTranslations('home.recent');
  const items = useHistory();
  if (items === null) return null;
  return (
    <section aria-labelledby="recent-title" className="card p-5">
      <div className="flex items-center justify-between">
        <h2 id="recent-title" className="text-lg font-semibold">{t('title')}</h2>
        {items.length > 0 && (
          <button
            className="text-sm underline"
            onClick={() => {
              localStorage.removeItem('plx:history:v1');
              window.dispatchEvent(new Event('plx:history'));
            }}
          >
            {t('clear')}
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-sm muted">{t('empty')}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {items.slice(0, 8).map((i) => (
            <li key={i.id} className="py-2">
              <Link href={`/a/${i.id}`} className="line-clamp-2">
                {i.excerpt}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
