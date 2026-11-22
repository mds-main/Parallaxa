/** es-ES lexicon check (TODO 4.18): flags Latin American-only vocabulary and forms in Spanish text. */
const LATAM: RegExp[] = [/\bcomputadoras?\b/i, /\bcelular(es)?\b/i, /\bcarros?\b/i, /\bmanej(ar|o|a|an|aba)\b/i, /\bustedes\b/i, /\bplata\b/i, /\bchequea(r|do)\b/i, /\bajustad[oa]s? a los ingresos\b/i, /\blindo\b/i, /\bno más\b/i, /\bahorita\b/i];

export function latamTerms(text: string): string[] {
  return LATAM.filter((re) => re.test(text)).map((re) => re.source);
}
