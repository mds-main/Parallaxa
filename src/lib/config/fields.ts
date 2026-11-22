/**
 * Settings descriptors: one entry per setting the admin console can edit (TODO 22.7).
 * Forms, validation messages and the settings reference are generated from this list,
 * so a new setting appears in the console automatically with its help text and safe range.
 */
export type FieldType = 'number' | 'boolean' | 'select' | 'text' | 'list';

export type FieldDescriptor = {
  /** Dotted path into AppConfig, e.g. 'pipeline.minSources'. */
  path: string;
  section: 'pipeline' | 'limits' | 'content' | 'alerts';
  type: FieldType;
  label: { en: string; 'es-ES': string };
  help: { en: string; 'es-ES': string };
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: { value: string; label: { en: string; 'es-ES': string } }[];
  /** Changes to this field affect quality; the console suggests a test run before activating. */
  needsTest?: boolean;
  /** Production-wide effect: requires typed confirmation. */
  dangerous?: boolean;
  affects: ('check' | 'briefing' | 'dialogue' | 'ledger' | 'quiz' | 'admin' | 'costs')[];
};

const L = (en: string, es: string) => ({ en, 'es-ES': es });

export const FIELDS: FieldDescriptor[] = [
  // ── Pipeline ──
  {
    path: 'pipeline.cacheSimilarity', section: 'pipeline', type: 'number', min: 0.8, max: 0.99, step: 0.01,
    label: L('Reuse threshold for similar claims', 'Umbral para reutilizar afirmaciones parecidas'),
    help: L('How similar a new claim must be to an earlier one to reuse its analysis. Higher = fewer reuses, more cost.', 'Cuánto debe parecerse una afirmación nueva a una anterior para reutilizar su análisis. Más alto = menos reutilización y más coste.'),
    needsTest: true, affects: ['check', 'costs'],
  },
  {
    path: 'pipeline.minSources', section: 'pipeline', type: 'number', min: 1, max: 5, step: 1,
    label: L('Minimum independent sources', 'Mínimo de fuentes independientes'),
    help: L('Sources needed before a claim can be graded supported or contradicted. Methodology default: 2.', 'Fuentes necesarias para calificar una afirmación como respaldada o contradicha. Valor de la metodología: 2.'),
    needsTest: true, affects: ['check', 'briefing'],
  },
  {
    path: 'pipeline.staleDataMonths', section: 'pipeline', type: 'number', min: 1, max: 60, step: 1, unit: 'months',
    label: L('Stale data after', 'Datos antiguos a partir de'),
    help: L('Evidence older than this is flagged as possibly out of date.', 'Las pruebas más antiguas se marcan como posiblemente desactualizadas.'),
    affects: ['check'],
  },
  {
    path: 'pipeline.aggregationRule', section: 'pipeline', type: 'select', needsTest: true,
    options: [
      { value: 'median', label: L('Median grade (recommended)', 'Calificación mediana (recomendado)') },
      { value: 'majority', label: L('Majority grade', 'Calificación mayoritaria') },
      { value: 'unanimous', label: L('Unanimous, otherwise "Mixed"', 'Unánime; si no, «Mixto»') },
    ],
    label: L('How verdicts are combined', 'Cómo se combinan los veredictos'),
    help: L('The published rule that turns the perspective models\' verdicts into one grade. No model decides this.', 'La regla publicada que convierte los veredictos de los modelos en una sola calificación. Ningún modelo lo decide.'),
    affects: ['check', 'briefing'],
  },
  {
    path: 'pipeline.disagreementSteps', section: 'pipeline', type: 'number', min: 1, max: 5, step: 1, unit: 'grade steps',
    label: L('"Models disagree" threshold', 'Umbral de «Los modelos discrepan»'),
    help: L('If verdicts are this many grade steps apart, the analysis shows "Models disagree" and goes to human review.', 'Si los veredictos se separan este número de niveles, el análisis muestra «Los modelos discrepan» y pasa a revisión humana.'),
    needsTest: true, affects: ['check'],
  },
  {
    path: 'pipeline.humanReviewOnDisagreement', section: 'pipeline', type: 'boolean',
    label: L('Send disagreements to human review', 'Enviar discrepancias a revisión humana'),
    help: L('Strongly recommended. Turning it off publishes disputed analyses without a human look.', 'Muy recomendable. Si se desactiva, los análisis disputados se publican sin revisión humana.'),
    dangerous: true, affects: ['check'],
  },
  {
    path: 'pipeline.humanReviewSampleRate', section: 'pipeline', type: 'number', min: 0, max: 0.2, step: 0.01,
    label: L('Random human-review sample', 'Muestra aleatoria para revisión humana'),
    help: L('Share of all analyses sampled for cross-partisan human review (PRD: 2%).', 'Proporción de análisis revisados al azar por personas de distintas sensibilidades (PRD: 2 %).'),
    affects: ['check'],
  },
  {
    path: 'pipeline.mirrorTestEnabled', section: 'pipeline', type: 'boolean',
    label: L('Mirror test', 'Prueba espejo'),
    help: L('Checks that the same rubric grades the equivalent claim from the other side consistently.', 'Comprueba que la misma rúbrica califica de forma coherente la afirmación equivalente del otro lado.'),
    affects: ['check', 'costs'],
  },
  {
    path: 'pipeline.maxClaimsPerCheck', section: 'pipeline', type: 'number', min: 1, max: 10, step: 1,
    label: L('Max claims per check', 'Máximo de afirmaciones por comprobación'),
    help: L('Long texts are split into atomic claims; only this many are investigated.', 'Los textos largos se dividen en afirmaciones; solo se investigan estas.'),
    affects: ['check', 'costs'],
  },
  // ── Limits ──
  {
    path: 'limits.dailySpendCeilingUsd', section: 'limits', type: 'number', min: 1, max: 100000, step: 1, unit: 'USD',
    label: L('Daily AI spend ceiling', 'Límite diario de gasto en IA'),
    help: L('When reached, new checks pause until midnight UTC (briefings keep running).', 'Al alcanzarlo, las comprobaciones nuevas se pausan hasta medianoche UTC (los resúmenes siguen).'),
    dangerous: true, affects: ['check', 'costs'],
  },
  {
    path: 'limits.spendAlertPercent', section: 'limits', type: 'number', min: 10, max: 100, step: 5, unit: '%',
    label: L('Spend alert at', 'Aviso de gasto al'),
    help: L('Send an alert when daily spend reaches this share of the ceiling.', 'Envía un aviso cuando el gasto diario llegue a este porcentaje del límite.'),
    affects: ['admin'],
  },
  {
    path: 'limits.checksPerHourAnonymous', section: 'limits', type: 'number', min: 1, max: 500, step: 1,
    label: L('Checks per hour (anonymous)', 'Comprobaciones por hora (anónimo)'),
    help: L('Per visitor. PRD default: 20.', 'Por visitante. Valor del PRD: 20.'), affects: ['check'],
  },
  {
    path: 'limits.checksPerHourSignedIn', section: 'limits', type: 'number', min: 1, max: 1000, step: 1,
    label: L('Checks per hour (signed in)', 'Comprobaciones por hora (con cuenta)'),
    help: L('Per account. PRD default: 60.', 'Por cuenta. Valor del PRD: 60.'), affects: ['check'],
  },
  {
    path: 'limits.dialogueMaxTurns', section: 'limits', type: 'number', min: 1, max: 30, step: 1,
    label: L('"Push back" turns', 'Turnos de «Rebatir»'),
    help: L('Maximum exchanges in one Push back conversation.', 'Máximo de intercambios en una conversación de Rebatir.'), affects: ['dialogue'],
  },
  {
    path: 'limits.fallbackEnabled', section: 'limits', type: 'boolean', dangerous: true,
    label: L('Use AI Gateway when Venice fails', 'Usar AI Gateway si Venice falla'),
    help: L('Keeps Check and Briefing running during a Venice outage (disclosed on each analysis).', 'Mantiene Comprobar y el Resumen durante una caída de Venice (se indica en cada análisis).'),
    affects: ['check', 'briefing'],
  },
  {
    path: 'limits.breakerFailures', section: 'limits', type: 'number', min: 1, max: 50, step: 1,
    label: L('Circuit breaker: failures', 'Cortacircuitos: fallos'),
    help: L('A model is taken out of rotation after this many failures within the window.', 'Un modelo se retira tras este número de fallos dentro de la ventana.'), affects: ['check'],
  },
  {
    path: 'limits.breakerWindowSec', section: 'limits', type: 'number', min: 10, max: 600, step: 10, unit: 's',
    label: L('Circuit breaker: window', 'Cortacircuitos: ventana'),
    help: L('Time window for counting failures.', 'Ventana de tiempo para contar fallos.'), affects: ['check'],
  },
  {
    path: 'limits.breakerProbeSec', section: 'limits', type: 'number', min: 5, max: 300, step: 5, unit: 's',
    label: L('Circuit breaker: retry after', 'Cortacircuitos: reintentar tras'),
    help: L('How long before a test request checks whether the model has recovered.', 'Tiempo hasta que una petición de prueba comprueba si el modelo se ha recuperado.'), affects: ['check'],
  },
  {
    path: 'limits.timeoutStepSec', section: 'limits', type: 'number', min: 10, max: 300, step: 5, unit: 's',
    label: L('Timeout per step', 'Tiempo máximo por paso'),
    help: L('Utility steps (decomposition, tagging, rendering) give up after this long.', 'Los pasos auxiliares (división, etiquetado, redacción) se abandonan pasado este tiempo.'), affects: ['check'],
  },
  // ── Content ──
  {
    path: 'content.briefingStories', section: 'content', type: 'number', min: 3, max: 5, step: 1,
    label: L('Stories per briefing (max)', 'Historias por resumen (máx.)'),
    help: L('The Daily Parallax never shows more than 5.', 'El Daily Parallax nunca muestra más de 5.'), affects: ['briefing'],
  },
  {
    path: 'content.outsideFiltersDefault', section: 'content', type: 'boolean',
    label: L('"Outside your filters" slot on by default', 'Hueco «Fuera de tus filtros» activado por defecto'),
    help: L('Reserves one briefing story for a major event outside the user\'s places or topics.', 'Reserva una historia del resumen para un hecho importante fuera de los lugares o temas del usuario.'),
    affects: ['briefing'],
  },
  {
    path: 'content.notificationsRoutinePerDay', section: 'content', type: 'number', min: 0, max: 3, step: 1,
    label: L('Routine notifications per day', 'Notificaciones habituales al día'),
    help: L('PRD default: 1 (the briefing).', 'Valor del PRD: 1 (el resumen).'), affects: ['briefing'],
  },
  {
    path: 'content.followUpsPerDay', section: 'content', type: 'number', min: 0, max: 10, step: 1,
    label: L('Requested follow-ups per day', 'Avisos solicitados al día'),
    help: L('Updates users asked for (corrections, replies). PRD default: 3.', 'Avisos que el usuario pidió (correcciones, réplicas). Valor del PRD: 3.'), affects: ['briefing'],
  },
  {
    path: 'content.editionPlaces', section: 'content', type: 'list',
    label: L('Places with their own edition', 'Lugares con edición propia'),
    help: L('Place codes (GLOBAL, ES, US, ES-MD…). Regional editions need reviewer capacity.', 'Códigos de lugar (GLOBAL, ES, US, ES-MD…). Las ediciones regionales necesitan revisores.'),
    affects: ['briefing', 'costs'],
  },
  {
    path: 'content.quizCountries', section: 'content', type: 'list',
    label: L('Quiz countries', 'Países del test'),
    help: L('Countries with published perception-gap survey data.', 'Países con datos publicados de brecha de percepción.'), affects: ['quiz'],
  },
  // ── Alerts ──
  {
    path: 'alerts.emails', section: 'alerts', type: 'text',
    label: L('Alert emails', 'Correos de aviso'),
    help: L('Comma-separated addresses that receive alerts.', 'Direcciones separadas por comas que reciben los avisos.'), affects: ['admin'],
  },
  {
    path: 'alerts.sloP95Seconds', section: 'alerts', type: 'number', min: 5, max: 120, step: 1, unit: 's',
    label: L('Alert if p95 time to result exceeds', 'Avisar si el p95 del tiempo de resultado supera'),
    help: L('PRD target: 20 s.', 'Objetivo del PRD: 20 s.'), affects: ['admin'],
  },
  {
    path: 'alerts.errorRatePercent', section: 'alerts', type: 'number', min: 1, max: 50, step: 1, unit: '%',
    label: L('Alert if error rate exceeds', 'Avisar si la tasa de error supera'),
    help: L('Share of failed checks in the last hour.', 'Proporción de comprobaciones fallidas en la última hora.'), affects: ['admin'],
  },
  { path: 'alerts.onFallback', section: 'alerts', type: 'boolean', label: L('Alert when the fallback is active', 'Avisar cuando se use el respaldo'), help: L('Venice outage detected.', 'Se ha detectado una caída de Venice.'), affects: ['admin'] },
  { path: 'alerts.onEvalRegression', section: 'alerts', type: 'boolean', label: L('Alert on eval regression', 'Avisar si la evaluación empeora'), help: L('After a model swap or in the nightly run.', 'Tras un cambio de modelo o en la ejecución nocturna.'), affects: ['admin'] },
  { path: 'alerts.onLateBriefing', section: 'alerts', type: 'boolean', label: L('Alert on late briefing', 'Avisar si el resumen se retrasa'), help: L('An edition is not ready by 06:45 local time.', 'Una edición no está lista a las 06:45 hora local.'), affects: ['admin'] },
  { path: 'alerts.onLoginLockout', section: 'alerts', type: 'boolean', label: L('Alert on admin login lockout', 'Avisar si se bloquea el acceso de administración'), help: L('5 failed sign-ins within 15 minutes.', '5 intentos fallidos en 15 minutos.'), affects: ['admin'] },
];

export function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined), obj);
}

export function setPath<T>(obj: T, path: string, value: unknown): T {
  const clone = structuredClone(obj) as Record<string, unknown>;
  const keys = path.split('.');
  let cur: Record<string, unknown> = clone;
  for (const k of keys.slice(0, -1)) cur = cur[k] as Record<string, unknown>;
  cur[keys[keys.length - 1]!] = value;
  return clone as T;
}
