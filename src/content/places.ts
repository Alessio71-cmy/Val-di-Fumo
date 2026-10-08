import type { GeoType, Reliability, ValidationStatus } from '../domain/types';

/**
 * Testi dei luoghi. Le coordinate NON stanno qui: la chiave (`id`) corrisponde a `public/data/geo/points.json`.
 * Ogni testo è basato su: (a) dati OSM, (b) fonti secondarie lette tramite sintesi di ricerca (vedi SOURCES.md).
 * Dove un'informazione viene da una fonte secondaria lo si scrive nel testo.
 */
export interface PlaceDef {
  id: string;
  name: string;
  type: GeoType;
  description: string;
  sourceIds: string[];
  validation: ValidationStatus;
  reliability: Reliability;
  notes?: string;
}

export const PLACE_DEFS: PlaceDef[] = [
  {
    id: 'pergine',
    name: 'Pergine Valsugana',
    type: 'town',
    description: 'Punto di partenza in auto (finestra 07:00–08:00). La posizione è il punto di etichetta della città in OpenStreetMap, non il tuo punto di partenza reale.',
    sourceIds: ['osm-overture'],
    validation: 'source-derived',
    reliability: 'media',
  },
  {
    id: 'park-boazzo-centrale',
    name: 'Parcheggio presso la Centrale di Boazzo',
    type: 'parking',
    description:
      'Parcheggio sulla sponda ovest del Lago di Boazzo, vicino alla centrale idroelettrica. Da qui una pista sterrata porta in circa 345 m al ponte alla base della Cascata del Leno. Sulla strada oltre il parcheggio una fonte secondaria cita un cartello di divieto di transito: lasciare l’auto prima.',
    sourceIds: ['osm-overture', 'campiglio-leno', 'suedtirol-live-rifugio'],
    validation: 'source-derived',
    reliability: 'media',
    notes: 'Non è verificato che il navigatore arrivi fino a qui in auto: l’ultimo tratto è una strada stretta.',
  },
  {
    id: 'park-boazzo-nord',
    name: 'Parcheggio nord di Boazzo',
    type: 'parking',
    description: 'Alternativa a nord del lago: la passeggiata fino al ponte alla base della cascata diventa di circa 860 m.',
    sourceIds: ['osm-overture'],
    validation: 'source-derived',
    reliability: 'media',
  },
  {
    id: 'bridge-leno',
    name: 'Ponte alla base della Cascata del Leno',
    type: 'bridge',
    description:
      'Tratto marcato come ponte nel dato OSM, il più vicino al nodo della cascata (≈180 m): punto scelto per la sosta fotografica con vista dal basso. È un’inferenza dai dati, non un punto confermato: verificare in loco.',
    sourceIds: ['osm-overture', 'campiglio-leno'],
    validation: 'source-derived',
    reliability: 'bassa',
    notes: 'Una fonte secondaria parla di "un ponte alla base della cascata" a pochi minuti dal parcheggio.',
  },
  {
    id: 'fall-leno',
    name: 'Cascata del Leno (nodo OSM alla sommità)',
    type: 'waterfall',
    description:
      'Il nodo OSM della cascata è nella parte alta (quota DEM ≈1.430 m, ≈190 m sopra il parcheggio): arrivarci richiede circa 1,15 km di salita ripida (+250 m circa). NON è nel programma. Una fonte secondaria indica un salto di circa 150 m (un altro elenco: 300 m).',
    sourceIds: ['osm-overture', 'dem-terrarium', 'campiglio-leno'],
    validation: 'source-derived',
    reliability: 'media',
  },
  {
    id: 'view-leno',
    name: 'Punto panoramico presso la sommità della cascata',
    type: 'viewpoint',
    description: 'Punto panoramico mappato in OSM accanto al nodo della cascata (parte alta).',
    sourceIds: ['osm-overture'],
    validation: 'source-derived',
    reliability: 'bassa',
  },
  {
    id: 'lake-boazzo',
    name: 'Lago di Malga Boazzo',
    type: 'lake',
    description: 'Bacino artificiale a ≈1.200 m; la strada provinciale (SP27) corre sul lato est, una pista sterrata sul lato ovest.',
    sourceIds: ['osm-overture', 'dem-terrarium'],
    validation: 'source-derived',
    reliability: 'media',
  },
  {
    id: 'dam-boazzo',
    name: 'Diga di Malga Boazzo',
    type: 'dam',
    description: 'Sbarramento a sud del Lago di Boazzo.',
    sourceIds: ['osm-overture'],
    validation: 'source-derived',
    reliability: 'media',
  },
  {
    id: 'water-boazzo',
    name: 'Punto acqua (Boazzo)',
    type: 'fountain',
    description: 'Punto acqua mappato in OSM sul percorso stradale. Potabilità non verificata.',
    sourceIds: ['osm-overture'],
    validation: 'unverified',
    reliability: 'bassa',
  },
  {
    id: 'park-dam',
    name: 'Parcheggio presso la diga di Malga Bissina',
    type: 'parking',
    description:
      'Area di parcheggio accanto al Bar alla Diga, a ≈1.800 m: la strada asfaltata (SP27) finisce qui. Esiste un secondo parcheggio più in alto. Possibili accesso regolato, tariffa e orari di presidio: non confermati per ottobre 2026.',
    sourceIds: ['osm-overture', 'campiglio-parcheggio', 'ladige-250', 'park4night-bissina'],
    validation: 'source-derived',
    reliability: 'media',
    notes: 'Portare monete (una fonte del 2020 cita un parcometro a sole monete).',
  },
  {
    id: 'park-dam-alt',
    name: 'Parcheggio alto presso la diga',
    type: 'parking',
    description: 'Secondo parcheggio ≈ 50 m più in alto (quota DEM), a ≈270 m dall’inizio della pista. L’ultimo tratto d’accesso è descritto come ripido e stretto, a senso alternato (fonte secondaria).',
    sourceIds: ['osm-overture', 'campiglio-parcheggio'],
    validation: 'source-derived',
    reliability: 'bassa',
  },
  {
    id: 'toilets-dam',
    name: 'Servizi igienici presso la diga',
    type: 'toilets',
    description: 'Servizi mappati in OSM tra i due parcheggi. Apertura e stato non verificati.',
    sourceIds: ['osm-overture'],
    validation: 'unverified',
    reliability: 'bassa',
  },
  {
    id: 'dam-bissina',
    name: 'Diga di Malga Bissina',
    type: 'dam',
    description: 'Sbarramento del lago, a ≈230 m dall’inizio della pista (vista dal percorso, ≈390 m dal centro della diga). Una fonte secondaria segnala che la sommità è visitabile solo in alcuni giorni.',
    sourceIds: ['osm-overture', 'komoot-bissina'],
    validation: 'source-derived',
    reliability: 'media',
  },
  {
    id: 'fall-lakeside',
    name: 'Cascatella sul rio presso la pista del lago',
    type: 'waterfall',
    description: 'Piccola cascata senza nome in OSM sul rio che sfocia nel lago, vicino a un breve ponte sulla pista (≈750 m dal parcheggio).',
    sourceIds: ['osm-overture'],
    validation: 'source-derived',
    reliability: 'bassa',
  },
  {
    id: 'lake-bissina',
    name: 'Lago di Malga Bissina',
    type: 'lake',
    description: 'Lago artificiale costeggiato dalla pista sulla sponda nord-ovest per circa 3,5 km, in leggera salita fino a Malga Breguzzo.',
    sourceIds: ['osm-overture'],
    validation: 'source-derived',
    reliability: 'media',
  },
  {
    id: 'malga-breguzzo',
    name: 'Malga Breguzzo',
    type: 'malga',
    description:
      'Fine della pista del lago (≈1.810 m da DEM; 1.826 m secondo una fonte secondaria). Una fonte indica la malga come struttura non più in uso, quindi senza servizi. Qui il sentiero verso il rifugio si divide in due: sponda nord-ovest e sponda sud-est del Chiese.',
    sourceIds: ['osm-overture', 'campiglio-rifugio', 'italia-val-di-fumo'],
    validation: 'source-derived',
    reliability: 'media',
  },
  {
    id: 'sign-breguzzo',
    name: 'Tabella segnavia a Malga Breguzzo (OSM)',
    type: 'junction',
    description: 'Punto informativo mappato in OSM (probabile tabella segnavia).',
    sourceIds: ['osm-overture'],
    validation: 'source-derived',
    reliability: 'bassa',
  },
  {
    id: 'fall-chiese',
    name: 'Cascata sul torrente Chiese',
    type: 'waterfall',
    description:
      'Nodo OSM senza nome a ≈145 m da Malga Breguzzo, a ≈20 m dalla traccia. Fonti secondarie citano una cascata presso Malga Breguzzo all’inizio della Val di Fumo e una cascatella prima di un ponte in legno più vicino al rifugio (non localizzata).',
    sourceIds: ['osm-overture', 'campiglio-rifugio', 'komoot-chiese'],
    validation: 'source-derived',
    reliability: 'bassa',
  },
  {
    id: 'malga-val-di-fumo',
    name: 'Malga Val di Fumo (ponte e bivio)',
    type: 'junction',
    description: 'Punto informativo OSM con ponte sul Chiese: qui le due sponde si ricongiungono e la traccia attraversa il torrente per salire al colle del rifugio (≈400 m). Altri sentieri si staccano da questo punto.',
    sourceIds: ['osm-overture'],
    validation: 'source-derived',
    reliability: 'media',
  },
  {
    id: 'rifugio-val-di-fumo',
    name: 'Rifugio Val di Fumo (SAT)',
    type: 'hut',
    description:
      'Rifugio SAT a ≈1.900 m (DEM 1.896 m; fonti 1.887–1.918 m), raggiungibile solo a piedi. Nel 2026 è passato a una nuova gestione. 57 posti letto di cui 6 nel locale invernale (fonte secondaria). Apertura il 9 ottobre da CONFERMARE.',
    sourceIds: ['osm-overture', 'vt-rifugio', 'planetmountain-rifugio', 'montagnatv-gestore', 'ladige-gestrice', 'italia-val-di-fumo'],
    validation: 'source-derived',
    reliability: 'media',
    notes: 'Apertura: Visit Trentino fine maggio – 2ª domenica di ottobre (11/10/2026); altre schede 20 giugno – 30 settembre.',
  },
  {
    id: 'fountain-rifugio',
    name: 'Fontana presso il rifugio',
    type: 'fountain',
    description: 'Punto acqua mappato accanto al rifugio. Potabilità e disponibilità non verificate: non contarci.',
    sourceIds: ['osm-overture'],
    validation: 'unverified',
    reliability: 'bassa',
  },
  {
    id: 'piana-val-di-fumo',
    name: 'Piana della Val di Fumo',
    type: 'landscape',
    description: 'Fondovalle pianeggiante oltre il rifugio (punto informativo OSM a ≈740 m in linea d’aria). Deviazione facoltativa, senza traccia guidata.',
    sourceIds: ['osm-overture', 'suedtirol-live-rifugio'],
    validation: 'source-derived',
    reliability: 'bassa',
  },
];

export const PLACE_BY_ID: Record<string, PlaceDef> = Object.fromEntries(PLACE_DEFS.map((p) => [p.id, p]));
