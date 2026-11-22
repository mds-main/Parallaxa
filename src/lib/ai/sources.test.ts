import { describe, expect, it } from 'vitest';
import { inferTier, quoteAppears } from './sources';

describe('inferTier', () => {
  it.each([
    ['https://www.ine.es/dyngs/INEbase', 1], ['https://www.bls.gov/cpi/', 1], ['https://ec.europa.eu/eurostat', 1],
    ['https://www.reuters.com/world', 2], ['https://www.elpais.com/x', 3], ['https://x.com/someone/status/1', 4],
  ])('%s → tier %i', (url, tier) => expect(inferTier(url, 1)).toBe(tier));
  it('never trusts a model claiming tier 1 for an unknown domain', () => expect(inferTier('https://randomblog.example/', 1)).toBe(3));
});

describe('quoteAppears', () => {
  it('matches despite quotes, case and whitespace', () => {
    expect(quoteAppears('Unemployment fell to 11.2%', 'In March, “unemployment   fell to 11.2%” according to INE.')).toBe(true);
    expect(quoteAppears('Unemployment rose', 'Unemployment fell')).toBe(false);
  });
});
