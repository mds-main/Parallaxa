'use client';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { revertAuditAction } from '@/app/[locale]/admin/actions';

/** Reverting a configuration change re-activates the configuration it replaced. */
export function AuditRevert({ auditId }: { auditId: number }) {
  const t = useTranslations('admin.audit');
  const router = useRouter();
  return (
    <button
      className="underline"
      onClick={async () => {
        const reason = window.prompt(t('reason'));
        if (!reason) return;
        const res = await revertAuditAction(auditId, reason);
        if (!res.ok) window.alert(res.problems.join('\n'));
        router.refresh();
      }}
    >
      {t('revert')}
    </button>
  );
}
