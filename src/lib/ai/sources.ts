/** Source tiers (TODO 3.3): domain-based tier inference; model-claimed tiers are never trusted blindly. */
import type { SourceTier, VerdictSource } from '../domain/types';

const T1 = [/\.gov(\.[a-z]{2})?$/, /\.gob\.[a-z]{2}$/, /\.gob$/, /europa\.eu$/, /(^|\.)ine\.es$/, /(^|\.)bls\.gov$/, /(^|\.)census\.gov$/, /(^|\.)oecd\.org$/, /(^|\.)who\.int$/, /(^|\.)worldbank\.org$/, /(^|\.)imf\.org$/, /(^|\.)boe\.es$/, /(^|\.)poderjudicial\.es$/, /(^|\.)congreso\.es$/, /(^|\.)senado\.es$/, /(^|\.)cis\.es$/, /(^|\.)bde\.es$/, /(^|\.)ons\.gov\.uk$/, /(^|\.)parliament\.uk$/, /(^|\.)legislation\.gov\.uk$/, /(^|\.)supremecourt\.gov$/, /(^|\.)un\.org$/, /(^|\.)doi\.org$/, /(^|\.)nature\.com$/, /(^|\.)science\.org$/, /(^|\.)thelancet\.com$/, /(^|\.)nejm\.org$/, /(^|\.)pnas\.org$/, /(^|\.)ncbi\.nlm\.nih\.gov$/, /(^|\.)inegi\.org\.mx$/];
const T2 = [/(^|\.)reuters\.com$/, /(^|\.)apnews\.com$/, /(^|\.)afp\.com$/, /(^|\.)efe\.com$/, /(^|\.)europapress\.es$/, /(^|\.)pewresearch\.org$/, /(^|\.)brookings\.edu$/, /(^|\.)fedeablogs\.net$/, /(^|\.)fedea\.net$/, /(^|\.)realinstitutoelcano\.org$/, /(^|\.)cochrane\.org$/, /(^|\.)ifs\.org\.uk$/, /(^|\.)urban\.org$/, /(^|\.)cbo\.gov$/, /(^|\.)airef\.es$/, /\.edu$/, /(^|\.)ac\.uk$/];
const T4 = [/(^|\.)x\.com$/, /(^|\.)twitter\.com$/, /(^|\.)facebook\.com$/, /(^|\.)instagram\.com$/, /(^|\.)tiktok\.com$/, /(^|\.)reddit\.com$/, /(^|\.)youtube\.com$/, /(^|\.)t\.me$/, /(^|\.)substack\.com$/, /(^|\.)medium\.com$/, /(^|\.)blogspot\.com$/, /(^|\.)wordpress\.com$/];

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

export function inferTier(url: string, claimed?: number): SourceTier {
  const d = domainOf(url);
  if (T4.some((r) => r.test(d))) return 4;
  if (T1.some((r) => r.test(d))) return 1;
  if (T2.some((r) => r.test(d))) return 2;
  // Unknown domains are at best tier 3 (established outlets), whatever the model claimed.
  const c = claimed && claimed >= 1 && claimed <= 4 ? claimed : 3;
  return Math.max(3, c) as SourceTier;
}

export function dedupeSources(sources: VerdictSource[]): VerdictSource[] {
  const seen = new Map<string, VerdictSource>();
  for (const s of sources) {
    const key = s.url.replace(/[#?].*$/, '').replace(/\/$/, '');
    const prev = seen.get(key);
    if (!prev || (s.quoteVerified && !prev.quoteVerified)) seen.set(key, s);
  }
  return [...seen.values()];
}

export function normalizeForQuote(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[“”«»"']/g, '')
    .replace(/[‐-―-]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Verbatim quote check (TODO 12.13): the quote must appear in the fetched page text. */
export function quoteAppears(quote: string, pageText: string): boolean {
  const q = normalizeForQuote(quote);
  return q.length > 0 && normalizeForQuote(pageText).includes(q);
}
