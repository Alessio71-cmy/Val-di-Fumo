import type { DriveFile, HorizonFile, MapLabel, MapMeta, PointsFile, RoutesFile, ValidationFile } from './geoTypes';

export type Loaded<T> = { ok: true; data: T } | { ok: false; error: string };

export interface GeoBundle {
  points: Loaded<PointsFile>;
  routes: Loaded<RoutesFile>;
  horizon: Loaded<HorizonFile>;
  drive: Loaded<DriveFile>;
  validation: Loaded<ValidationFile>;
}

export const GEO_FILES = {
  points: 'data/geo/points.json',
  routes: 'data/geo/routes.json',
  horizon: 'data/geo/horizon.json',
  drive: 'data/geo/drive.json',
  validation: 'data/geo/validation.json',
} as const;

export function resolveUrl(path: string, base?: string): string {
  const b = base ?? (typeof document !== 'undefined' ? document.baseURI : 'http://localhost/');
  return new URL(path, b).toString();
}

async function getJson<T>(path: string, check: (x: unknown) => string | null, fetchImpl: typeof fetch, base?: string): Promise<Loaded<T>> {
  try {
    const res = await fetchImpl(resolveUrl(path, base));
    if (!res.ok) return { ok: false, error: `${path}: risposta ${res.status}` };
    const json: unknown = await res.json();
    const problem = check(json);
    if (problem) return { ok: false, error: `${path}: ${problem}` };
    return { ok: true, data: json as T };
  } catch (e) {
    return { ok: false, error: `${path}: ${e instanceof Error ? e.message : 'errore di rete/lettura'}` };
  }
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;

export function checkPoints(x: unknown): string | null {
  if (!isObj(x) || !isObj(x.points)) return 'formato non valido (points)';
  for (const [k, p] of Object.entries(x.points)) {
    if (!isObj(p) || typeof p.lon !== 'number' || typeof p.lat !== 'number') return `punto "${k}" senza coordinate`;
  }
  return null;
}

export function checkRoutes(x: unknown): string | null {
  if (!isObj(x) || !isObj(x.routes)) return 'formato non valido (routes)';
  const main = (x.routes as Record<string, unknown>)['route-out'];
  if (!isObj(main) || !Array.isArray(main.coords) || main.coords.length < 2) return 'manca la traccia principale "route-out"';
  for (const [k, r] of Object.entries(x.routes)) {
    if (!isObj(r) || !Array.isArray(r.coords) || r.coords.length < 2 || typeof r.lengthM !== 'number') return `percorso "${k}" incompleto`;
  }
  return null;
}

export async function loadGeo(fetchImpl: typeof fetch = fetch, base?: string): Promise<GeoBundle> {
  const [points, routes, horizon, drive, validation] = await Promise.all([
    getJson<PointsFile>(GEO_FILES.points, checkPoints, fetchImpl, base),
    getJson<RoutesFile>(GEO_FILES.routes, checkRoutes, fetchImpl, base),
    getJson<HorizonFile>(GEO_FILES.horizon, (x) => (isObj(x) && isObj(x.points) ? null : 'formato non valido'), fetchImpl, base),
    getJson<DriveFile>(GEO_FILES.drive, (x) => (isObj(x) && isObj(x.legs) ? null : 'formato non valido'), fetchImpl, base),
    getJson<ValidationFile>(GEO_FILES.validation, (x) => (isObj(x) && Array.isArray(x.checks) ? null : 'formato non valido'), fetchImpl, base),
  ]);
  return { points, routes, horizon, drive, validation };
}

export interface MapPack {
  meta: MapMeta;
  contours: GeoJSON.FeatureCollection;
  areas: GeoJSON.FeatureCollection;
  waterlines: GeoJSON.FeatureCollection;
  transport: GeoJSON.FeatureCollection;
  bridges: GeoJSON.FeatureCollection;
  labels: MapLabel[];
  /** URL (blob:) dell'ombreggiatura, già letta dalla cache locale. */
  hillshadeUrl: string;
}

export const MAP_FILES = {
  meta: 'data/map/map.json',
  contours: 'data/map/contours.geojson',
  areas: 'data/map/areas.geojson',
  waterlines: 'data/map/waterlines.geojson',
  transport: 'data/map/transport.geojson',
  bridges: 'data/map/bridges.geojson',
  labels: 'data/map/labels.json',
  hillshade: 'data/map/hillshade.webp',
} as const;

/** Legge tutto il pacchetto mappa dalla cache/rete. Se manca qualcosa restituisce l'errore (la mappa passa al fallback). */
export async function loadMapPack(fetchImpl: typeof fetch = fetch, base?: string): Promise<Loaded<MapPack>> {
  try {
    const get = async (p: string) => {
      const r = await fetchImpl(resolveUrl(p, base));
      if (!r.ok) throw new Error(`${p}: risposta ${r.status}`);
      return r;
    };
    const [meta, contours, areas, waterlines, transport, bridges, labels, img] = await Promise.all([
      get(MAP_FILES.meta).then((r) => r.json() as Promise<MapMeta>),
      get(MAP_FILES.contours).then((r) => r.json() as Promise<GeoJSON.FeatureCollection>),
      get(MAP_FILES.areas).then((r) => r.json() as Promise<GeoJSON.FeatureCollection>),
      get(MAP_FILES.waterlines).then((r) => r.json() as Promise<GeoJSON.FeatureCollection>),
      get(MAP_FILES.transport).then((r) => r.json() as Promise<GeoJSON.FeatureCollection>),
      get(MAP_FILES.bridges).then((r) => r.json() as Promise<GeoJSON.FeatureCollection>),
      get(MAP_FILES.labels).then((r) => r.json() as Promise<MapLabel[]>),
      get(MAP_FILES.hillshade).then((r) => r.blob()),
    ]);
    return { ok: true, data: { meta, contours, areas, waterlines, transport, bridges, labels, hillshadeUrl: URL.createObjectURL(img) } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'pacchetto mappa non disponibile' };
  }
}
