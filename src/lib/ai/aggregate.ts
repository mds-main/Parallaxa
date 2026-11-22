/**
 * Verdict aggregation by a published rule, never by another model (PRD F1 stage 6, TODO 3.14, 12.8b).
 */
import { GRADE_SCALE, type AggregateResult, type Confidence, type Grade, type SlotVerdict } from '../domain/types';

export type AggregationSettings = {
  aggregationRule: 'median' | 'majority' | 'unanimous';
  disagreementSteps: number;
  humanReviewOnDisagreement: boolean;
};

const SCALE_TO_GRADE = Object.fromEntries(Object.entries(GRADE_SCALE).map(([g, v]) => [v, g])) as Record<number, Grade>;
const CONF_VALUE: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
const VALUE_CONF: Confidence[] = ['low', 'medium', 'high'];
const MIXED = GRADE_SCALE.mixed;

function medianValue(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  if (v.length % 2 === 1) return v[mid]!;
  // Even count: of the two middle grades, take the one closer to "mixed" (the more cautious one).
  const a = v[mid - 1]!;
  const b = v[mid]!;
  return Math.abs(a - MIXED) <= Math.abs(b - MIXED) ? a : b;
}

export function aggregateVerdicts(verdicts: SlotVerdict[], settings: AggregationSettings): AggregateResult {
  const excluded: AggregateResult['excluded'] = [];
  const counted: SlotVerdict[] = [];
  for (const v of verdicts) {
    if (v.abstained || v.grade === null) excluded.push({ slot: v.slot, reason: 'abstained' });
    else if (v.coiExcluded) excluded.push({ slot: v.slot, reason: 'coi' });
    else if (v.grade === 'not_checkable') excluded.push({ slot: v.slot, reason: 'not_checkable' });
    else counted.push(v);
  }
  const notCheckable = excluded.filter((e) => e.reason === 'not_checkable').length;

  if (counted.length === 0 || (counted.length < 2 && notCheckable >= 2)) {
    return { grade: 'not_checkable', confidence: 'low', disagreement: false, needsHumanReview: counted.length > 0, counted: counted.map((v) => v.slot), excluded, spread: 0 };
  }

  const values = counted.map((v) => GRADE_SCALE[v.grade as Exclude<Grade, 'not_checkable'>]);
  const spread = Math.max(...values) - Math.min(...values);

  let value: number;
  if (settings.aggregationRule === 'unanimous') {
    value = spread === 0 ? values[0]! : MIXED;
  } else if (settings.aggregationRule === 'majority') {
    const counts = new Map<number, number>();
    for (const x of values) counts.set(x, (counts.get(x) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    value = top.length > 1 && top[0]![1] === top[1]![1] ? medianValue(values) : top[0]![0];
  } else {
    value = medianValue(values);
  }

  const supportedVsContradicted = values.some((x) => x >= GRADE_SCALE.mostly_supported) && values.some((x) => x <= GRADE_SCALE.mostly_unsupported);
  const disagreement = spread >= settings.disagreementSteps || supportedVsContradicted;

  const confValues = counted.map((v) => CONF_VALUE[v.confidence ?? 'low']).sort((a, b) => a - b);
  let conf = confValues[Math.floor((confValues.length - 1) / 2)]!;
  if (spread >= 1) conf = Math.min(conf, 1);
  if (disagreement) conf = 0;
  if (counted.length < 2) conf = 0;

  return {
    grade: SCALE_TO_GRADE[value]!,
    confidence: VALUE_CONF[conf]!,
    disagreement,
    needsHumanReview: (disagreement && settings.humanReviewOnDisagreement) || counted.length < 2,
    counted: counted.map((v) => v.slot),
    excluded,
    spread,
  };
}

/** True when the claim touches one of the slot's conflict-of-interest topics (case-insensitive keyword match). */
export function isConflictOfInterest(text: string, coiTopics: string[]): boolean {
  const hay = ` ${text.toLowerCase()} `;
  return coiTopics.some((t) => {
    const k = t.toLowerCase().trim();
    if (!k) return false;
    return new RegExp(`(^|[^\\p{L}\\p{N}])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}\\p{N}]|$)`, 'u').test(hay);
  });
}
