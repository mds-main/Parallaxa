'use client';
import { useLocale, useTranslations } from 'next-intl';
import { FIELDS, getPath, type FieldDescriptor } from '@/lib/config/fields';
import { defaultConfig } from '@/lib/config/schema';
import { useEditor } from './ConfigEditor';

/** Renders one setting from its descriptor: label, help, safe range, default and reset (TODO 22.7). */
export function FieldInput({ field }: { field: FieldDescriptor }) {
  const t = useTranslations('admin.common');
  const locale = useLocale() as 'en' | 'es-ES';
  const { draft, initial, update } = useEditor();
  const value = getPath(draft, field.path);
  const def = getPath(defaultConfig(), field.path);
  const changed = JSON.stringify(value) !== JSON.stringify(getPath(initial, field.path));
  const id = `f-${field.path}`;
  return (
    <div className={`rounded-xl border p-4 ${changed ? 'border-accent bg-accent/5' : 'border-line'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <label htmlFor={id} className="font-medium">{field.label[locale]}</label>
        {field.type === 'boolean' ? (
          <input id={id} type="checkbox" className="h-6 w-6" checked={Boolean(value)} onChange={(e) => update(field.path, e.target.checked)} />
        ) : field.type === 'select' ? (
          <select id={id} className="field !w-auto" value={String(value)} onChange={(e) => update(field.path, e.target.value)}>
            {field.options!.map((o) => <option key={o.value} value={o.value}>{o.label[locale]}</option>)}
          </select>
        ) : field.type === 'number' ? (
          <span className="flex items-center gap-2">
            <input
              id={id}
              type="number"
              className="field !w-32"
              min={field.min}
              max={field.max}
              step={field.step}
              value={Number(value)}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) update(field.path, Math.min(field.max ?? n, Math.max(field.min ?? n, n)));
              }}
            />
            {field.unit && <span className="text-sm muted">{field.unit}</span>}
          </span>
        ) : field.type === 'list' ? (
          <input id={id} className="field md:!w-96" value={(value as string[]).join(', ')} onChange={(e) => update(field.path, e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} />
        ) : (
          <input id={id} className="field md:!w-96" value={String(value ?? '')} onChange={(e) => update(field.path, e.target.value)} />
        )}
      </div>
      <p className="mt-1 text-sm muted">{field.help[locale]}</p>
      <p className="mt-1 flex flex-wrap gap-3 text-xs muted">
        {field.min !== undefined && <span>{t('range', { min: field.min, max: field.max ?? '' })}</span>}
        <span>{t('default', { value: Array.isArray(def) ? def.join(', ') : String(def) })}</span>
        {JSON.stringify(value) !== JSON.stringify(def) && (
          <button type="button" className="underline" onClick={() => update(field.path, def)}>{t('reset')}</button>
        )}
        {field.needsTest && <span>⚠ {t('needsTest')}</span>}
      </p>
    </div>
  );
}

export function SectionFields({ section }: { section: FieldDescriptor['section'] }) {
  return (
    <div className="space-y-3">
      {FIELDS.filter((f) => f.section === section).map((f) => <FieldInput key={f.path} field={f} />)}
    </div>
  );
}
