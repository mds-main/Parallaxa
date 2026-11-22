'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { linkClaimAction, publishActorAction, publishReplyAction, saveActorAction, saveDimensionAction } from '@/app/[locale]/admin/actions';

type Actor = { id: string; slug: string; name: string; type: string; country: string; published: boolean; claims: number; publicRole: Record<string, string> | null };
const TYPES = ['politician', 'party', 'government', 'public_figure', 'influencer', 'company', 'entrepreneur', 'media'];
const DIMENSIONS = ['correction_behaviour', 'data_integrity', 'prediction_calibration', 'integrity_record', 'influence_operations', 'civility'];

function ActorRow({ a }: { a: Actor }) {
  const t = useTranslations('admin.ledger');
  const tl = useTranslations('ledger');
  const locale = useLocale();
  const router = useRouter();
  const [ref, setRef] = useState('');
  const [reach, setReach] = useState(1);
  const [legal, setLegal] = useState(false);
  const [dim, setDim] = useState(DIMENSIONS[0]!);
  const [n, setN] = useState(0);
  const [conf, setConf] = useState('low');
  const [reply, setReply] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      setMsg('✓');
      router.refresh();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  return (
    <li className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{a.name}</span>
        <span className="chip">{tl(`types.${a.type}`)}</span>
        <span className="chip">{a.country}</span>
        <span className="chip">{a.published ? t('published') : t('draft')}</span>
        <span className="text-sm muted">{t('claims', { n: a.claims })} · {a.publicRole?.[locale] ?? ''}</span>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 text-sm">{t('link')}<input className="field mt-1 !min-h-9" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="/en/a/…" /></label>
        <label className="w-28 text-sm">{t('reach')}<input type="number" min={1} className="field mt-1 !min-h-9" value={reach} onChange={(e) => setReach(Number(e.target.value))} /></label>
        <button className="btn !min-h-9 !py-1 text-sm" onClick={() => run(() => linkClaimAction(a.id, ref, reach).then(() => setRef('')))}>{t('link')}</button>
      </div>
      <p className="text-xs muted">{t('linkHelp')}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">{t('dimension')}<select className="field mt-1 !min-h-9" value={dim} onChange={(e) => setDim(e.target.value)}>{DIMENSIONS.map((d) => <option key={d} value={d}>{tl(`dimensions.${d}`)}</option>)}</select></label>
        <label className="w-20 text-sm">n<input type="number" min={0} className="field mt-1 !min-h-9" value={n} onChange={(e) => setN(Number(e.target.value))} /></label>
        <label className="text-sm">conf.<select className="field mt-1 !min-h-9" value={conf} onChange={(e) => setConf(e.target.value)}>{['low', 'medium', 'high'].map((c) => <option key={c}>{c}</option>)}</select></label>
        <button className="btn btn-ghost !min-h-9 !py-1 text-sm" onClick={() => run(() => saveDimensionAction(a.id, dim, n, conf, null))}>{t('saveDimension')}</button>
      </div>
      <label className="block text-sm">{t('reply')}<textarea className="field mt-1 min-h-20" value={reply} onChange={(e) => setReply(e.target.value)} /></label>
      <p className="text-xs muted">{t('replyHelp')}</p>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-ghost !min-h-9 !py-1 text-sm" disabled={!reply.trim()} onClick={() => run(() => publishReplyAction(a.id, reply, '').then(() => setReply('')))}>{t('reply')}</button>
        {!a.published && (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={legal} onChange={(e) => setLegal(e.target.checked)} /> {t('legalConfirm')}</label>
        )}
        <button className="btn !min-h-9 !py-1 text-sm" disabled={!a.published && !legal} onClick={() => run(() => publishActorAction(a.id, !a.published, legal))}>{a.published ? t('unpublish') : t('publish')}</button>
        {msg && <span role="status" className="text-sm">{msg}</span>}
      </div>
    </li>
  );
}

export function LedgerManager({ actors }: { actors: Actor[] }) {
  const t = useTranslations('admin.ledger');
  const tl = useTranslations('ledger');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const f = (k: string) => t(`fields.${k}`);
  return (
    <div className="space-y-6">
      <details className="card p-4">
        <summary className="cursor-pointer font-semibold">+ {t('add')}</summary>
        <form
          className="mt-3 grid gap-3 md:grid-cols-2"
          action={async (form) => {
            const r = await saveActorAction(form);
            if (r.ok) router.refresh();
            else setError(r.error ?? 'Error');
          }}
        >
          <label className="text-sm">{f('name')}<input name="name" className="field mt-1" required /></label>
          <label className="text-sm">{f('slug')}<input name="slug" className="field mt-1" required /></label>
          <label className="text-sm">{f('type')}<select name="type" className="field mt-1">{TYPES.map((x) => <option key={x} value={x}>{tl(`types.${x}`)}</option>)}</select></label>
          <label className="text-sm">{f('country')}<input name="country" className="field mt-1" required maxLength={2} /></label>
          <label className="text-sm">{f('homePlaceId')}<input name="homePlaceId" className="field mt-1" /></label>
          <label className="text-sm">{f('partyFamily')}<input name="partyFamily" className="field mt-1" /></label>
          <label className="text-sm">{f('roleEn')}<input name="roleEn" className="field mt-1" /></label>
          <label className="text-sm">{f('roleEs')}<input name="roleEs" className="field mt-1" /></label>
          {error && <p role="alert" className="text-sm md:col-span-2">{error}</p>}
          <button className="btn md:col-span-2">{t('save')}</button>
        </form>
      </details>
      {actors.length === 0 ? <p className="card p-6">{t('empty')}</p> : <ul className="space-y-4">{actors.map((a) => <ActorRow key={a.id} a={a} />)}</ul>}
    </div>
  );
}
