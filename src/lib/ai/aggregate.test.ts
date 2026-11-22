import { describe, expect, it } from 'vitest';
import { aggregateVerdicts, isConflictOfInterest } from './aggregate';
import type { Grade, SlotVerdict } from '../domain/types';

const S = { aggregationRule: 'median' as const, disagreementSteps: 2, humanReviewOnDisagreement: true };
const v = (slot: string, grade: Grade | null, extra: Partial<SlotVerdict> = {}): SlotVerdict => ({
  slot, model: 'm', provider: 'demo', grade, confidence: 'high', abstained: grade === null, coiExcluded: false,
  reasoning: '', sources: [], toolCalls: 0, searches: { web: 0, x: 0, scrape: 0 }, costUsd: 0, latencyMs: 0, ...extra,
});

describe('aggregateVerdicts', () => {
  it('takes the median and keeps high confidence on agreement', () => {
    const r = aggregateVerdicts([v('A', 'well_supported'), v('B', 'well_supported'), v('C', 'well_supported')], S);
    expect(r).toMatchObject({ grade: 'well_supported', confidence: 'high', disagreement: false, needsHumanReview: false });
  });
  it('lowers confidence when verdicts spread by one step', () => {
    const r = aggregateVerdicts([v('A', 'well_supported'), v('B', 'mostly_supported'), v('C', 'mostly_supported')], S);
    expect(r).toMatchObject({ grade: 'mostly_supported', confidence: 'medium', disagreement: false });
  });
  it('flags disagreement at the threshold and sends it to review', () => {
    const r = aggregateVerdicts([v('A', 'well_supported'), v('B', 'mixed'), v('C', 'mostly_supported')], S);
    expect(r).toMatchObject({ grade: 'mostly_supported', disagreement: true, needsHumanReview: true, confidence: 'low' });
  });
  it('flags a supported-vs-contradicted split even with a large threshold', () => {
    const r = aggregateVerdicts([v('A', 'mostly_supported'), v('B', 'mostly_unsupported'), v('C', 'mixed')], { ...S, disagreementSteps: 5 });
    expect(r.disagreement).toBe(true);
  });
  it('excludes abstentions and conflict-of-interest votes; fewer than 2 → human review', () => {
    const r = aggregateVerdicts([v('A', 'contradicted'), v('B', null), v('C', 'well_supported', { coiExcluded: true })], S);
    expect(r.counted).toEqual(['A']);
    expect(r.excluded.map((e) => e.reason)).toEqual(['abstained', 'coi']);
    expect(r.needsHumanReview).toBe(true);
    expect(r.confidence).toBe('low');
  });
  it('returns not checkable when most slots say so', () => {
    const r = aggregateVerdicts([v('A', 'not_checkable'), v('B', 'not_checkable'), v('C', 'mixed')], S);
    expect(r.grade).toBe('not_checkable');
  });
  it('even count takes the more cautious middle grade', () => {
    const r = aggregateVerdicts([v('A', 'well_supported'), v('B', 'mostly_supported'), v('C', 'missing_context'), v('D', 'contradicted')], { ...S, disagreementSteps: 9 });
    expect(r.grade).toBe('missing_context');
  });
  it('unanimous rule falls back to mixed', () => {
    const r = aggregateVerdicts([v('A', 'well_supported'), v('B', 'mostly_supported'), v('C', 'well_supported')], { ...S, aggregationRule: 'unanimous' });
    expect(r.grade).toBe('mixed');
  });
});

describe('isConflictOfInterest', () => {
  it('matches whole words, case-insensitively', () => {
    expect(isConflictOfInterest('Elon Musk said Tesla sales rose', ['Tesla'])).toBe(true);
    expect(isConflictOfInterest('Taiwan exports rose', ['Taiwan'])).toBe(true);
    expect(isConflictOfInterest('Teslaville is a town', ['Tesla'])).toBe(false);
    expect(isConflictOfInterest('Nothing related', ['China'])).toBe(false);
  });
});
