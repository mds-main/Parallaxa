/**
 * Perception-gap quiz items (TODO 18.2). Published survey data only, with source and original wording.
 * Spain has no seeded items yet: add them in the admin console from CIS / More in Common España data.
 */
export type QuizSeed = {
  placeId: string;
  topicId: string;
  question: { en: string; 'es-ES': string };
  trueValue: number;
  margin: number;
  sourceName: string;
  sourceUrl: string;
  originalWording: string;
  year: number;
};

export const QUIZ_ITEMS: QuizSeed[] = [
  {
    placeId: 'US',
    topicId: 'elections',
    question: {
      en: 'What share of Republicans do you think hold views that are extreme?',
      'es-ES': '¿Qué porcentaje de republicanos crees que tiene opiniones extremas?',
    },
    trueValue: 34,
    margin: 3,
    sourceName: 'More in Common, "The Perception Gap" (Yudkin, Hawkins & Dixon, 2019)',
    sourceUrl: 'https://perceptiongap.us/',
    originalWording: 'Estimated vs. actual share of Republicans holding views measured as extreme (Democrats estimated 53%).',
    year: 2019,
  },
  {
    placeId: 'US',
    topicId: 'elections',
    question: {
      en: 'What share of Democrats do you think hold views that are extreme?',
      'es-ES': '¿Qué porcentaje de demócratas crees que tiene opiniones extremas?',
    },
    trueValue: 29,
    margin: 3,
    sourceName: 'More in Common, "The Perception Gap" (Yudkin, Hawkins & Dixon, 2019)',
    sourceUrl: 'https://perceptiongap.us/',
    originalWording: 'Estimated vs. actual share of Democrats holding views measured as extreme (Republicans estimated 56%).',
    year: 2019,
  },
];
