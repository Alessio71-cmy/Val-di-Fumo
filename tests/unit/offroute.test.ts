import { describe, expect, it } from 'vitest';
import { DEFAULT_OFF_ROUTE, INITIAL_OFF_ROUTE, type FixSample, type OffRouteState, stepOffRoute } from '../../src/geo/offroute';

function run(samples: FixSample[], start: OffRouteState = INITIAL_OFF_ROUTE): OffRouteState[] {
  const out: OffRouteState[] = [];
  let s = start;
  for (const f of samples) {
    s = stepOffRoute(s, f, DEFAULT_OFF_ROUTE);
    out.push(s);
  }
  return out;
}
const T0 = 1_000_000;

describe('avviso di allontanamento', () => {
  it('sulla traccia con buona precisione → on-route', () => {
    const r = run([{ t: T0, accuracyM: 8, distM: 5 }]);
    expect(r[0]!.status).toBe('on-route');
  });
  it('una sola oscillazione isolata (90 m) NON genera avviso', () => {
    const r = run([
      { t: T0, accuracyM: 10, distM: 5 },
      { t: T0 + 5000, accuracyM: 10, distM: 90 },
      { t: T0 + 10000, accuracyM: 10, distM: 6 },
    ]);
    expect(r.every((s) => s.status !== 'possibly-off')).toBe(true);
  });
  it('lontananza mantenuta per ≥3 fix e ≥30 s → possibly-off', () => {
    const r = run([
      { t: T0, accuracyM: 12, distM: 5 },
      { t: T0 + 10_000, accuracyM: 12, distM: 120 },
      { t: T0 + 25_000, accuracyM: 12, distM: 130 },
      { t: T0 + 41_000, accuracyM: 12, distM: 140 },
    ]);
    expect(r[1]!.status).toBe('on-route');
    expect(r[2]!.status).toBe('on-route');
    expect(r[3]!.status).toBe('possibly-off');
  });
  it('tre fix lontani ma in meno di 30 s NON bastano', () => {
    const r = run([
      { t: T0, accuracyM: 12, distM: 120 },
      { t: T0 + 5000, accuracyM: 12, distM: 125 },
      { t: T0 + 10_000, accuracyM: 12, distM: 130 },
    ]);
    expect(r[2]!.status).not.toBe('possibly-off');
  });
  it('precisione scarsa (80 m): mai avviso, stato sconosciuto', () => {
    const r = run(Array.from({ length: 10 }, (_, i) => ({ t: T0 + i * 10_000, accuracyM: 80, distM: 300 })));
    expect(r.every((s) => s.status === 'unknown')).toBe(true);
  });
  it('soglia adattiva: con precisione 40 m servono > 80 m, non 60', () => {
    const r = run(Array.from({ length: 6 }, (_, i) => ({ t: T0 + i * 10_000, accuracyM: 40, distM: 70 })));
    expect(r.every((s) => s.status !== 'possibly-off')).toBe(true);
  });
  it('fix obsoleto non genera né annulla avvisi', () => {
    const off = run([
      { t: T0, accuracyM: 10, distM: 150 },
      { t: T0 + 20_000, accuracyM: 10, distM: 150 },
      { t: T0 + 40_000, accuracyM: 10, distM: 150 },
    ]);
    expect(off[2]!.status).toBe('possibly-off');
    const after = stepOffRoute(off[2]!, { t: T0 + 200_000, accuracyM: 10, distM: 1, stale: true });
    expect(after.status).toBe('possibly-off');
  });
  it('rientro: servono 2 fix vicini consecutivi per annullare', () => {
    const start = run([
      { t: T0, accuracyM: 10, distM: 150 },
      { t: T0 + 20_000, accuracyM: 10, distM: 150 },
      { t: T0 + 40_000, accuracyM: 10, distM: 150 },
    ])[2]!;
    const r = run([{ t: T0 + 50_000, accuracyM: 10, distM: 10 }, { t: T0 + 60_000, accuracyM: 10, distM: 8 }], start);
    expect(r[0]!.status).toBe('possibly-off');
    expect(r[1]!.status).toBe('on-route');
  });
  it('nessun effetto collaterale: lo stato di ingresso non viene mutato', () => {
    const s = Object.freeze({ ...INITIAL_OFF_ROUTE });
    expect(() => stepOffRoute(s, { t: T0, accuracyM: 5, distM: 5 })).not.toThrow();
  });
});
