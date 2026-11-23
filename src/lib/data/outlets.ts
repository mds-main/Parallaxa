/**
 * Outlet registry (TODO 11.8): type, country and language only. Deliberately no left/right bias scores:
 * sources are graded by tier and evidence, never by an outlet's perceived side.
 */
export type OutletSeed = { name: string; domain: string; type: 'newspaper' | 'broadcaster' | 'digital' | 'wire' | 'magazine' | 'factcheck'; country: string; lang: string };

const O = (name: string, domain: string, type: OutletSeed['type'], country: string, lang: string): OutletSeed => ({ name, domain, type, country, lang });

export const OUTLETS: OutletSeed[] = [
  O('Agencia EFE', 'efe.com', 'wire', 'ES', 'es'), O('Europa Press', 'europapress.es', 'wire', 'ES', 'es'),
  O('El País', 'elpais.com', 'newspaper', 'ES', 'es'), O('El Mundo', 'elmundo.es', 'newspaper', 'ES', 'es'), O('ABC', 'abc.es', 'newspaper', 'ES', 'es'),
  O('La Vanguardia', 'lavanguardia.com', 'newspaper', 'ES', 'es'), O('La Razón', 'larazon.es', 'newspaper', 'ES', 'es'), O('El Periódico', 'elperiodico.com', 'newspaper', 'ES', 'es'),
  O('elDiario.es', 'eldiario.es', 'digital', 'ES', 'es'), O('El Confidencial', 'elconfidencial.com', 'digital', 'ES', 'es'), O('El Español', 'elespanol.com', 'digital', 'ES', 'es'),
  O('Público', 'publico.es', 'digital', 'ES', 'es'), O('infoLibre', 'infolibre.es', 'digital', 'ES', 'es'), O('OKDiario', 'okdiario.com', 'digital', 'ES', 'es'), O('20minutos', '20minutos.es', 'digital', 'ES', 'es'),
  O('RTVE', 'rtve.es', 'broadcaster', 'ES', 'es'), O('Cadena SER', 'cadenaser.com', 'broadcaster', 'ES', 'es'), O('COPE', 'cope.es', 'broadcaster', 'ES', 'es'),
  O('Newtral', 'newtral.es', 'factcheck', 'ES', 'es'), O('Maldita', 'maldita.es', 'factcheck', 'ES', 'es'),
  O('Associated Press', 'apnews.com', 'wire', 'US', 'en'), O('Reuters', 'reuters.com', 'wire', 'GB', 'en'), O('AFP', 'afp.com', 'wire', 'FR', 'en'),
  O('The New York Times', 'nytimes.com', 'newspaper', 'US', 'en'), O('The Wall Street Journal', 'wsj.com', 'newspaper', 'US', 'en'), O('The Washington Post', 'washingtonpost.com', 'newspaper', 'US', 'en'),
  O('USA Today', 'usatoday.com', 'newspaper', 'US', 'en'), O('Washington Examiner', 'washingtonexaminer.com', 'digital', 'US', 'en'), O('The Dispatch', 'thedispatch.com', 'digital', 'US', 'en'),
  O('National Review', 'nationalreview.com', 'magazine', 'US', 'en'), O('The Atlantic', 'theatlantic.com', 'magazine', 'US', 'en'), O('Bloomberg', 'bloomberg.com', 'digital', 'US', 'en'),
  O('Fox News', 'foxnews.com', 'broadcaster', 'US', 'en'), O('CNN', 'cnn.com', 'broadcaster', 'US', 'en'), O('NPR', 'npr.org', 'broadcaster', 'US', 'en'),
  O('PolitiFact', 'politifact.com', 'factcheck', 'US', 'en'),
  O('BBC', 'bbc.com', 'broadcaster', 'GB', 'en'), O('The Guardian', 'theguardian.com', 'newspaper', 'GB', 'en'), O('Financial Times', 'ft.com', 'newspaper', 'GB', 'en'),
  O('The Economist', 'economist.com', 'magazine', 'GB', 'en'), O('Le Monde', 'lemonde.fr', 'newspaper', 'FR', 'fr'), O('DW', 'dw.com', 'broadcaster', 'DE', 'en'),
];

/** Authoritative primary sources per place, given to the retrieval step as hints (TODO 11.9). */
export const PRIMARY_SOURCES: Record<string, string[]> = {
  ES: ['INE (ine.es)', 'Banco de España (bde.es)', 'BOE (boe.es)', 'AIReF (airef.es)', 'CIS (cis.es)', 'Eurostat'],
  US: ['BLS (bls.gov)', 'Census Bureau (census.gov)', 'BEA (bea.gov)', 'CBO (cbo.gov)', 'Federal Reserve (federalreserve.gov)'],
  GB: ['ONS (ons.gov.uk)', 'legislation.gov.uk', 'UK Parliament (parliament.uk)'],
  MX: ['INEGI (inegi.org.mx)', 'Banxico (banxico.org.mx)', 'DOF (dof.gob.mx)'],
  AT: ['Statistik Austria (statistik.at)', 'RIS legal information (ris.bka.gv.at)', 'Parliament (parlament.gv.at)'],
  BE: ['Statbel (statbel.fgov.be)', 'Belgian Official Journal (ejustice.just.fgov.be)'],
  BG: ['National Statistical Institute (nsi.bg)'],
  HR: ['Croatian Bureau of Statistics (dzs.gov.hr)'],
  CY: ['CYSTAT (cystat.gov.cy)'],
  CZ: ['Czech Statistical Office (czso.cz)'],
  DK: ['Statistics Denmark (dst.dk)', 'Folketinget (ft.dk)'],
  EE: ['Statistics Estonia (stat.ee)', 'Riigi Teataja (riigiteataja.ee)'],
  FI: ['Statistics Finland (stat.fi)', 'Finlex (finlex.fi)'],
  FR: ['INSEE (insee.fr)', 'Légifrance (legifrance.gouv.fr)', 'Assemblée nationale (assemblee-nationale.fr)'],
  DE: ['Destatis (destatis.de)', 'Bundestag (bundestag.de)', 'Bundesbank (bundesbank.de)'],
  GR: ['ELSTAT (statistics.gr)'],
  HU: ['Hungarian Central Statistical Office (ksh.hu)'],
  IE: ['Central Statistics Office (cso.ie)', 'Oireachtas (oireachtas.ie)', 'Irish Statute Book (irishstatutebook.ie)'],
  IT: ['ISTAT (istat.it)', 'Gazzetta Ufficiale (gazzettaufficiale.it)', "Banca d'Italia (bancaditalia.it)"],
  LV: ['Official Statistics Portal (stat.gov.lv)'],
  LT: ['Statistics Lithuania (stat.gov.lt)'],
  LU: ['STATEC (statec.lu)'],
  MT: ['National Statistics Office (nso.gov.mt)'],
  NL: ['CBS (cbs.nl)', 'Overheid.nl (overheid.nl)', 'Tweede Kamer (tweedekamer.nl)'],
  PL: ['Statistics Poland (stat.gov.pl)', 'Sejm (sejm.gov.pl)'],
  PT: ['INE Portugal (ine.pt)', 'Diário da República (diariodarepublica.pt)', 'Pordata (pordata.pt)'],
  RO: ['National Institute of Statistics (insse.ro)'],
  SK: ['Statistical Office of the Slovak Republic (statistics.sk)'],
  SI: ['Statistical Office of Slovenia (stat.si)'],
  SE: ['Statistics Sweden (scb.se)', 'Riksdag (riksdagen.se)'],
  NO: ['Statistics Norway (ssb.no)', 'Lovdata (lovdata.no)'],
  CH: ['Federal Statistical Office (bfs.admin.ch)', 'Fedlex (fedlex.admin.ch)'],
  IS: ['Statistics Iceland (statice.is)'],
  UA: ['State Statistics Service (ukrstat.gov.ua)', 'Verkhovna Rada (rada.gov.ua)'],
  /** Added for every EU member state. */
  EU: ['Eurostat (ec.europa.eu/eurostat)', 'EUR-Lex (eur-lex.europa.eu)', 'European Commission (commission.europa.eu)', 'European Parliament (europarl.europa.eu)', 'ECB (ecb.europa.eu)'],
  GLOBAL: ['World Bank', 'IMF', 'OECD', 'UN', 'WHO'],
};
