/**
 * Deterministic personal briefing assembly (PRD F2): no model call, no per-user AI output.
 * Runs in the browser for anonymous users (preferences never leave the device) and on the server for push.
 */
import type { Preferences } from '../prefs/types';

export type EditionStory = {
  analysisId: string;
  editionPlaceId: string;
  rank: number;
  topicId: string;
  salience: number;
  placeIds: string[];
  headline: Record<string, string>;
  grade: string;
  perceptionFact?: Record<string, string>;
};

export type AssembledStory = EditionStory & { reason: { kind: 'place' | 'topic' | 'outside' | 'default'; placeId?: string; topicId?: string } };

export type AssembleResult = { stories: AssembledStory[]; fallbackPlace?: string };

const topicRoot = (id: string) => id.split('.')[0]!;

export function assembleBriefing(
  editions: { placeId: string; stories: EditionStory[] }[],
  prefs: Pick<Preferences, 'places' | 'global' | 'topics' | 'briefing'>,
  parentOf: (placeId: string) => string | null,
): AssembleResult {
  const max = prefs.briefing.stories;
  const byPlace = new Map(editions.map((e) => [e.placeId, e.stories]));
  const focus = prefs.places.filter((p) => p.mode === 'focus');
  const selected = (focus.length ? focus : prefs.places).map((p) => p.id);
  const wanted = new Set(selected);
  if (prefs.global && !focus.length) wanted.add('GLOBAL');

  const muted = (topic: string) => prefs.topics[topic] === 'mute' || prefs.topics[topicRoot(topic)] === 'mute';
  const followed = (topic: string) => prefs.topics[topic] === 'follow' || prefs.topics[topicRoot(topic)] === 'follow';

  // Region → country → Global fallback, disclosed when used (PRD F2).
  let fallbackPlace: string | undefined;
  const pools: EditionStory[] = [];
  for (const placeId of wanted) {
    const own = byPlace.get(placeId) ?? [];
    if (own.length >= 2 || placeId === 'GLOBAL') pools.push(...own);
    else {
      pools.push(...own);
      const parent = parentOf(placeId);
      if (parent && byPlace.get(parent)?.length) {
        pools.push(...byPlace.get(parent)!);
        fallbackPlace = parent;
      }
    }
  }

  const seen = new Set<string>();
  const candidates = pools
    .filter((s) => !muted(s.topicId))
    .filter((s) => (seen.has(s.analysisId) ? false : (seen.add(s.analysisId), true)))
    .map((s) => ({ s, score: s.salience + (followed(s.topicId) ? 1 : 0) + (wanted.has(s.editionPlaceId) && s.editionPlaceId !== 'GLOBAL' ? 0.25 : 0) }))
    .sort((a, b) => b.score - a.score || a.s.rank - b.s.rank);

  const slots = prefs.briefing.outsideFilters ? max - 1 : max;
  const picked: AssembledStory[] = candidates.slice(0, slots).map(({ s }) => ({
    ...s,
    reason: followed(s.topicId)
      ? { kind: 'topic', topicId: s.topicId }
      : wanted.has(s.editionPlaceId) && s.editionPlaceId !== 'GLOBAL'
        ? { kind: 'place', placeId: s.editionPlaceId }
        : { kind: 'default', placeId: s.editionPlaceId },
  }));

  if (prefs.briefing.outsideFilters) {
    // One major story outside the user's places or topics, chosen by published salience rules.
    const outside = editions
      .flatMap((e) => e.stories)
      .filter((s) => !seen.has(s.analysisId) || !picked.some((p) => p.analysisId === s.analysisId))
      .filter((s) => !picked.some((p) => p.analysisId === s.analysisId))
      .sort((a, b) => b.salience - a.salience)[0];
    if (outside) picked.push({ ...outside, reason: { kind: 'outside' } });
  }
  return { stories: picked.slice(0, max), fallbackPlace };
}
