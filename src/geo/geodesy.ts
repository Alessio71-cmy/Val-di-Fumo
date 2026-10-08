import type { LngLat } from '../domain/types';

export const EARTH_RADIUS_M = 6371008.8;
const RAD = Math.PI / 180;

/** Distanza ortodromica (m) tra due punti [lon, lat]. */
export function haversine(a: LngLat, b: LngLat): number {
  const dLat = (b[1] - a[1]) * RAD;
  const dLon = (b[0] - a[0]) * RAD;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const h = s1 * s1 + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * s2 * s2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rotta iniziale (gradi, 0 = nord, orario) da a verso b. */
export function bearing(a: LngLat, b: LngLat): number {
  const φ1 = a[1] * RAD;
  const φ2 = b[1] * RAD;
  const Δλ = (b[0] - a[0]) * RAD;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/** Differenza angolare con segno in (-180, 180]. */
export function angleDiff(target: number, source: number): number {
  let d = (target - source + 540) % 360 - 180;
  if (d === -180) d = 180;
  return d;
}

const COMPASS_IT = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ovest', 'ovest', 'nord-ovest'] as const;
const COMPASS_SHORT = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'] as const;

export function compassIT(deg: number): string {
  return COMPASS_IT[Math.floor(((deg % 360) + 360 + 22.5) / 45) % 8] ?? 'nord';
}

export function compassShort(deg: number): string {
  return COMPASS_SHORT[Math.floor(((deg % 360) + 360 + 22.5) / 45) % 8] ?? 'N';
}

/** Proiezione equirettangolare locale (m) centrata su `origin`: errore trascurabile entro qualche decina di km. */
export function localProjector(origin: LngLat): (p: LngLat) => [number, number] {
  const k = Math.cos(origin[1] * RAD);
  return (p) => [(p[0] - origin[0]) * RAD * EARTH_RADIUS_M * k, (p[1] - origin[1]) * RAD * EARTH_RADIUS_M];
}

export function localUnprojector(origin: LngLat): (xy: [number, number]) => LngLat {
  const k = Math.cos(origin[1] * RAD);
  return ([x, y]) => [origin[0] + x / (RAD * EARTH_RADIUS_M * k), origin[1] + y / (RAD * EARTH_RADIUS_M)];
}

export function centroid(points: LngLat[]): LngLat {
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p[0];
    sy += p[1];
  }
  return [sx / points.length, sy / points.length];
}

export function bbox(points: LngLat[]): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

/** Coordinate in formato leggibile e copiabile (gradi decimali, 5 cifre ≈ 1 m). */
export function formatLatLon(lat: number, lon: number): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

/** Gradi e minuti decimali (utile da comunicare a voce al 112). */
export function formatDegMin(lat: number, lon: number): string {
  const f = (v: number, pos: string, neg: string) => {
    const s = v >= 0 ? pos : neg;
    const a = Math.abs(v);
    const d = Math.floor(a);
    const m = (a - d) * 60;
    return `${s} ${d}° ${m.toFixed(3)}'`;
  };
  return `${f(lat, 'N', 'S')}  ${f(lon, 'E', 'O')}`;
}
