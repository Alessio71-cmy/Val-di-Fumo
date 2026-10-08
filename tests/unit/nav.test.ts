import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadGeo } from '../../src/data/loader';
import { buildTrip } from '../../src/data/trip';
import type { LngLat } from '../../src/domain/types';
import { haversine } from '../../src/geo/geodesy';
import { computeNav, routeWaypoints } from '../../src/geo/nav';
import { INITIAL_OFF_ROUTE, stepOffRoute } from '../../src/geo/offroute';
import { Polyline } from '../../src/geo/polyline';

const fileFetch = (async (input: RequestInfo | URL) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
  return new Response(new Uint8Array(readFileSync(`public/${url.pathname.replace(/^\//, '')}`)));
}) as typeof fetch;

const geo = await loadGeo(fileFetch, 'http://localhost/');
const { trip } = buildTrip(geo);
const out = trip.routes['route-out']!;
const poly = new Polyline(out.geometry);
const wps = routeWaypoints(trip, 'route-out');

/** Sposta un punto di `m` metri verso est (approssimazione locale). */
const east = (p: LngLat, m: number): LngLat => [p[0] + m / (111_320 * Math.cos((p[1] * Math.PI) / 180)), p[1]];

describe('waypoint del percorso', () => {
  it('ordinati e coerenti con la traccia di andata', () => {
    expect(wps.map((w) => w.id)).toEqual(['park-dam', 'malga-breguzzo', 'fall-chiese', 'malga-val-di-fumo', 'rifugio-val-di-fumo']);
    for (let i = 1; i < wps.length; i++) expect(wps[i]!.chainM).toBeGreaterThan(wps[i - 1]!.chainM);
  });
  it('il ritorno ha gli stessi punti in ordine inverso', () => {
    const back = routeWaypoints(trip, 'route-back');
    expect(back.map((w) => w.id)).toEqual(['rifugio-val-di-fumo', 'malga-val-di-fumo', 'fall-chiese', 'malga-breguzzo', 'park-dam']);
  });
  it('la passeggiata del Leno ha partenza e ponte', () => {
    expect(routeWaypoints(trip, 'walk-leno').map((w) => w.id)).toEqual(['park-boazzo-centrale', 'bridge-leno']);
  });
});

describe('distanze lungo la traccia (13: calcolo delle distanze lungo il GPX)', () => {
  it('all\'inizio: distanza residua ≈ lunghezza totale, prossimo waypoint = Malga Breguzzo', () => {
    const n = computeNav(poly, wps, out.geometry[0]!);
    expect(n.alongM).toBeLessThan(2);
    expect(n.remainingM).toBeCloseTo(poly.length, 0);
    expect(n.next!.id).toBe('malga-breguzzo');
    expect(n.next!.distAlongM).toBeCloseTo(wps[1]!.chainM, -1);
  });
  it('la distanza residua NON è la distanza in linea d\'aria', () => {
    const start = out.geometry[0]!;
    const hut = trip.points['rifugio-val-di-fumo']!.coordinates;
    const crow = haversine(start, hut);
    const n = computeNav(poly, wps, start);
    expect(n.remainingM - crow).toBeGreaterThan(500);
  });
  it('percorrendo la traccia: progressione monotona, residua = totale − percorso (±3 m)', () => {
    let prev = -1;
    let prevAlong = 0;
    for (let d = 0; d <= poly.length; d += 150) {
      const p = poly.pointAt(d);
      const n = computeNav(poly, wps, p, { prevAlong });
      expect(n.alongM).toBeGreaterThanOrEqual(prev - 0.5);
      expect(Math.abs(n.alongM - d)).toBeLessThan(3);
      expect(Math.abs(n.remainingM - (poly.length - d))).toBeLessThan(3);
      expect(n.reliable).toBe(true);
      prev = n.alongM;
      prevAlong = n.alongM;
    }
  });
  it('il prossimo waypoint avanza con la posizione', () => {
    const at = (id: string) => poly.pointAt(wps.find((w) => w.id === id)!.chainM + 40);
    expect(computeNav(poly, wps, at('park-dam')).next!.id).toBe('malga-breguzzo');
    expect(computeNav(poly, wps, at('malga-breguzzo')).next!.id).toBe('fall-chiese');
    expect(computeNav(poly, wps, at('fall-chiese')).next!.id).toBe('malga-val-di-fumo');
    expect(computeNav(poly, wps, at('malga-val-di-fumo')).next!.id).toBe('rifugio-val-di-fumo');
    expect(computeNav(poly, wps, poly.pointAt(poly.length)).next).toBeUndefined();
  });
  it('ETA indicativa al prossimo waypoint dal modello di tempo', () => {
    const n = computeNav(poly, wps, out.geometry[0]!, { timeAt: out.timeAt });
    expect(n.next!.etaMin).toBeGreaterThan(30);
    expect(n.next!.etaMin).toBeLessThan(70);
  });
});

describe('posizione fuori percorso (11: simulazione di posizione fuori percorso)', () => {
  const mid = poly.pointAt(2000);
  it('60 m di lato: ancora affidabile, distanza ≈ 60 m', () => {
    const n = computeNav(poly, wps, east(mid, 60));
    expect(n.reliable).toBe(true);
    expect(n.distToRouteM).toBeGreaterThan(20);
  });
  it('600 m lontano: progresso non affidabile', () => {
    const n = computeNav(poly, wps, east(mid, 600));
    expect(n.reliable).toBe(false);
    expect(n.distToRouteM).toBeGreaterThan(300);
  });
  it('sequenza GPS: sosta sulla traccia poi allontanamento mantenuto → avviso "possibile allontanamento" solo dopo conferme', () => {
    const t0 = 1_700_000_000_000;
    let s = INITIAL_OFF_ROUTE;
    const log: string[] = [];
    // 4 fix sulla traccia, poi 6 fix a ~150 m ogni 10 s (precisione 10 m)
    for (let i = 0; i < 4; i++) {
      const n = computeNav(poly, wps, mid, { prevAlong: 2000 });
      s = stepOffRoute(s, { t: t0 + i * 5000, accuracyM: 10, distM: n.distToRouteM });
      log.push(s.status);
    }
    const away = east(mid, 150);
    for (let i = 0; i < 6; i++) {
      const n = computeNav(poly, wps, away, { prevAlong: 2000 });
      s = stepOffRoute(s, { t: t0 + 30_000 + i * 10_000, accuracyM: 10, distM: n.distToRouteM });
      log.push(s.status);
    }
    expect(log.slice(0, 4).every((x) => x === 'on-route')).toBe(true);
    expect(log[4]).toBe('on-route');
    expect(log[log.length - 1]).toBe('possibly-off');
  });
});
