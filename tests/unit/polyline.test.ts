import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { LngLat } from '../../src/domain/types';
import { haversine } from '../../src/geo/geodesy';
import { Polyline } from '../../src/geo/polyline';

const line: LngLat[] = [
  [10.0, 46.0],
  [10.0, 46.01],
  [10.01, 46.01],
];

describe('Polyline', () => {
  const pl = new Polyline(line);
  it('lunghezza ≈ somma haversine dei segmenti (±0,3 %)', () => {
    const exp = haversine(line[0]!, line[1]!) + haversine(line[1]!, line[2]!);
    expect(Math.abs(pl.length - exp) / exp).toBeLessThan(0.003);
  });
  it('proiezione di un punto sul primo tratto', () => {
    const pr = pl.project([10.0002, 46.005]);
    expect(pr.along).toBeGreaterThan(540);
    expect(pr.along).toBeLessThan(570);
    expect(pr.dist).toBeGreaterThan(14);
    expect(pr.dist).toBeLessThan(18);
  });
  it('proiezione oltre la fine è bloccata all\'estremo', () => {
    const pr = pl.project([10.02, 46.01]);
    expect(pr.along).toBeCloseTo(pl.length, 0);
  });
  it('pointAt e project sono coerenti', () => {
    const p = pl.pointAt(700);
    const pr = pl.project(p);
    expect(pr.along).toBeCloseTo(700, 0);
    expect(pr.dist).toBeLessThan(0.5);
  });
  it('finestra di continuità: preferisce il tratto vicino alla progressiva attesa', () => {
    // percorso che torna su se stesso: andata e ritorno sovrapposti
    const loop = new Polyline([[10, 46], [10, 46.01], [10.0001, 46.01], [10.0001, 46]]);
    const p: LngLat = [10.00005, 46.005];
    const first = loop.project(p, { minAlong: 0, maxAlong: 700 });
    const second = loop.project(p, { minAlong: 1200, maxAlong: loop.length });
    expect(first.along).toBeLessThan(700);
    expect(second.along).toBeGreaterThan(1200);
  });
  it('bearingAt: primo tratto verso nord, secondo verso est', () => {
    expect(pl.bearingAt(100)).toBeCloseTo(0, 0);
    expect(Math.round(pl.bearingAt(pl.length - 300, 100))).toBe(90);
  });
  it('slice restituisce il tratto richiesto', () => {
    const s = pl.slice(200, 900);
    const sl = new Polyline(s);
    expect(sl.length).toBeCloseTo(700, 0);
  });
});

describe('Polyline sui dati reali dell\'itinerario', () => {
  const routes = JSON.parse(readFileSync('public/data/geo/routes.json', 'utf8')).routes as Record<string, { coords: number[][]; lengthM: number }>;
  for (const id of ['route-out', 'route-back', 'route-out-bank', 'route-back-bank', 'walk-leno']) {
    it(`${id}: lunghezza della Polyline = lunghezza calcolata dalla pipeline (±0,5 %)`, () => {
      const r = routes[id]!;
      const pl = new Polyline(r.coords.map((c) => [c[0]!, c[1]!] as LngLat));
      expect(Math.abs(pl.length - r.lengthM) / r.lengthM).toBeLessThan(0.005);
    });
  }
  it('route-out: i vertici proiettati sulla traccia hanno distanza ≈ 0', () => {
    const r = routes['route-out']!;
    const pl = new Polyline(r.coords.map((c) => [c[0]!, c[1]!] as LngLat));
    for (const i of [0, 50, 100, 200, r.coords.length - 1]) {
      const c = r.coords[i]!;
      expect(pl.project([c[0]!, c[1]!]).dist).toBeLessThan(0.5);
    }
  });
});
