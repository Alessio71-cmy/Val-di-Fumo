import { describe, expect, it } from 'vitest';
import { angleDiff, bearing, compassIT, compassShort, formatDegMin, formatLatLon, haversine, localProjector } from '../../src/geo/geodesy';

describe('geodesy', () => {
  it('haversine: 1 grado di latitudine ≈ 111,2 km', () => {
    expect(haversine([10, 46], [10, 47])).toBeCloseTo(111_195, -2);
  });
  it('haversine: simmetrica e nulla per punti coincidenti', () => {
    const a: [number, number] = [10.5134, 46.052];
    const b: [number, number] = [10.5625, 46.0845];
    expect(haversine(a, a)).toBe(0);
    expect(haversine(a, b)).toBeCloseTo(haversine(b, a), 6);
  });
  it('haversine: diga → rifugio in linea d\'aria è compresa tra 4 e 6 km', () => {
    const d = haversine([10.51341, 46.05205], [10.56253, 46.08449]);
    expect(d).toBeGreaterThan(4000);
    expect(d).toBeLessThan(6000);
  });
  it('bearing: nord, est, sud, ovest', () => {
    expect(bearing([10, 46], [10, 47])).toBeCloseTo(0, 3);
    expect(bearing([10, 46], [10, 45])).toBeCloseTo(180, 3);
    expect(Math.round(bearing([10, 0], [11, 0]))).toBe(90);
    expect(Math.round(bearing([10, 0], [9, 0]))).toBe(270);
  });
  it('angleDiff è normalizzata in (-180, 180]', () => {
    expect(angleDiff(10, 350)).toBe(20);
    expect(angleDiff(350, 10)).toBe(-20);
    expect(angleDiff(180, 0)).toBe(180);
    expect(angleDiff(0, 180)).toBe(180);
  });
  it('punti cardinali', () => {
    expect(compassIT(0)).toBe('nord');
    expect(compassIT(44)).toBe('nord-est');
    expect(compassIT(225)).toBe('sud-ovest');
    expect(compassIT(359)).toBe('nord');
    expect(compassShort(315)).toBe('NO');
  });
  it('proiezione locale: ≈ haversine su pochi km', () => {
    const o: [number, number] = [10.54, 46.07];
    const p = localProjector(o);
    const a: [number, number] = [10.51, 46.05];
    const [x, y] = p(a);
    const d = Math.hypot(x, y);
    expect(Math.abs(d - haversine(o, a)) / haversine(o, a)).toBeLessThan(0.002);
  });
  it('formato coordinate', () => {
    expect(formatLatLon(46.08449, 10.56253)).toBe('46.08449, 10.56253');
    expect(formatDegMin(46.5, 10.25)).toContain("N 46° 30.000'");
    expect(formatDegMin(46.5, 10.25)).toContain("E 10° 15.000'");
  });
});
