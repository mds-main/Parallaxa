import { describe, expect, it } from 'vitest';
import { assembleBriefing, type EditionStory } from './assemble';
import { defaultPreferences } from '../prefs/types';

const story = (id: string, place: string, topic: string, salience: number): EditionStory => ({
  analysisId: id, editionPlaceId: place, rank: 1, topicId: topic, salience, placeIds: [place], headline: { en: id }, grade: 'mixed',
});
const editions = [
  { placeId: 'GLOBAL', stories: [story('g1', 'GLOBAL', 'foreign', 0.9), story('g2', 'GLOBAL', 'climate', 0.6)] },
  { placeId: 'ES', stories: [story('e1', 'ES', 'housing', 0.8), story('e2', 'ES', 'immigration', 0.7), story('e3', 'ES', 'economy', 0.5)] },
  { placeId: 'US', stories: [story('u1', 'US', 'elections', 0.95)] },
  { placeId: 'ES-AN', stories: [story('a1', 'ES-AN', 'health', 0.4)] },
];
const parent = (id: string) => (id.includes('-') ? id.split('-')[0]! : id === 'GLOBAL' ? null : 'GLOBAL');

describe('assembleBriefing', () => {
  it('never exceeds the story limit and keeps one outside-filters slot', () => {
    const prefs = defaultPreferences('ES');
    const r = assembleBriefing(editions, prefs, parent);
    expect(r.stories.length).toBeLessThanOrEqual(5);
    expect(r.stories.at(-1)!.reason.kind).toBe('outside');
    expect(r.stories.at(-1)!.analysisId).toBe('u1');
  });
  it('drops muted topics and boosts followed ones', () => {
    const prefs = { ...defaultPreferences('ES'), topics: { immigration: 'mute' as const, economy: 'follow' as const } };
    const r = assembleBriefing(editions, prefs, parent);
    const ids = r.stories.map((s) => s.analysisId);
    expect(ids).not.toContain('e2');
    expect(r.stories[0]!.analysisId).toBe('e3');
    expect(r.stories[0]!.reason.kind).toBe('topic');
  });
  it('falls back from a thin regional edition to its country and says so', () => {
    const prefs = { ...defaultPreferences('ES'), places: [{ id: 'ES-AN', mode: 'focus' as const, home: true }] };
    const r = assembleBriefing(editions, prefs, parent);
    expect(r.fallbackPlace).toBe('ES');
    expect(r.stories.map((s) => s.analysisId)).toContain('a1');
  });
  it('respects turning the outside slot off', () => {
    const prefs = { ...defaultPreferences('ES'), briefing: { ...defaultPreferences().briefing, outsideFilters: false, stories: 3 as const } };
    const r = assembleBriefing(editions, prefs, parent);
    expect(r.stories).toHaveLength(3);
    expect(r.stories.some((s) => s.reason.kind === 'outside')).toBe(false);
  });
});
