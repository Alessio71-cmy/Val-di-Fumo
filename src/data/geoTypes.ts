// Tipi dei file generati dalla pipeline (public/data/geo/*.json). Non modificare a mano i file generati.

export interface GeoMeta {
  generatedAt: string;
  osmRelease: string;
  demZoom: number;
  retrievedAt: string;
}

export interface RawRouteSegment {
  from: number;
  to: number;
  cls: string;
  osm: string[];
  bridge: boolean;
  surface: string[];
  upd?: string | null;
}

export interface RawRoute {
  id: string;
  name: string;
  direction: 'outbound' | 'return';
  kind: 'main' | 'variant' | 'walk' | 'optional-steep';
  lengthM: number;
  ascentM: number;
  descentM: number;
  minEleM: number;
  maxEleM: number;
  paceFactor: number;
  toblerMin: number;
  toblerMinRev: number;
  toblerRev: Array<[number, number]>;
  tobler: Array<[number, number]>;
  /** [lon, lat, quota, progressiva] */
  coords: Array<[number, number, number, number]>;
  profile: Array<[number, number]>;
  segments: RawRouteSegment[];
  osmEditedRange?: [string | null, string | null];
  replaces?: { from: string; to: string };
  overlapWithMain?: number;
  from?: string;
  to?: string;
}

export interface RawBridge {
  fromM: number;
  toM: number;
  lon: number;
  lat: number;
  osm: string[];
  lengthM: number;
}

export interface RawJunction {
  chainM: number;
  lon: number;
  lat: number;
  branches: Array<{ cls: string; lengthM: number; bearing: number; dir: string; osm: string[]; bridge: boolean }>;
}

export interface RoutesFile {
  meta: GeoMeta;
  routes: Record<string, RawRoute>;
  bridges: RawBridge[];
  junctions: RawJunction[];
  sections: { damToBreguzzoM: number; breguzzoToRifugioM: number };
}

export interface RawPoint {
  id: string;
  osm: string[];
  osmUpdated?: string | null;
  name: string | null;
  cls: string | null;
  kind: string | null;
  lon: number;
  lat: number;
  eleDem: number | null;
  chainOut?: number;
  offOutM?: number;
  chainOutBank?: number;
  offOutBankM?: number;
  chainLeno?: number;
  offLenoM?: number;
  distFromFallNodeM?: number;
}

export interface PointsFile {
  meta: GeoMeta;
  points: Record<string, RawPoint>;
}

export interface HorizonFile {
  method: string;
  note: string;
  points: Record<string, { lon: number; lat: number; eleDem: number; azStepDeg: number; elev: number[] }>;
}

export interface DriveLeg {
  from: string;
  to: string;
  snapM: [number, number];
  distanceKm: number;
  modelMinutes: number;
  nominalMinutes: number;
  rangeMinutes: [number, number];
  roads: Array<{ label: string; km: number }>;
  basis: 'estimated';
}

export interface DriveFile {
  meta: { generatedAt: string; osmRelease: string; avgKmhAssumed: Record<string, number>; note: string };
  legs: Record<'pergine-boazzo' | 'boazzo-dam' | 'dam-pergine', DriveLeg>;
}

export interface ValidationFile {
  meta: GeoMeta;
  checks: Array<{ check: string; ok: boolean; value?: number; expected?: [number, number]; note?: string; distM?: number }>;
}

export interface MapMeta {
  image: string;
  imageSize: [number, number];
  /** NO, NE, SE, SO come [lon, lat] */
  coordinates: [[number, number], [number, number], [number, number], [number, number]];
  bounds: [number, number, number, number];
  contourStepM: number;
  demPixelGroundM: number;
  elevationRangeM: [number, number];
  osmRelease: string;
  retrievedAt: string;
  attribution: string[];
}

export interface MapLabel {
  n: string;
  t: 'peak' | 'saddle' | 'hut' | 'information' | 'dam' | 'lake';
  x: number;
  y: number;
  e?: number;
  osm?: string;
}
