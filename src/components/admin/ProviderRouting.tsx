'use client';
import { useEffect } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEditor } from './ConfigEditor';
import { gatewayModelFor } from '@/lib/ai/routing';
import type { ProviderId, RoutingConfig } from '@/lib/config/schema';
import type { ProviderUsage } from '@/lib/admin/metrics';

const MODES = [
  { id: 'veniceBackup', routing: { primary: 'venice', fallback: true } },
  { id: 'gatewayBackup', routing: { primary: 'gateway', fallback: true } },
  { id: 'veniceOnly', routing: { primary: 'venice', fallback: false } },
  { id: 'gatewayOnly', routing: { primary: 'gateway', fallback: false } },
] as const satisfies readonly { id: string; routing: RoutingConfig }[];

const NAME: Record<ProviderId, string> = { venice: 'Venice', gateway: 'AI Gateway' };
const other = (p: ProviderId): ProviderId => (p === 'venice' ? 'gateway' : 'venice');

function Flow({ routing }: { routing: RoutingConfig }) {
  return (
    <span className="flex flex-wrap items-center gap-1 text-xs" aria-hidden="true">
      <span className="chip font-semibold">{NAME[routing.primary]}</span>
      {routing.fallback ? (
        <>
          <span>→</span>
          <span className="chip border-dashed">{NAME[other(routing.primary)]}</span>
        </>
      ) : (
        <span className="muted">· —</span>
      )}
    </span>
  );
}

/** Admin › Models › AI vendors: choose which vendor serves model calls first and whether the other one backs it up. */
export function ProviderRouting({ keys, usage, gatewayIds }: { keys: Record<ProviderId, boolean>; usage: ProviderUsage; gatewayIds: string[] | null }) {
  const t = useTranslations('admin.models.routing');
  const format = useFormatter();
  const { draft, initial, update, setBlocker } = useEditor();
  const current = draft.routing;
  const mode = MODES.find((m) => m.routing.primary === current.primary && m.routing.fallback === current.fallback)!;
  const changed = current.primary !== initial.routing.primary || current.fallback !== initial.routing.fallback;

  // Without a Venice key the whole app runs in demo mode, so only a Gateway primary without its key is a real problem.
  const gatewayKeyMissing = current.primary === 'gateway' && !keys.gateway;
  useEffect(() => {
    setBlocker('routing', changed && gatewayKeyMissing ? t('blockMissingKey', { vendor: NAME.gateway, env: 'AI_GATEWAY_API_KEY' }) : null);
  }, [changed, gatewayKeyMissing, setBlocker, t]);

  const choose = (r: RoutingConfig) => {
    if (r.primary !== current.primary) update('routing.primary', r.primary);
    if (r.fallback !== current.fallback) update('routing.fallback', r.fallback);
  };

  // Calls that will still go to Venice when the Gateway is primary: models with no Gateway equivalent.
  const veniceOnly = [
    ...draft.slots.filter((s) => s.enabled && !gatewayModelFor(s.model, s.fallbackModel, gatewayIds)).map((s) => `${s.id} (${s.model})`),
    ...Object.entries(draft.roles)
      .filter(([role, model]) => role !== 'embedding' && model !== 'rotate' && !gatewayModelFor(model, undefined, gatewayIds))
      .map(([role, model]) => `${role} (${model})`),
  ];
  const usesGateway = current.primary === 'gateway' || current.fallback;
  const n = (v: number) => format.number(v);

  return (
    <section className="card space-y-4 p-4" aria-labelledby="routing-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="routing-title" className="text-lg font-semibold">{t('title')}</h2>
        <p className="text-sm">
          <span className="muted">{t('live')}: </span>
          <strong>{t(`modes.${MODES.find((m) => m.routing.primary === initial.routing.primary && m.routing.fallback === initial.routing.fallback)!.id}.label`)}</strong>
        </p>
      </div>
      <p className="max-w-3xl text-sm muted">{t('intro')}</p>

      <fieldset>
        <legend className="sr-only">{t('title')}</legend>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {MODES.map((m) => {
            const selected = m.id === mode.id;
            return (
              <label key={m.id} className={`flex cursor-pointer flex-col gap-2 rounded-xl p-3 ${selected ? 'border-2 border-ink bg-paper-2' : 'border border-line'}`}>
                <span className="flex items-start gap-2">
                  <input type="radio" name="vendor-routing" className="mt-1 h-5 w-5" checked={selected} onChange={() => choose(m.routing)} aria-labelledby={`routing-${m.id}`} aria-describedby={`routing-${m.id}-help`} />
                  <span id={`routing-${m.id}`} className="font-semibold leading-snug">{t(`modes.${m.id}.label`)}</span>
                </span>
                <Flow routing={m.routing} />
                <span id={`routing-${m.id}-help`} className="text-sm muted">{t(`modes.${m.id}.help`)}</span>
                {m.id === 'veniceBackup' && <span className="chip self-start text-xs">{t('recommended')}</span>}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => choose({ primary: other(current.primary), fallback: current.fallback })}>
          ⇄ {t('swap', { vendor: NAME[other(current.primary)] })}
        </button>
        {changed && <span className="text-sm font-medium">{t('pendingHint')}</span>}
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {(['venice', 'gateway'] as const).map((p) => {
          const u = usage[p];
          const role = current.primary === p ? t('rolePrimary') : current.fallback ? t('roleBackup') : t('roleUnused');
          return (
            <li key={p} className={`rounded-xl p-3 ${keys[p] ? 'bg-paper-2' : 'border-2 border-ink'}`}>
              <p className="flex flex-wrap items-center justify-between gap-2">
                <strong>{p === 'venice' ? 'Venice' : 'Vercel AI Gateway'}</strong>
                <span className="chip text-xs">{role}</span>
              </p>
              <p className="mt-1 text-sm">{keys[p] ? `✓ ${t('keySet')}` : `✗ ${t('keyMissing', { env: p === 'venice' ? 'VENICE_API_KEY' : 'AI_GATEWAY_API_KEY' })}`}</p>
              <p className="text-sm muted">{t('usage', { hours: usage.hours, served: n(u.served), failed: n(u.failed), backup: n(u.asBackup) })}</p>
            </li>
          );
        })}
      </ul>

      <ul className="space-y-1 text-sm">
        <li>🔒 {t('privacyNote')}</li>
        <li>{t('embeddingsNote')}</li>
        {usesGateway && <li>{t('gatewaySearchNote')}</li>}
        {current.fallback && !keys[other(current.primary)] && <li className="font-medium">⚠ {t('noBackupKey', { vendor: NAME[other(current.primary)] })}</li>}
        {current.primary === 'gateway' && veniceOnly.length > 0 && <li className="font-medium">⚠ {t('noEquivalent', { list: veniceOnly.join(', ') })}</li>}
      </ul>
    </section>
  );
}
