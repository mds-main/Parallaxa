import type { Grade } from '@/lib/domain/types';

/** Grades use shape + label + monochrome intensity, never colour alone (PRD 3.3, WCAG 1.4.1). */
const SHAPES: Record<Grade, React.ReactNode> = {
  well_supported: <circle cx="10" cy="10" r="7" fill="currentColor" />,
  mostly_supported: <path d="M10 3a7 7 0 1 1-7 7h7z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />,
  missing_context: (
    <>
      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M10 3a7 7 0 0 1 0 14z" fill="currentColor" />
    </>
  ),
  mixed: <path d="M10 2.5 17.5 10 10 17.5 2.5 10z" fill="none" stroke="currentColor" strokeWidth="2" />,
  mostly_unsupported: (
    <>
      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M5 15 15 5" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  contradicted: (
    <>
      <rect x="3" y="3" width="14" height="14" rx="2" fill="currentColor" />
      <path d="m6.5 6.5 7 7m0-7-7 7" stroke="var(--card)" strokeWidth="2" />
    </>
  ),
  not_checkable: (
    <>
      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2.5" />
      <text x="10" y="13.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="currentColor">?</text>
    </>
  ),
};

export function GradeIcon({ grade, size = 20 }: { grade: Grade; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {SHAPES[grade]}
    </svg>
  );
}

export function VerdictChip({ grade, label, large = false }: { grade: Grade; label: string; large?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-line bg-paper-2 font-semibold ${large ? 'px-4 py-2 text-lg' : 'px-3 py-1 text-sm'}`}
      data-grade={grade}
    >
      <GradeIcon grade={grade} size={large ? 24 : 18} />
      <span>{label}</span>
    </span>
  );
}
