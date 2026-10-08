import type { PointOfInterest, StageKind, ValidationStatus } from '../domain/types';

/**
 * Contenuti delle tappe e dei punti d'interesse. Nessuna coordinata qui; durate e distanze di cammino sono ricavate
 * dai dati del percorso (public/data/geo/routes.json); quelle in auto da drive.json.
 */
export interface StageContent {
  id: string;
  order: number;
  kind: StageKind;
  mode: 'auto' | 'piedi' | 'sosta';
  name: string;
  summary: string;
  placeId: string;
  routeId?: string;
  /** Tratto del percorso (m di progressiva) per le tappe a piedi. */
  leg?: { fromM: number | 'start'; toM: number | 'end' };
  driveLeg?: 'pergine-boazzo' | 'boazzo-dam' | 'dam-pergine';
  /** Durata di default (min) se non derivabile dai dati. */
  fixedMin?: { nominal: number; min: number; max: number; basis: 'source' | 'estimated' | 'model' };
  waymarks: string[];
  whatToSee: string[];
  difficulties: string[];
  howToContinue: string[];
  alternatives: string[];
  sourceIds: string[];
  validation: ValidationStatus;
}

export const STAGE_CONTENT: StageContent[] = [
  {
    id: 's1-pergine',
    order: 1,
    kind: 'start',
    mode: 'sosta',
    name: 'Pergine Valsugana — partenza',
    summary: 'Ritrovo e partenza in auto tra le 07:00 e le 08:00. Se il programma salta, la prima cosa da accorciare è la sosta alla cascata del Leno.',
    placeId: 'pergine',
    fixedMin: { nominal: 0, min: 0, max: 0, basis: 'estimated' },
    waymarks: [],
    whatToSee: [],
    difficulties: ['Traffico del mattino tra Pergine e Trento: può aggiungere 10–15 minuti.'],
    howToContinue: ['Apri la navigazione stradale verso il parcheggio presso la Centrale di Boazzo (Val Daone).', 'Controlla carburante, monete per il parcheggio e batteria del telefono.'],
    alternatives: [],
    sourceIds: ['osm-overture'],
    validation: 'source-derived',
  },
  {
    id: 's2-leno',
    order: 2,
    kind: 'drive',
    mode: 'auto',
    name: 'Cascata del Leno (Lago di Boazzo)',
    summary:
      'Dopo circa 83 km in auto (SS47 → SS45bis → SS237 → SP27) si parcheggia presso la Centrale di Boazzo e si cammina per ≈345 m sulla pista della sponda ovest fino al ponte alla base della cascata. Sosta fotografica di circa 35 minuti compreso il ritorno.',
    placeId: 'park-boazzo-centrale',
    routeId: 'walk-leno',
    driveLeg: 'pergine-boazzo',
    waymarks: ['Strada provinciale SP27 "di Daone" (cartelli Valdaone / Boazzo)', 'Per i sentieri a monte: SAT 246 (Val di Leno) secondo una fonte secondaria'],
    whatToSee: ['La cascata dal basso, con il lago di Boazzo davanti', 'Il ponte dove il torrente Leno entra nel lago'],
    difficulties: [
      'Pista sterrata, a tratti fangosa.',
      'La salita verso la sommità della cascata è ripida (≈1,15 km, +250 m) e NON è nel programma.',
      'Il nodo OSM "Cascata del Leno" è alla sommità: non cercarlo con il GPS durante la sosta.',
    ],
    howToContinue: ['Dopo le foto torna al parcheggio per la stessa pista.', 'Poi apri la navigazione stradale verso il parcheggio alla diga di Malga Bissina (≈8 km).'],
    alternatives: ['Parcheggio nord (≈860 m a piedi).', 'Se i tempi sono stretti: riduci la sosta a 20 minuti o salta il Leno (vedi Programma).'],
    sourceIds: ['osm-overture', 'campiglio-leno', 'calcolopercorso-trento-pergine', 'motorrad-daone'],
    validation: 'source-derived',
  },
  {
    id: 's3-diga',
    order: 3,
    kind: 'drive',
    mode: 'auto',
    name: 'Parcheggio presso la diga di Malga Bissina',
    summary: 'Circa 8 km di strada di montagna (SP27) fino al parcheggio accanto al Bar alla Diga, a ≈1.800 m: la strada asfaltata finisce qui. Preparazione al trekking (≈15 minuti).',
    placeId: 'park-dam',
    driveLeg: 'boazzo-dam',
    waymarks: ['SP27 fino al lago di Bissina'],
    whatToSee: ['La diga e il lago appena sopra i parcheggi'],
    difficulties: [
      'Ultimo tratto stretto e ripido, a senso alternato (fonte secondaria).',
      'Accesso regolato e/o parcheggio a pagamento (≈4–6 €): non confermato per ottobre 2026. Portare monete.',
      'Se i parcheggi alla diga sono pieni potrebbero indirizzare a parcheggi più a valle con navetta (informazione non confermata).',
    ],
    howToContinue: ['Prepara zaini, strati e acqua; servizi igienici mappati tra i due parcheggi (non verificati).', 'Imposta la fase "Trekking" e inizia la pista verso nord-est, sul lato nord-ovest del lago.'],
    alternatives: ['Parcheggio alto (≈50 m di dislivello in più, accesso più stretto).'],
    sourceIds: ['osm-overture', 'campiglio-parcheggio', 'ladige-250', 'park4night-bissina'],
    validation: 'source-derived',
  },
  {
    id: 's4-lago',
    order: 4,
    kind: 'walk',
    mode: 'piedi',
    name: 'Percorso lungo il Lago di Malga Bissina',
    summary: 'Pista sterrata larga lungo la sponda nord-ovest del lago per circa 3,5 km, quasi pianeggiante e in leggera salita nel finale, fino a Malga Breguzzo.',
    placeId: 'lake-bissina',
    routeId: 'route-out',
    leg: { fromM: 'start', toM: 3494 },
    waymarks: ['Pista forestale (cartello di divieto ai veicoli, da fonte secondaria)', 'Il SAT 240 viene citato per lo stacco al primo tornante sotto il parcheggio: non confermato'],
    whatToSee: ['La diga (a ≈230 m dall’inizio)', 'Una piccola cascata sul rio che sfocia nel lago, presso un breve ponte (≈750 m)', 'Il lago sul lato destro'],
    difficulties: ['Nessuna difficoltà tecnica attesa (E).', 'Fondo sterrato; possibili tratti bagnati o ghiacciati all’ombra.'],
    howToContinue: ['Resta sempre sulla pista principale vicino alla riva.', 'Dopo ≈3,5 km la pista arriva a Malga Breguzzo, dove il sentiero si divide.'],
    alternatives: ['Se i tempi sono compatibili solo con una meta più vicina, la pista del lago fino a Malga Breguzzo è già una buona escursione (≈50 min all’andata).'],
    sourceIds: ['osm-overture', 'suedtirol-live-rifugio', 'campiglio-rifugio'],
    validation: 'source-derived',
  },
  {
    id: 's5-breguzzo',
    order: 5,
    kind: 'stop',
    mode: 'sosta',
    name: 'Malga Breguzzo',
    summary: 'Struttura a ≈1.810 m, non più in uso secondo una fonte secondaria (nessun servizio). Qui il sentiero verso il rifugio si divide in due sponde del Chiese: l’app segue la sponda nord-ovest.',
    placeId: 'malga-breguzzo',
    routeId: 'route-out',
    leg: { fromM: 3494, toM: 3494 },
    fixedMin: { nominal: 5, min: 0, max: 10, basis: 'estimated' },
    waymarks: ['SAT 240 oltre Malga Breguzzo (fonte secondaria)'],
    whatToSee: ['L’inizio della Val di Fumo', 'Il torrente Chiese'],
    difficulties: ['Bivio tra due sponde: seguire la traccia evidenziata e i segnavia bianco-rossi.', 'Sulla sponda sud-est l’app mostra una variante (consigliata solo per il ritorno e solo se hai buona visibilità).'],
    howToContinue: ['Prosegui verso nord-est lungo la sponda nord-ovest, vicino al torrente.'],
    alternatives: ['Sponda opposta (sud-est): variante di ≈6,15 km, +49 m rispetto alla principale.', 'Una fonte secondaria dice che la maggior parte dei camminatori sceglie un lato: "sinistra" è ambiguo, usa i punti cardinali.'],
    sourceIds: ['osm-overture', 'campiglio-rifugio', 'italia-val-di-fumo'],
    validation: 'source-derived',
  },
  {
    id: 's6-chiese',
    order: 6,
    kind: 'walk',
    mode: 'piedi',
    name: 'Cascata del torrente Chiese',
    summary: 'A ≈145 m da Malga Breguzzo, a pochi metri dalla traccia, c’è un nodo OSM di cascata sul Chiese. Fonti secondarie citano anche una cascatella prima di un ponte in legno più vicino al rifugio (non localizzata).',
    placeId: 'fall-chiese',
    routeId: 'route-out',
    leg: { fromM: 3494, toM: 3639 },
    fixedMin: { nominal: 10, min: 5, max: 20, basis: 'estimated' },
    waymarks: ['SAT 240'],
    whatToSee: ['Il Chiese che scende verso la piana del lago'],
    difficulties: ['Non avvicinarsi al bordo: rocce bagnate e scivolose.'],
    howToContinue: ['Prosegui sulla traccia verso nord-est (sponda nord-ovest).'],
    alternatives: ['Se il tempo è poco, puoi fermarti qui o a Malga Breguzzo e tornare.'],
    sourceIds: ['osm-overture', 'campiglio-rifugio', 'komoot-chiese'],
    validation: 'source-derived',
  },
  {
    id: 's7-rifugio',
    order: 7,
    kind: 'walk',
    mode: 'piedi',
    name: 'Rifugio Val di Fumo',
    summary:
      'Ultimi ≈2,5 km sulla sponda nord-ovest con tre brevi passerelle (l’ultima è il ponte di Malga Val di Fumo), poi ≈400 m per il colle del rifugio (SAT 222 secondo una fonte secondaria). Il rifugio potrebbe essere aperto o appena chiuso: confermare.',
    placeId: 'rifugio-val-di-fumo',
    routeId: 'route-out',
    leg: { fromM: 3639, toM: 'end' },
    waymarks: ['SAT 240 lungo il Chiese', 'SAT 222 per l’ultimo tratto verso il colle del rifugio (fonte secondaria, da verificare)'],
    whatToSee: ['Il fondovalle della Val di Fumo', 'Malga Val di Fumo e il ponte sul Chiese'],
    difficulties: ['Passerelle e ponti di pochi metri (5 tratti-ponte sull’andata nel dato OSM): bagnate o gelate possono essere scivolose.', 'Eventuali guadi non sono rappresentati nei dati.'],
    howToContinue: ['Al ponte di Malga Val di Fumo la traccia attraversa il torrente e sale per ≈400 m al rifugio.', 'Fermati qui per il pranzo al sacco: non contare sul rifugio per acqua o cibo.'],
    alternatives: ['Piana della Val di Fumo (oltre il rifugio): deviazione facoltativa, senza traccia guidata.', 'NON incluso: Bivacco Eugenio Segalla e percorsi alpinistici.'],
    sourceIds: ['osm-overture', 'vt-rifugio', 'planetmountain-rifugio', 'montagnatv-gestore', 'ildolomiti-itinerario', 'italia-val-di-fumo'],
    validation: 'source-derived',
  },
  {
    id: 's8-ritorno',
    order: 8,
    kind: 'walk-back',
    mode: 'piedi',
    name: 'Ritorno al parcheggio della diga',
    summary: 'Stessa traccia dell’andata (già vista, più semplice), ≈6,1 km in leggera discesa. Inizio del ritorno entro l’ultimo orario prudenziale mostrato in Programma.',
    placeId: 'park-dam',
    routeId: 'route-back',
    leg: { fromM: 'start', toM: 'end' },
    waymarks: ['Stessi segnavia dell’andata, in senso inverso'],
    whatToSee: ['La luce della tarda mattinata sul lago'],
    difficulties: ['In valle il sole diretto scompare molto prima del tramonto: nel pomeriggio fa più freddo e il fondo può ghiacciare.', 'Non allungare con deviazioni se il margine di luce è ridotto.'],
    howToContinue: ['Segui la traccia di ritorno (stessa geometria).', 'Variante per la sponda opposta tra Malga Val di Fumo e Malga Breguzzo: solo con buona visibilità.'],
    alternatives: ['Variante sponda sud-est (+49 m, anello).'],
    sourceIds: ['osm-overture'],
    validation: 'source-derived',
  },
  {
    id: 's9-rientro',
    order: 9,
    kind: 'drive-back',
    mode: 'auto',
    name: 'Rientro in auto verso Pergine',
    summary: 'Circa 91 km (SP27 → SS237 → SS45bis → SS47). Guida con attenzione: al crepuscolo le strade di valle sono frequentate dalla fauna.',
    placeId: 'pergine',
    driveLeg: 'dam-pergine',
    waymarks: [],
    whatToSee: [],
    difficulties: ['Strada di montagna stretta nel primo tratto; possibile traffico di rientro.'],
    howToContinue: ['Apri la navigazione stradale verso Pergine Valsugana.'],
    alternatives: [],
    sourceIds: ['osm-overture'],
    validation: 'source-derived',
  },
];

/** Punti d'interesse (Esplora). `placeId` → posizione in points.json. */
export type PoiContent = Omit<PointOfInterest, 'coordinates' | 'osmIds' | 'provenance' | 'elevationM' | 'onRoute' | 'detourM'> & {
  placeId: string;
  /** Percorso rispetto al quale si calcola "sul percorso / con deviazione". */
  relativeTo: 'route-out' | 'walk-leno';
  sourceIds: string[];
  validation: ValidationStatus;
};

export const POI_CONTENT: PoiContent[] = [
  {
    id: 'poi-leno',
    placeId: 'bridge-leno',
    relativeTo: 'walk-leno',
    name: 'Cascata del Leno',
    type: 'waterfall',
    category: 'cascata',
    description:
      'Cascata soprannominata "Regina del Lago" da una fonte secondaria, che scende nel Lago di Boazzo; in inverno ghiaccia. La sosta fotografica è al ponte alla base, a ≈345 m dal parcheggio della Centrale (≈5 minuti a piedi secondo la fonte).',
    highlights: ['Vista dal basso, con il lago in primo piano', 'In inverno la cascata ghiaccia e attira arrampicatori su ghiaccio (fonte secondaria)'],
    photoTips: [
      'Suggerimenti generali, non verificati sul posto: tempi di posa lunghi (¼–½ s) appoggiando il telefono per l’effetto "seta".',
      'Stima dal rilievo: il sole diretto raggiunge il parcheggio solo dopo le 09:15 circa; prima la luce è morbida e uniforme.',
    ],
    warnings: ['Non salire alla sommità (ripido, +250 m, fuori programma).', 'Rocce bagnate: restare sul percorso.'],
    photos: [],
    sourceIds: ['campiglio-leno', 'osm-overture'],
    validation: 'source-derived',
  },
  {
    id: 'poi-lago-boazzo',
    placeId: 'lake-boazzo',
    relativeTo: 'walk-leno',
    name: 'Lago di Boazzo',
    type: 'lake',
    category: 'lago',
    description: 'Bacino artificiale a ≈1.200 m lungo la strada per Malga Bissina. Una pista sterrata costeggia la riva ovest, la strada provinciale quella est.',
    highlights: ['Specchio d’acqua con la parete della cascata sul fondo'],
    photoTips: ['Dalla riva ovest, controluce al mattino: attenzione alle sovraesposizioni (suggerimento generale).'],
    warnings: ['Non entrare nelle zone recintate della diga.'],
    photos: [],
    sourceIds: ['osm-overture'],
    validation: 'source-derived',
  },
  {
    id: 'poi-diga',
    placeId: 'dam-bissina',
    relativeTo: 'route-out',
    name: 'Diga di Malga Bissina',
    type: 'dam',
    category: 'diga',
    description: 'Sbarramento idroelettrico che chiude il lago a ≈1.800 m. Si vede dal parcheggio e dall’inizio della pista; la sommità sarebbe visitabile solo in alcuni giorni (fonte secondaria, non confermato).',
    highlights: ['Veduta lungo tutto il lago verso nord-est'],
    photoTips: ['Per una vista d’insieme del lago, salire di qualche metro dal lato ovest della diga (suggerimento generale).'],
    warnings: ['Rispettare recinzioni e cartelli: è un impianto in esercizio.'],
    photos: [],
    sourceIds: ['osm-overture', 'komoot-bissina'],
    validation: 'source-derived',
  },
  {
    id: 'poi-lago-bissina',
    placeId: 'lake-bissina',
    relativeTo: 'route-out',
    name: 'Lago di Malga Bissina',
    type: 'lake',
    category: 'lago',
    description: 'Lago artificiale lungo circa 3 km, costeggiato dalla pista per circa 3,5 km. Sullo sfondo, le cime dell’Adamello (nomi dalle mappe OSM: Cima Bissina, Cima Cop di Breguzzo).',
    highlights: ['Pista quasi pianeggiante: panorama continuo', 'Riflessi nelle ore senza vento'],
    photoTips: ['Al mattino il sole è alle spalle del versante est: luce migliore sulla sponda opposta (stima dal rilievo, da verificare).'],
    warnings: ['Nessuna sosta su pendii instabili o a ridosso della riva.'],
    photos: [],
    sourceIds: ['osm-overture'],
    validation: 'source-derived',
  },
  {
    id: 'poi-breguzzo',
    placeId: 'malga-breguzzo',
    relativeTo: 'route-out',
    name: 'Malga Breguzzo',
    type: 'malga',
    category: 'malga',
    description: 'Fine della pista del lago (≈1.810 m): una fonte la descrive come struttura non più in uso. Qui il sentiero si divide in due sponde del Chiese.',
    highlights: ['Bivio tra sponda nord-ovest e sud-est', 'Primo sguardo verso la Val di Fumo'],
    photoTips: ['Guardare indietro verso il lago: miglior punto per una foto d’insieme a metà percorso (suggerimento generale).'],
    warnings: ['Nessun servizio: acqua e cibo da portare con sé.'],
    photos: [],
    sourceIds: ['osm-overture', 'campiglio-rifugio', 'italia-val-di-fumo'],
    validation: 'source-derived',
  },
  {
    id: 'poi-chiese',
    placeId: 'fall-chiese',
    relativeTo: 'route-out',
    name: 'Cascata del Chiese',
    type: 'waterfall',
    category: 'cascata',
    description: 'Cascata sul torrente Chiese nei pressi di Malga Breguzzo (un solo nodo OSM, senza nome). Altre fonti citano una cascatella prima di un ponte in legno più vicino al rifugio.',
    highlights: ['A pochi metri dal sentiero'],
    photoTips: ['Posa lunga appoggiando il telefono su un sasso (suggerimento generale).'],
    warnings: ['Rocce scivolose e bagnate: non avvicinarsi al bordo.'],
    photos: [],
    sourceIds: ['osm-overture', 'campiglio-rifugio', 'komoot-chiese'],
    validation: 'source-derived',
  },
  {
    id: 'poi-paesaggio',
    placeId: 'piana-val-di-fumo',
    relativeTo: 'route-out',
    name: 'Paesaggio della Val di Fumo',
    type: 'landscape',
    category: 'paesaggio',
    description:
      'Una fonte secondaria definisce la Val di Fumo la più lunga valle del gruppo Adamello-Presanella. Dal rifugio si apre il fondovalle; la Piana della Val di Fumo è oltre il rifugio (deviazione facoltativa, senza traccia guidata).',
    highlights: ['Fondovalle ampio con il torrente a meandri', 'Cime e ghiacciai nei dati OSM (Cop di Breguzzo, Corno di Cavento, Monte Fumo)'],
    photoTips: ['Dal colle del rifugio guardando verso nord (suggerimento generale). Il sole diretto lascia il rifugio dopo le 17:30 circa (stima).'],
    warnings: ['Oltre il rifugio i sentieri diventano alpinistici: non inclusi.'],
    photos: [],
    sourceIds: ['suedtirol-live-rifugio', 'osm-overture'],
    validation: 'source-derived',
  },
  {
    id: 'poi-rifugio',
    placeId: 'rifugio-val-di-fumo',
    relativeTo: 'route-out',
    name: 'Rifugio Val di Fumo',
    type: 'hut',
    category: 'rifugio',
    description:
      'Rifugio SAT a ≈1.900 m, solo a piedi; nuova gestione dal 2026; 57 posti letto di cui 6 nel locale invernale (fonte secondaria). Apertura il 9 ottobre da confermare: Visit Trentino indica fine maggio – seconda domenica di ottobre (11/10/2026), altre schede 20 giugno – 30 settembre.',
    highlights: ['Meta dell’escursione', 'Fontana mappata accanto al rifugio (non verificata)'],
    photoTips: ['Il sole diretto arriva al rifugio dopo le 10:30 circa (stima dal rilievo).'],
    warnings: ['Non fare affidamento su ristoro, acqua o riparo: portare pranzo, acqua e strati.', 'Telefonare per confermare apertura e locale invernale.'],
    photos: [],
    sourceIds: ['vt-rifugio', 'planetmountain-rifugio', 'bergwelten-rifugio', 'montagnatv-gestore', 'ladige-gestrice', 'ildolomiti-sponsored', 'italia-val-di-fumo'],
    validation: 'source-derived',
  },
];
