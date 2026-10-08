// Modello dati dell'app. Le coordinate NON vengono mai digitate nei contenuti: derivano da public/data/geo/*.json
// (pipeline Python da dati OSM) e sono referenziate per chiave.

export type LngLat = [lon: number, lat: number];

/** Stato di validazione (vedi docs/01-research-report.md §1.3). */
export type ValidationStatus =
  | 'field-verified'
  | 'official-verified'
  | 'cross-checked'
  | 'source-derived'
  | 'estimated'
  | 'unverified';

export type Reliability = 'alta' | 'media' | 'bassa';

export type SourceKind = 'open-data' | 'official' | 'secondary' | 'secondary-search' | 'computed';
export type AccessMode = 'direct' | 'search-summary' | 'blocked';

export interface Source {
  id: string;
  title: string;
  publisher: string;
  url: string;
  license: string;
  accessedAt: string; // YYYY-MM-DD
  kind: SourceKind;
  accessMode: AccessMode;
  reliability: Reliability;
  usedFor: string;
  notes: string;
}

/** Provenienza comune a ogni elemento mostrato. */
export interface Provenance {
  sourceIds: string[];
  validation: ValidationStatus;
  /** Data (YYYY-MM-DD) dell'ultima verifica effettuata da chi ha costruito l'app. */
  lastVerified: string;
  reliability: Reliability;
  /** Data (YYYY-MM-DD) dell'ultima modifica del dato OSM, se nota. */
  sourceUpdated?: string | null;
  notes?: string;
}

export type GeoType =
  | 'town'
  | 'parking'
  | 'waterfall'
  | 'dam'
  | 'lake'
  | 'hut'
  | 'malga'
  | 'bridge'
  | 'junction'
  | 'fountain'
  | 'viewpoint'
  | 'landscape'
  | 'toilets';

export interface GeoEntity {
  /** ID stabile (chiave in points.json). */
  id: string;
  name: string;
  type: GeoType;
  coordinates: LngLat;
  /** Quota stimata da DEM (m), se disponibile. */
  elevationM?: number;
  description: string;
  provenance: Provenance;
  /** ID OSM (way/node/relation@versione). */
  osmIds: string[];
}

export interface Waypoint extends GeoEntity {
  /** Progressiva (m) lungo il percorso principale di andata, se il punto è sul percorso. */
  chainOutM?: number;
  /** Distanza (m) dalla traccia di andata. */
  offRouteM?: number;
  /** Progressiva e distanza dalla traccia per ciascun percorso (per ordine dei punti e "prossimo waypoint"). */
  routeRefs?: Record<string, { chainM: number; offM: number }>;
}

export interface Parking extends GeoEntity {
  type: 'parking';
  /** Informazioni su tariffe/accesso: sempre da verificare. */
  access: string[];
}

export interface PointOfInterest extends GeoEntity {
  category: 'cascata' | 'lago' | 'diga' | 'malga' | 'rifugio' | 'paesaggio';
  /** true = direttamente sul percorso; false = richiede deviazione. */
  onRoute: boolean;
  detourM?: number;
  photoTips: string[];
  highlights: string[];
  warnings: string[];
  photos: string[]; // vuoto: nessuna fotografia con licenza verificabile
}

export type Difficulty = 'T' | 'E' | 'EE' | 'unknown';

export interface RoutePoint {
  lon: number;
  lat: number;
  ele: number;
  chain: number;
}

export interface RouteSegmentInfo {
  from: number;
  to: number;
  cls: string;
  osm: string[];
  bridge: boolean;
  surface: string[];
  upd?: string | null;
}

export interface Route {
  id: string;
  name: string;
  direction: 'outbound' | 'return';
  kind: 'main' | 'variant' | 'walk' | 'optional-steep';
  /** Geometria [lon, lat]. */
  geometry: LngLat[];
  /** Quote stimate (m) per vertice. */
  elevations: number[];
  /** Progressive (m) per vertice. */
  chain: number[];
  lengthM: number;
  ascentM: number;
  descentM: number;
  minEleM: number;
  maxEleM: number;
  /** Tempo nominale di cammino (min), modello calibrato sulle fonti. */
  nominalMin: number;
  profile: Array<[chainM: number, eleM: number]>;
  /** Tempo cumulato nominale (min) lungo la progressiva. */
  timeAt: Array<[chainM: number, minutes: number]>;
  segments: RouteSegmentInfo[];
  waymarks: string[];
  gpxSource: string;
  difficulty: Difficulty;
  warnings: string[];
  provenance: Provenance;
  variantIds: string[];
  /** Per le varianti: tratto sostituito. */
  replaces?: { from: string; to: string };
  gpxFile?: string;
}

export type RouteVariant = Route;

export interface CriticalPoint {
  id: string;
  kind: 'bridge' | 'junction' | 'steep';
  routeId: string;
  chainM: number;
  coordinates: LngLat;
  label: string;
  detail: string;
  osmIds: string[];
  provenance: Provenance;
}

export interface Duration {
  /** Valore nominale in minuti. */
  nominal: number;
  min: number;
  max: number;
  basis: 'source' | 'estimated' | 'model';
}

export type StageKind = 'start' | 'drive' | 'stop' | 'walk' | 'rest' | 'walk-back' | 'drive-back';

export interface Stage {
  id: string;
  order: number;
  kind: StageKind;
  /** Modalità del tratto che porta a questa tappa: in auto, a piedi, oppure sosta. */
  mode: 'auto' | 'piedi' | 'sosta';
  name: string;
  summary: string;
  /** ID di un punto in points.json. */
  placeId: string;
  /** Percorso associato (per le tappe a piedi). */
  routeId?: string;
  /** Tratto del percorso (m di progressiva) coperto dalla tappa. */
  legM?: [fromM: number, toM: number];
  /** Distanza dalla tappa precedente (m). */
  distanceFromPrevM?: number;
  duration: Duration;
  waymarks: string[];
  whatToSee: string[];
  difficulties: string[];
  howToContinue: string[];
  alternatives: string[];
  sourceIds: string[];
  validation: ValidationStatus;
  lastVerified: string;
}

export type NoticeSeverity = 'info' | 'caution' | 'warning';

export interface SafetyNotice {
  id: string;
  severity: NoticeSeverity;
  title: string;
  body: string;
  appliesTo?: string[];
  sourceIds: string[];
  validation: ValidationStatus;
}

export interface OfflineResource {
  url: string;
  bytes: number;
  sha256: string;
  group: 'core' | 'map';
}

export interface OfflinePackage {
  buildId: string;
  packVersion: string;
  generatedAt: string;
  resources: OfflineResource[];
  totalBytes: number;
}

export interface GPSPosition {
  lat: number;
  lng: number;
  accuracyM: number;
  altitudeM?: number | null;
  headingDeg?: number | null;
  speedMps?: number | null;
  /** Epoch ms del fix, come riportato dal dispositivo. */
  timestamp: number;
}

export type ScheduleKind =
  | 'depart'
  | 'drive-boazzo'
  | 'leno-stop'
  | 'drive-dam'
  | 'prep'
  | 'hike-out'
  | 'lunch'
  | 'hike-back'
  | 'drive-home';

export type ScheduleEventId =
  | 'departed'
  | 'arrived-boazzo'
  | 'left-boazzo'
  | 'arrived-dam'
  | 'started-hike'
  | 'arrived-hut'
  | 'started-return'
  | 'back-at-car'
  | 'home';

export interface ScheduleEntry {
  id: ScheduleKind;
  label: string;
  /** Orario pianificato (minuti dalla mezzanotte locale della data dell'escursione). */
  plannedStartMin: number;
  plannedEndMin: number;
  durationMin: number;
  basis: 'source' | 'estimated' | 'model' | 'user';
  /** Orario effettivo registrato (minuti dalla mezzanotte), se presente. */
  actualStartMin?: number;
  actualEndMin?: number;
  /** Proiezione: pianificato corretto per il ritardo accumulato. */
  projectedStartMin: number;
  projectedEndMin: number;
  delayMin: number;
  status: 'future' | 'current' | 'done';
}

export interface Trip {
  id: string;
  title: string;
  /** Data dell'escursione (YYYY-MM-DD). */
  date: string;
  timezone: string;
  departureWindow: { earliestMin: number; latestMin: number; defaultMin: number };
  vehicle: 'car';
  stages: Stage[];
  routes: Record<string, Route>;
  pois: PointOfInterest[];
  parkings: Parking[];
  points: Record<string, Waypoint>;
  criticalPoints: CriticalPoint[];
  safetyNotices: SafetyNotice[];
  sources: Source[];
}
