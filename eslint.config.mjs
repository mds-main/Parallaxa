import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const LOCALE_LITERAL = /^(en|es-ES|es)$/;

export default [
  ...nextVitals,
  ...nextTs,
  { ignores: ['.next/**', 'node_modules/**', 'drizzle/**', '.data/**', 'playwright-report/**', 'test-results/**', 'next-env.d.ts', 'public/sw.js'] },
  {
    // Rule from TODO 4.2: locale lists live only in the language registry.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/i18n/languages.ts', 'src/**/*.test.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: `ArrayExpression > Literal[value=${LOCALE_LITERAL}]`,
          message: 'Do not hard-code locale lists. Read them from src/i18n/languages.ts.',
        },
      ],
    },
  },
];
