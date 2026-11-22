/**
 * i18n CI check (TODO 4.8): loops over the language registry and fails on missing or extra keys,
 * invalid ICU placeholders, or a mismatch in placeholder names between English and each language.
 */
import fs from 'node:fs';
import path from 'node:path';
import { LANGUAGES, DEFAULT_LOCALE } from '../src/i18n/languages';
import { NAMESPACES } from '../src/i18n/messages';
import { latamTerms } from '../src/lib/i18n-lexicon';

type Json = Record<string, unknown>;
const root = path.join(process.cwd(), 'messages');

function flatten(obj: Json, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') Object.assign(out, flatten(v as Json, key));
    else out[key] = String(v);
  }
  return out;
}

function placeholders(s: string): string[] {
  const names = new Set<string>();
  let depth = 0;
  let buf = '';
  for (const ch of s) {
    if (ch === '{') {
      if (depth === 0) buf = '';
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth < 0) throw new Error('Unbalanced braces');
      if (depth === 0) names.add(buf.split(',')[0]!.trim());
    } else if (depth === 1) buf += ch;
  }
  if (depth !== 0) throw new Error('Unbalanced braces');
  return [...names].filter((n) => n && n !== '#').sort();
}

let errors = 0;
const fail = (msg: string) => {
  errors++;
  console.error(`✗ ${msg}`);
};

for (const ns of NAMESPACES) {
  const basePath = path.join(root, DEFAULT_LOCALE, `${ns}.json`);
  if (!fs.existsSync(basePath)) {
    fail(`${DEFAULT_LOCALE}/${ns}.json missing`);
    continue;
  }
  const base = flatten(JSON.parse(fs.readFileSync(basePath, 'utf8')) as Json);
  for (const lang of LANGUAGES) {
    const file = path.join(root, lang.tag, `${ns}.json`);
    if (!fs.existsSync(file)) {
      if (lang.enabled) fail(`${lang.tag}/${ns}.json missing`);
      continue;
    }
    const msgs = flatten(JSON.parse(fs.readFileSync(file, 'utf8')) as Json);
    for (const key of Object.keys(base)) {
      if (!(key in msgs)) {
        if (lang.enabled) fail(`${lang.tag}/${ns}: missing key ${key}`);
        continue;
      }
      try {
        const a = placeholders(base[key]!).join(',');
        const b = placeholders(msgs[key]!).join(',');
        if (a !== b) fail(`${lang.tag}/${ns}: placeholders differ for ${key} (${a} vs ${b})`);
      } catch (e) {
        fail(`${lang.tag}/${ns}: ${key}: ${(e as Error).message}`);
      }
    }
    for (const key of Object.keys(msgs)) if (!(key in base)) fail(`${lang.tag}/${ns}: extra key ${key}`);
  }
}

// es-ES lexicon check (TODO 4.18): flag Latin American-only terms in Spanish UI copy.
for (const ns of NAMESPACES) {
  const file = path.join(root, 'es-ES', `${ns}.json`);
  if (!fs.existsSync(file)) continue;
  for (const [key, value] of Object.entries(flatten(JSON.parse(fs.readFileSync(file, 'utf8')) as Json))) {
    for (const term of latamTerms(value)) fail(`es-ES/${ns}: ${key} uses a Latin American term (${term})`);
  }
}

if (errors) {
  console.error(`\n${errors} i18n problem(s).`);
  process.exit(1);
}
console.log(`i18n OK: ${LANGUAGES.length} languages × ${NAMESPACES.length} namespaces.`);
