import type { LngLat, Trip } from '../domain/types';
import { interpolate } from '../data/routeTime';
import { bearing, haversine } from './geodesy';
import type { Polyline } from './polyline';

export interface NavWaypoint {
  id: string;
  name: string;
  chainM: number;
}

export interface NavOptions {
  /** Progressiva precedente: la ricerca privilegia tratti vicini (continuità). */
  prevAlong?: number;
  /** Oltre questa distanza (m) dalla traccia il progresso non è affidabile. */
  maxReliableDistM?: number;
  /** Tempo nominale cumulato lungo la traccia, per l'ETA indicativa. */
  timeAt?: Array<[number, number]>;
  paceFactor?: number;
}

export interface NavResult {
  reliable: boolean;
  alongM: number;
  distToRouteM: number;
  remainingM: number;
  progressPct: number;
  nearestPoint: LngLat;
  /** Direzione di marcia della traccia in questo punto. */
  routeBearingDeg: number;
  next?: { id: string; name: string; distAlongM: number; etaMin?: number; bearingStraightDeg: number };
  previous?: { id: string; name: string; distAlongM: number };
  passedIds: string[];
}

/** Calcolo di progressione LUNGO LA GEOMETRIA della traccia (mai in linea d'aria) rispetto alla posizione. */
export function computeNav(poly: Polyline, wps: NavWaypoint[], pos: LngLat, opts: NavOptions = {}): NavResult {
  const maxDist = opts.maxReliableDistM ?? 300;
  const pr = poly.project(pos, opts.prevAlong !== undefined ? { minAlong: opts.prevAlong - 120, maxAlong: opts.prevAlong + 500 } : {});
  const along = pr.along;
  const sorted = [...wps].sort((a, b) => a.chainM - b.chainM);
  const tol = 15;
  const next = sorted.find((w) => w.chainM > along + tol);
  const passed = sorted.filter((w) => w.chainM <= along + tol);
  const prev = passed[passed.length - 1];
  const result: NavResult = {
    reliable: pr.dist <= maxDist,
    alongM: along,
    distToRouteM: pr.dist,
    remainingM: Math.max(0, poly.length - along),
    progressPct: Math.max(0, Math.min(100, (100 * along) / poly.length)),
    nearestPoint: pr.point,
    routeBearingDeg: poly.bearingAt(along),
    passedIds: passed.map((w) => w.id),
  };
  if (next) {
    const dist = next.chainM - along;
    const target = poly.pointAt(next.chainM);
    result.next = {
      id: next.id,
      name: next.name,
      distAlongM: dist,
      etaMin: opts.timeAt ? Math.max(0, interpolate(opts.timeAt, next.chainM) - interpolate(opts.timeAt, along)) * (opts.paceFactor ?? 1) : undefined,
      bearingStraightDeg: bearing(pos, target),
    };
  }
  if (prev) result.previous = { id: prev.id, name: prev.name, distAlongM: along - prev.chainM };
  return result;
}

const ROUTE_WAYPOINT_IDS: Record<string, string[]> = {
  'route-out': ['park-dam', 'malga-breguzzo', 'fall-chiese', 'malga-val-di-fumo', 'rifugio-val-di-fumo'],
  'route-back': ['rifugio-val-di-fumo', 'malga-val-di-fumo', 'fall-chiese', 'malga-breguzzo', 'park-dam'],
  'route-out-bank': ['park-dam', 'malga-breguzzo', 'malga-val-di-fumo', 'rifugio-val-di-fumo'],
  'route-back-bank': ['rifugio-val-di-fumo', 'malga-val-di-fumo', 'malga-breguzzo', 'park-dam'],
  'walk-leno': ['park-boazzo-centrale', 'bridge-leno'],
};

/** Waypoint di un percorso, ordinati per progressiva, solo se entro 60 m dalla traccia. */
export function routeWaypoints(trip: Trip, routeId: string): NavWaypoint[] {
  const ids = ROUTE_WAYPOINT_IDS[routeId] ?? [];
  const out: NavWaypoint[] = [];
  for (const id of ids) {
    const p = trip.points[id];
    const ref = p?.routeRefs?.[routeId];
    if (p && ref && ref.offM <= 60) out.push({ id, name: p.name, chainM: ref.chainM });
  }
  return out.sort((a, b) => a.chainM - b.chainM);
}

export { haversine };
