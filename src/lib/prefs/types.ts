/** User preferences (PRD F6). Stored on the device for anonymous users; never sent to model providers. */
export type PlacePref = { id: string; mode: 'focus' | 'include'; home: boolean };
export type TopicState = 'follow' | 'neutral' | 'mute';

export type Preferences = {
  version: 1;
  places: PlacePref[];
  global: boolean;
  topics: Record<string, TopicState>;
  follows: { analyses: string[]; actors: string[] };
  briefing: { stories: 3 | 5; time: string; days: 'everyday' | 'weekdays'; depth: 'quick' | 'standard'; plain: boolean; outsideFilters: boolean; outsideOffSince?: string };
  notifications: { enabled: boolean; quietFrom?: string; quietTo?: string; pausedUntil?: string };
  onboarded: boolean;
};

export const MAX_PLACES = 5;

export function defaultPreferences(homeCountry = 'ES'): Preferences {
  return {
    version: 1,
    places: [{ id: homeCountry, mode: 'include', home: true }],
    global: true,
    topics: {},
    follows: { analyses: [], actors: [] },
    briefing: { stories: 5, time: '07:00', days: 'everyday', depth: 'standard', plain: false, outsideFilters: true },
    notifications: { enabled: false },
    onboarded: false,
  };
}

/** Suggests a home country from the browser locale's region subtag only (never IP, never geolocation). */
export function suggestHomeCountry(navigatorLanguages: readonly string[], known: string[]): string {
  for (const tag of navigatorLanguages) {
    const region = tag.split('-')[1]?.toUpperCase();
    if (region && known.includes(region)) return region;
  }
  const primary = navigatorLanguages[0]?.split('-')[0];
  return primary === 'es' ? 'ES' : 'US';
}
