'use client';
import { useLocale, useTranslations } from 'next-intl';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';

type Series = {
  checks: { d: string; total: number; failed: number }[];
  spend: { d: string; usd: number; fallback: number }[];
  byStep: { step: string; usd: number }[];
  usage: { d: string; event: string; n: number }[];
  languages: { lang: string | null; n: number }[];
  grades: { grade: string | null; n: number }[];
  evals: { at: string; kind: string; accuracy?: number | null; calibrationError?: number | null; parity?: number | null; languageParity?: number | null }[];
};

const INK = 'var(--ink)';
const ACCENT = 'var(--accent)';
const MUTED = 'var(--ink-3)';

function Card({ title, children, table }: { title: string; children: React.ReactNode; table: (string | number)[][] }) {
  return (
    <figure className="card p-4">
      <figcaption className="mb-2 font-semibold">{title}</figcaption>
      <div className="h-56" aria-hidden="true">{children}</div>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer">Data</summary>
        <table className="mt-1 w-full">
          <tbody>{table.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="pr-3">{c}</td>)}</tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}

export function MetricsCharts({ series }: { series: Series }) {
  const t = useTranslations('admin.metrics.labels');
  const tc = useTranslations('common.grades');
  const locale = useLocale();
  const usageBy = (event: string) => series.usage.filter((u) => u.event === event).map((u) => ({ d: u.d, n: u.n }));
  const fmtUsd = (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={t('checks')} table={series.checks.map((c) => [c.d, c.total, c.failed])}>
        <ResponsiveContainer><BarChart data={series.checks}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="d" fontSize={11} stroke={MUTED} /><YAxis fontSize={11} stroke={MUTED} allowDecimals={false} /><Tooltip /><Legend /><Bar dataKey="total" name={t('checks')} fill={INK} /><Bar dataKey="failed" name={t('failures')} fill={ACCENT} /></BarChart></ResponsiveContainer>
      </Card>
      <Card title={t('costByDay')} table={series.spend.map((s) => [s.d, fmtUsd(s.usd), s.fallback])}>
        <ResponsiveContainer><LineChart data={series.spend}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="d" fontSize={11} stroke={MUTED} /><YAxis fontSize={11} stroke={MUTED} /><Tooltip formatter={(v) => fmtUsd(Number(v))} /><Line dataKey="usd" name="USD" stroke={ACCENT} strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
      </Card>
      <Card title={t('costByStep')} table={series.byStep.map((s) => [s.step, fmtUsd(s.usd)])}>
        <ResponsiveContainer><BarChart data={series.byStep} layout="vertical"><XAxis type="number" fontSize={11} stroke={MUTED} /><YAxis type="category" dataKey="step" width={90} fontSize={11} stroke={MUTED} /><Tooltip formatter={(v) => fmtUsd(Number(v))} /><Bar dataKey="usd" fill={INK} /></BarChart></ResponsiveContainer>
      </Card>
      <Card title={t('gradeBySide')} table={series.grades.map((g) => [g.grade ? tc(g.grade) : '—', g.n])}>
        <ResponsiveContainer><BarChart data={series.grades.map((g) => ({ ...g, label: g.grade ? tc(g.grade) : '—' }))}><XAxis dataKey="label" fontSize={10} stroke={MUTED} interval={0} angle={-20} textAnchor="end" height={60} /><YAxis fontSize={11} stroke={MUTED} allowDecimals={false} /><Tooltip /><Bar dataKey="n" fill={INK} /></BarChart></ResponsiveContainer>
      </Card>
      <Card title={t('accuracy')} table={series.evals.map((e) => [e.at, e.kind, e.accuracy ?? '—', e.parity ?? '—', e.languageParity ?? '—'])}>
        <ResponsiveContainer><LineChart data={series.evals}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="at" fontSize={11} stroke={MUTED} /><YAxis domain={[0, 1]} fontSize={11} stroke={MUTED} /><Tooltip /><Legend /><Line dataKey="accuracy" name={t('accuracy')} stroke={INK} strokeWidth={2} /><Line dataKey="parity" name={t('parity')} stroke={ACCENT} strokeWidth={2} /><Line dataKey="languageParity" name="lang" stroke={MUTED} strokeDasharray="4 3" /></LineChart></ResponsiveContainer>
      </Card>
      <Card title={`${t('briefings')} · ${t('quiz')}`} table={[...usageBy('briefing_opened').map((u) => ['briefing', u.d, u.n]), ...usageBy('quiz_answered').map((u) => ['quiz', u.d, u.n])]}>
        <ResponsiveContainer><LineChart><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="d" fontSize={11} stroke={MUTED} allowDuplicatedCategory={false} /><YAxis fontSize={11} stroke={MUTED} allowDecimals={false} /><Tooltip /><Legend /><Line data={usageBy('briefing_opened')} dataKey="n" name={t('briefings')} stroke={INK} /><Line data={usageBy('quiz_answered')} dataKey="n" name={t('quiz')} stroke={ACCENT} /></LineChart></ResponsiveContainer>
      </Card>
      <Card title={t('languages')} table={series.languages.map((l) => [l.lang ?? '—', l.n])}>
        <ResponsiveContainer><BarChart data={series.languages.map((l) => ({ lang: l.lang ?? '—', n: l.n }))}><XAxis dataKey="lang" fontSize={11} stroke={MUTED} /><YAxis fontSize={11} stroke={MUTED} allowDecimals={false} /><Tooltip /><Bar dataKey="n" fill={ACCENT} /></BarChart></ResponsiveContainer>
      </Card>
    </div>
  );
}
