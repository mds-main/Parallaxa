/** Place list (TODO 3.10): ISO 3166-1 countries and ISO 3166-2 first-level regions for launch countries. */
export type PlaceSeed = {
  id: string;
  parentId: string | null;
  level: 'global' | 'country' | 'region';
  names: { en: string; 'es-ES': string };
  localName?: string;
  timezone: string;
  coverageLevel: 'full' | 'partial' | 'limited';
  hasEdition: boolean;
};

const R = (id: string, en: string, es: string, timezone: string, opts: Partial<PlaceSeed> = {}): PlaceSeed => ({
  id, parentId: id.split('-')[0]!, level: 'region', names: { en, 'es-ES': es }, timezone, coverageLevel: 'limited', hasEdition: false, ...opts,
});

const ES_REGIONS: PlaceSeed[] = [
  R('ES-AN', 'Andalusia', 'Andalucía', 'Europe/Madrid', { coverageLevel: 'partial', hasEdition: true }),
  R('ES-AR', 'Aragon', 'Aragón', 'Europe/Madrid'),
  R('ES-AS', 'Asturias', 'Principado de Asturias', 'Europe/Madrid'),
  R('ES-IB', 'Balearic Islands', 'Islas Baleares', 'Europe/Madrid', { localName: 'Illes Balears' }),
  R('ES-CN', 'Canary Islands', 'Canarias', 'Atlantic/Canary'),
  R('ES-CB', 'Cantabria', 'Cantabria', 'Europe/Madrid'),
  R('ES-CL', 'Castile and León', 'Castilla y León', 'Europe/Madrid'),
  R('ES-CM', 'Castilla–La Mancha', 'Castilla-La Mancha', 'Europe/Madrid'),
  R('ES-CT', 'Catalonia', 'Cataluña', 'Europe/Madrid', { localName: 'Catalunya', coverageLevel: 'partial', hasEdition: true }),
  R('ES-EX', 'Extremadura', 'Extremadura', 'Europe/Madrid'),
  R('ES-GA', 'Galicia', 'Galicia', 'Europe/Madrid'),
  R('ES-MD', 'Community of Madrid', 'Comunidad de Madrid', 'Europe/Madrid', { coverageLevel: 'partial', hasEdition: true }),
  R('ES-MC', 'Region of Murcia', 'Región de Murcia', 'Europe/Madrid'),
  R('ES-NC', 'Navarre', 'Navarra', 'Europe/Madrid', { localName: 'Nafarroa' }),
  R('ES-PV', 'Basque Country', 'País Vasco', 'Europe/Madrid', { localName: 'Euskadi' }),
  R('ES-RI', 'La Rioja', 'La Rioja', 'Europe/Madrid'),
  R('ES-VC', 'Valencian Community', 'Comunidad Valenciana', 'Europe/Madrid', { localName: 'Comunitat Valenciana' }),
  R('ES-CE', 'Ceuta', 'Ceuta', 'Africa/Ceuta'),
  R('ES-ML', 'Melilla', 'Melilla', 'Africa/Ceuta'),
];

const US_STATES: [string, string, string, string][] = [
  ['AL', 'Alabama', 'Alabama', 'America/Chicago'], ['AK', 'Alaska', 'Alaska', 'America/Anchorage'],
  ['AZ', 'Arizona', 'Arizona', 'America/Phoenix'], ['AR', 'Arkansas', 'Arkansas', 'America/Chicago'],
  ['CA', 'California', 'California', 'America/Los_Angeles'], ['CO', 'Colorado', 'Colorado', 'America/Denver'],
  ['CT', 'Connecticut', 'Connecticut', 'America/New_York'], ['DE', 'Delaware', 'Delaware', 'America/New_York'],
  ['DC', 'District of Columbia', 'Distrito de Columbia', 'America/New_York'], ['FL', 'Florida', 'Florida', 'America/New_York'],
  ['GA', 'Georgia', 'Georgia', 'America/New_York'], ['HI', 'Hawaii', 'Hawái', 'Pacific/Honolulu'],
  ['ID', 'Idaho', 'Idaho', 'America/Boise'], ['IL', 'Illinois', 'Illinois', 'America/Chicago'],
  ['IN', 'Indiana', 'Indiana', 'America/Indiana/Indianapolis'], ['IA', 'Iowa', 'Iowa', 'America/Chicago'],
  ['KS', 'Kansas', 'Kansas', 'America/Chicago'], ['KY', 'Kentucky', 'Kentucky', 'America/New_York'],
  ['LA', 'Louisiana', 'Luisiana', 'America/Chicago'], ['ME', 'Maine', 'Maine', 'America/New_York'],
  ['MD', 'Maryland', 'Maryland', 'America/New_York'], ['MA', 'Massachusetts', 'Massachusetts', 'America/New_York'],
  ['MI', 'Michigan', 'Míchigan', 'America/Detroit'], ['MN', 'Minnesota', 'Minnesota', 'America/Chicago'],
  ['MS', 'Mississippi', 'Misisipi', 'America/Chicago'], ['MO', 'Missouri', 'Misuri', 'America/Chicago'],
  ['MT', 'Montana', 'Montana', 'America/Denver'], ['NE', 'Nebraska', 'Nebraska', 'America/Chicago'],
  ['NV', 'Nevada', 'Nevada', 'America/Los_Angeles'], ['NH', 'New Hampshire', 'Nuevo Hampshire', 'America/New_York'],
  ['NJ', 'New Jersey', 'Nueva Jersey', 'America/New_York'], ['NM', 'New Mexico', 'Nuevo México', 'America/Denver'],
  ['NY', 'New York', 'Nueva York', 'America/New_York'], ['NC', 'North Carolina', 'Carolina del Norte', 'America/New_York'],
  ['ND', 'North Dakota', 'Dakota del Norte', 'America/Chicago'], ['OH', 'Ohio', 'Ohio', 'America/New_York'],
  ['OK', 'Oklahoma', 'Oklahoma', 'America/Chicago'], ['OR', 'Oregon', 'Oregón', 'America/Los_Angeles'],
  ['PA', 'Pennsylvania', 'Pensilvania', 'America/New_York'], ['RI', 'Rhode Island', 'Rhode Island', 'America/New_York'],
  ['SC', 'South Carolina', 'Carolina del Sur', 'America/New_York'], ['SD', 'South Dakota', 'Dakota del Sur', 'America/Chicago'],
  ['TN', 'Tennessee', 'Tennessee', 'America/Chicago'], ['TX', 'Texas', 'Texas', 'America/Chicago'],
  ['UT', 'Utah', 'Utah', 'America/Denver'], ['VT', 'Vermont', 'Vermont', 'America/New_York'],
  ['VA', 'Virginia', 'Virginia', 'America/New_York'], ['WA', 'Washington', 'Washington', 'America/Los_Angeles'],
  ['WV', 'West Virginia', 'Virginia Occidental', 'America/New_York'], ['WI', 'Wisconsin', 'Wisconsin', 'America/Chicago'],
  ['WY', 'Wyoming', 'Wyoming', 'America/Denver'],
];

export const PLACES: PlaceSeed[] = [
  { id: 'GLOBAL', parentId: null, level: 'global', names: { en: 'Global', 'es-ES': 'Global' }, timezone: 'UTC', coverageLevel: 'full', hasEdition: true },
  { id: 'ES', parentId: 'GLOBAL', level: 'country', names: { en: 'Spain', 'es-ES': 'España' }, timezone: 'Europe/Madrid', coverageLevel: 'full', hasEdition: true },
  ...ES_REGIONS,
  { id: 'US', parentId: 'GLOBAL', level: 'country', names: { en: 'United States', 'es-ES': 'Estados Unidos' }, timezone: 'America/New_York', coverageLevel: 'full', hasEdition: true },
  ...US_STATES.map(([code, en, es, tz]) => R(`US-${code}`, en, es, tz)),
  { id: 'GB', parentId: 'GLOBAL', level: 'country', names: { en: 'United Kingdom', 'es-ES': 'Reino Unido' }, timezone: 'Europe/London', coverageLevel: 'limited', hasEdition: false },
  R('GB-ENG', 'England', 'Inglaterra', 'Europe/London'),
  R('GB-SCT', 'Scotland', 'Escocia', 'Europe/London'),
  R('GB-WLS', 'Wales', 'Gales', 'Europe/London'),
  R('GB-NIR', 'Northern Ireland', 'Irlanda del Norte', 'Europe/London'),
  { id: 'MX', parentId: 'GLOBAL', level: 'country', names: { en: 'Mexico', 'es-ES': 'México' }, timezone: 'America/Mexico_City', coverageLevel: 'limited', hasEdition: false },
];
