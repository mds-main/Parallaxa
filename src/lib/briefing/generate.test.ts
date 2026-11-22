import { describe, expect, it } from 'vitest';
import { generateEdition, salience } from './generate';
import { getPublishedEditions } from '../queries';

describe('briefing generation (demo mode)', () => {
  it('ranks by salience: coverage on both sides beats one-sided virality', () => {
    expect(salience({ claim: 'a', outletsLeft: 4, outletsRight: 4, viral: 0.2, upcomingDecision: false })).toBeGreaterThan(
      salience({ claim: 'b', outletsLeft: 6, outletsRight: 0, viral: 0.4, upcomingDecision: false }),
    );
  });
  it('generates and publishes an edition with localized headlines', async () => {
    const r = await generateEdition('ES');
    expect(r!.status).toBe('published');
    expect(r!.stories).toBeGreaterThan(0);
    const eds = await getPublishedEditions();
    const es = eds.find((e) => e.placeId === 'ES')!;
    expect(es.stories[0]!.headline['es-ES']).toBeTruthy();
    expect(es.stories[0]!.headline.en).toBeTruthy();
  });
});
