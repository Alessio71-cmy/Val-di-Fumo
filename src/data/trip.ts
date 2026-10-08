import { TRIP_CONFIG } from '../config/trip.config';
import { POI_CONTENT, STAGE_CONTENT, type StageContent } from '../content/itinerary';
import { PLACE_BY_ID, PLACE_DEFS } from '../content/places';
import { SAFETY_NOTICES } from '../content/safety';
import sourcesJson from '../content/sources.json';
import type {
  CriticalPoint,
  Duration,
  GeoType,
  LngLat,
  Parking,
  PointOfInterest,
  Provenance,
  Route,
  Source,
  Stage,
  Trip,
  Waypoint,
} from '../domain/types';
import type { GeoBundle } from './loader';
import { interpolate, minutesBetween } from './routeTime';
import type { RawPoint, RawRoute, RoutesFile } from './geoTypes';
import type { TurnaroundOption } from '../schedule/engine';

export const SOURCES = sourcesJson as Source[];
export const SOURCE_BY_ID: Record<string, Source> = Object.fromEntries(SOURCES.map((s) => [s.id, s]));

const VERIFIED_ON = '2026-10-08';

const ROUTE_WAYMARKS: Record<string, string[]> = {
  'route-out': [
    'Pista del lago: sterrata, con cartello di divieto ai veicoli (fonte secondaria)',
    'SAT 240 oltre Malga Breguzzo (fonte secondaria, da verificare)',
    'SAT 222 per il tratto finale verso il colle del rifugio (fonte secondaria, da verificare)',
  ],
  'route-out-bank': ['SAT 240 (sponda opposta del Chiese: segnavia non verificati)'],
  'route-back': ['Stessi segnavia dell’andata, in senso inverso'],
  'route-back-bank': ['SAT 240 (sponda opposta del Chiese: segnavia non verificati)'],
  'walk-leno': ['Pista lungo la sponda ovest del Lago di Boazzo (SAT 246 più a monte, fonte secondaria)'],
  'walk-leno-nord': ['Pista lungo la sponda ovest del Lago di Boazzo'],
  'walk-leno-top': ['Sentiero ripido con tornanti verso la sommità della cascata (SAT 246 secondo una fonte secondaria): NON incluso nel programma'],
};

const ROUTE_WARNINGS: Record<string, string[]> = {
  'route-out': [
    'Traccia derivata da OpenStreetMap: non rilevata sul campo né confrontata con la traccia ufficiale SAT.',
    'Possibili ghiaccio o fango; ponti e passerelle da affrontare con prudenza.',
  ],
  'walk-leno-top': ['Salita ripida (+250 m in 1,15 km): fuori programma.'],
};

function provenanceFor(raw: RawRoute): Provenance {
  return {
    sourceIds: ['osm-overture', 'dem-terrarium', 'suedtirol-live-rifugio', 'campiglio-rifugio', 'trentino-rifugio'],
    validation: 'source-derived',
    lastVerified: VERIFIED_ON,
    reliability: 'media',
    sourceUpdated: raw.osmEditedRange?.[1] ?? null,
    notes: 'Geometria OSM; controlli di coerenza su lunghezza, quote e tempi rispetto a fonti secondarie (vedi report).',
  };
}

const GPX_BY_ROUTE: Record<string, string> = {
  'route-out': 'data/gpx/andata-diga-rifugio.gpx',
  'route-back': 'data/gpx/ritorno-rifugio-diga.gpx',
  'route-out-bank': 'data/gpx/variante-sponda-opposta.gpx',
  'walk-leno': 'data/gpx/cascata-del-leno.gpx',
};

export function toRoute(raw: RawRoute): Route {
  const geometry: LngLat[] = raw.coords.map((c) => [c[0], c[1]]);
  return {
    id: raw.id,
    name: raw.name,
    direction: raw.direction,
    kind: raw.kind,
    geometry,
    elevations: raw.coords.map((c) => c[2]),
    chain: raw.coords.map((c) => c[3]),
    lengthM: raw.lengthM,
    ascentM: raw.ascentM,
    descentM: raw.descentM,
    minEleM: raw.minEleM,
    maxEleM: raw.maxEleM,
    nominalMin: raw.toblerMin,
    profile: raw.profile,
    timeAt: raw.tobler,
    segments: raw.segments,
    waymarks: ROUTE_WAYMARKS[raw.id] ?? [],
    gpxSource: 'OpenStreetMap (ODbL) tramite Overture Maps 2026-09-23.1; quote da EU-DEM (Terrain Tiles)',
    difficulty: raw.kind === 'optional-steep' ? 'unknown' : 'E',
    warnings: ROUTE_WARNINGS[raw.id] ?? [],
    provenance: provenanceFor(raw),
    variantIds: raw.id === 'route-out' ? ['route-out-bank'] : raw.id === 'route-back' ? ['route-back-bank'] : [],
    replaces: raw.replaces,
    gpxFile: GPX_BY_ROUTE[raw.id],
  };
}

function toWaypoint(raw: RawPoint): Waypoint | null {
  const def = PLACE_BY_ID[raw.id];
  if (!def) return null;
  const onRoute = raw.offOutM !== undefined && raw.offOutM <= 60;
  return {
    id: raw.id,
    name: def.name,
    type: def.type as GeoType,
    coordinates: [raw.lon, raw.lat],
    elevationM: raw.eleDem ?? undefined,
    description: def.description,
    osmIds: raw.osm,
    provenance: {
      sourceIds: def.sourceIds,
      validation: def.validation,
      lastVerified: VERIFIED_ON,
      reliability: def.reliability,
      sourceUpdated: raw.osmUpdated ?? null,
      notes: def.notes,
    },
    chainOutM: onRoute ? raw.chainOut : undefined,
    offRouteM: raw.offOutM,
    routeRefs: buildRefs(raw),
  };
}

function buildRefs(raw: RawPoint): Record<string, { chainM: number; offM: number }> {
  const refs: Record<string, { chainM: number; offM: number }> = {};
  if (raw.chainOut !== undefined && raw.offOutM !== undefined) refs['route-out'] = { chainM: raw.chainOut, offM: raw.offOutM };
  if (raw.chainOutBank !== undefined && raw.offOutBankM !== undefined) refs['route-out-bank'] = { chainM: raw.chainOutBank, offM: raw.offOutBankM };
  if (raw.chainLeno !== undefined && raw.offLenoM !== undefined) refs['walk-leno'] = { chainM: raw.chainLeno, offM: raw.offLenoM };
  return refs;
}

function endpoint(v: number | 'start' | 'end', length: number): number {
  return v === 'start' ? 0 : v === 'end' ? length : v;
}

function durationFor(c: StageContent, geo: GeoBundle, route: Route | undefined): { duration: Duration; distanceFromPrevM?: number; legM?: [number, number] } {
  // in auto: dai tratti stradali stimati
  if (c.driveLeg && geo.drive.ok) {
    const leg = geo.drive.data.legs[c.driveLeg];
    if (leg) {
      return {
        duration: { nominal: leg.nominalMinutes, min: leg.rangeMinutes[0], max: leg.rangeMinutes[1], basis: 'estimated' },
        distanceFromPrevM: leg.distanceKm * 1000,
      };
    }
  }
  // a piedi: dal modello calibrato sul percorso
  if (route && c.leg) {
    const from = endpoint(c.leg.fromM, route.lengthM);
    const to = endpoint(c.leg.toM, route.lengthM);
    const nominal = c.fixedMin ? c.fixedMin.nominal : minutesBetween(route.timeAt, from, to);
    const d: Duration = c.fixedMin
      ? { ...c.fixedMin }
      : { nominal: Math.round(nominal), min: Math.round(nominal * 0.8), max: Math.round(nominal * 1.25), basis: 'model' };
    return { duration: d, distanceFromPrevM: Math.max(0, to - from), legM: [from, to] };
  }
  if (c.fixedMin) return { duration: { ...c.fixedMin } };
  return { duration: { nominal: 0, min: 0, max: 0, basis: 'estimated' } };
}

export interface TripBuild {
  trip: Trip;
  /** Elementi mancanti o incompleti: l'interfaccia li segnala all'utente. */
  warnings: string[];
}

export function buildTrip(geo: GeoBundle): TripBuild {
  const warnings: string[] = [];
  const points: Record<string, Waypoint> = {};
  if (geo.points.ok) {
    for (const raw of Object.values(geo.points.data.points)) {
      const w = toWaypoint(raw);
      if (w) points[w.id] = w;
    }
    for (const def of PLACE_DEFS) if (!points[def.id]) warnings.push(`Punto mancante nei dati: ${def.name}`);
  } else {
    warnings.push(`Punti geografici non disponibili (${geo.points.error}).`);
  }

  const routes: Record<string, Route> = {};
  let routesFile: RoutesFile | null = null;
  if (geo.routes.ok) {
    routesFile = geo.routes.data;
    for (const raw of Object.values(routesFile.routes)) routes[raw.id] = toRoute(raw);
  } else {
    warnings.push(`Tracce non disponibili (${geo.routes.error}).`);
  }
  if (!geo.drive.ok) warnings.push('Tratti in auto non disponibili: durate di guida sostituite da valori prudenziali predefiniti.');
  if (!geo.horizon.ok) warnings.push('Profilo dell’orizzonte non disponibile: niente stima del sole diretto.');

  // percorsi di ritorno: stesse posizioni, progressiva speculare
  for (const w of Object.values(points)) {
    const refs = w.routeRefs ?? {};
    for (const [fwd, back] of [['route-out', 'route-back'], ['route-out-bank', 'route-back-bank']] as const) {
      const f = refs[fwd];
      const L = routes[fwd]?.lengthM;
      if (f && L !== undefined) refs[back] = { chainM: Math.max(0, L - f.chainM), offM: f.offM };
    }
    w.routeRefs = refs;
  }

  const stages: Stage[] = STAGE_CONTENT.map((c) => {
    const route = c.routeId ? routes[c.routeId] : undefined;
    const { duration, distanceFromPrevM, legM } = durationFor(c, geo, route);
    return {
      id: c.id,
      order: c.order,
      kind: c.kind,
      mode: c.mode,
      name: c.name,
      summary: c.summary,
      placeId: c.placeId,
      routeId: c.routeId,
      legM,
      distanceFromPrevM,
      duration,
      waymarks: c.waymarks,
      whatToSee: c.whatToSee,
      difficulties: c.difficulties,
      howToContinue: c.howToContinue,
      alternatives: c.alternatives,
      sourceIds: c.sourceIds,
      validation: c.validation,
      lastVerified: VERIFIED_ON,
    };
  });

  const pois: PointOfInterest[] = [];
  for (const c of POI_CONTENT) {
    const wp = points[c.placeId];
    if (!wp) {
      warnings.push(`Scheda "${c.name}" senza posizione nei dati.`);
      continue;
    }
    const raw = geo.points.ok ? geo.points.data.points[c.placeId] : undefined;
    const off = c.relativeTo === 'walk-leno' ? (raw?.offLenoM ?? 0) : (raw?.offOutM ?? 0);
    const onRoute = off <= 60;
    pois.push({
      id: c.id,
      name: c.name,
      type: c.type,
      category: c.category,
      coordinates: wp.coordinates,
      elevationM: wp.elevationM,
      description: c.description,
      osmIds: wp.osmIds,
      onRoute,
      detourM: onRoute ? undefined : Math.round(off),
      photoTips: c.photoTips,
      highlights: c.highlights,
      warnings: c.warnings,
      photos: c.photos,
      provenance: {
        sourceIds: c.sourceIds,
        validation: c.validation,
        lastVerified: VERIFIED_ON,
        reliability: 'media',
        sourceUpdated: wp.provenance.sourceUpdated ?? null,
      },
    });
  }

  const parkings: Parking[] = [];
  for (const id of ['park-boazzo-centrale', 'park-boazzo-nord', 'park-dam', 'park-dam-alt']) {
    const w = points[id];
    if (!w) continue;
    parkings.push({
      ...w,
      type: 'parking',
      access: id.startsWith('park-dam')
        ? ['Accesso regolato e/o a pagamento (≈4–6 €): da verificare per ottobre 2026', 'Portare monete (una fonte del 2020: solo monete)']
        : ['Ultimo tratto di strada stretto: cartello di divieto oltre il parcheggio (fonte secondaria)'],
    });
  }

  const critical: CriticalPoint[] = [];
  if (routesFile) {
    const L = routesFile.routes['route-out']?.lengthM ?? 0;
    routesFile.bridges.forEach((b, i) => {
      for (const [rid, chain] of [['route-out', (b.fromM + b.toM) / 2], ['route-back', L - (b.fromM + b.toM) / 2]] as const) {
        critical.push({
          id: `bridge-${i}-${rid}`,
          kind: 'bridge',
          routeId: rid,
          chainM: Math.round(chain),
          coordinates: [b.lon, b.lat],
          label: b.lengthM >= 15 ? 'Ponte' : 'Passerella',
          detail: `Tratto marcato come ponte nel dato OSM (${b.lengthM} m). Se è bagnato o gelato attraversa con prudenza; se non ti convince non attraversare.`,
          osmIds: b.osm,
          provenance: { sourceIds: ['osm-overture'], validation: 'source-derived', lastVerified: VERIFIED_ON, reliability: 'media' },
        });
      }
    });
    routesFile.junctions.forEach((j, i) => {
      const dirs = Array.from(new Set(j.branches.map((b) => b.dir))).join(', ');
      for (const [rid, chain] of [['route-out', j.chainM], ['route-back', L - j.chainM]] as const) {
        critical.push({
          id: `junction-${i}-${rid}`,
          kind: 'junction',
          routeId: rid,
          chainM: Math.round(chain),
          coordinates: [j.lon, j.lat],
          label: 'Punto di attenzione: altro tracciato',
          detail: `Dal dato OSM da qui si stacca un altro tracciato verso ${dirs}. Resta sul percorso evidenziato e sui segnavia: l’app non indica "destra/sinistra".`,
          osmIds: j.branches.flatMap((b) => b.osm),
          provenance: { sourceIds: ['osm-overture'], validation: 'source-derived', lastVerified: VERIFIED_ON, reliability: 'bassa' },
        });
      }
    });
    critical.sort((a, b) => a.chainM - b.chainM);
  }

  const trip: Trip = {
    id: TRIP_CONFIG.id,
    title: TRIP_CONFIG.title,
    date: TRIP_CONFIG.date,
    timezone: TRIP_CONFIG.timezone,
    departureWindow: TRIP_CONFIG.departureWindow,
    vehicle: 'car',
    stages,
    routes,
    pois,
    parkings,
    points,
    criticalPoints: critical,
    safetyNotices: SAFETY_NOTICES,
    sources: SOURCES,
  };
  return { trip, warnings };
}

/** Opzioni per accorciare l'escursione: Malga Breguzzo e Cascata sul Chiese, con tempi dai dati del percorso. */
export function turnaroundOptions(trip: Trip): TurnaroundOption[] {
  const out = trip.routes['route-out'];
  const back = trip.routes['route-back'];
  if (!out || !back) return [];
  const total = back.timeAt[back.timeAt.length - 1]?.[1] ?? back.nominalMin;
  const opts: TurnaroundOption[] = [];
  for (const [id, name] of [
    ['malga-breguzzo', 'Malga Breguzzo'],
    ['fall-chiese', 'Cascata sul Chiese'],
  ] as const) {
    const p = trip.points[id];
    if (!p || p.chainOutM === undefined) continue;
    const outMin = interpolate(out.timeAt, p.chainOutM);
    const backMin = total - interpolate(back.timeAt, back.lengthM - p.chainOutM);
    opts.push({ id, name, distanceM: p.chainOutM, outMin: Math.round(outMin), backMin: Math.round(backMin) });
  }
  return opts;
}
