import { describe, expect, it } from 'vitest';
import { TRIP_CONFIG } from '../../src/config/trip.config';
import { buildSchedule } from '../../src/schedule/engine';
import { buildScheduleInput } from '../../src/schedule/input';
import { DEFAULT_PREFS } from '../../src/storage/prefs';
import { loadTripFromDisk } from './_fixtures';

const SUN = { sunsetMin: 17 * 60 + 5, civilDuskMin: 17 * 60 + 35 };

describe('ingresso del programma: priorità dei tempi (utente → dati → ripiego generico)', async () => {
  const full = await loadTripFromDisk();
  const noDrive = await loadTripFromDisk(['data/geo/drive.json']);
  const noRoutes = await loadTripFromDisk(['data/geo/routes.json']);

  it('con i dati completi usa le stime stradali e i tempi di cammino del modello', () => {
    const i = buildScheduleInput({ prefs: DEFAULT_PREFS, geo: full.geo, trip: full.trip, ...SUN });
    expect(i.driveMin.toBoazzo).toBe(110);
    expect(i.driveMin.boazzoToDam).toBe(20);
    expect(i.driveMin.home).toBe(125);
    expect(i.hikeOutBaseMin).toBe(full.trip.routes['route-out']!.nominalMin);
    expect(i.hikeBackBaseMin).toBe(full.trip.routes['route-back']!.nominalMin);
    expect(i.turnarounds?.length ?? 0).toBeGreaterThan(0);
  });

  it('il valore inserito dall’utente vince sui dati', () => {
    const i = buildScheduleInput({ prefs: { ...DEFAULT_PREFS, driveOverrides: { toBoazzo: 95, home: 140 } }, geo: full.geo, trip: full.trip, ...SUN });
    expect(i.driveMin.toBoazzo).toBe(95);
    expect(i.driveMin.boazzoToDam).toBe(20);
    expect(i.driveMin.home).toBe(140);
  });

  it('senza dati stradali usa i valori generici dichiarati in configurazione', () => {
    const i = buildScheduleInput({ prefs: DEFAULT_PREFS, geo: noDrive.geo, trip: noDrive.trip, ...SUN });
    expect(i.driveMin).toEqual({ toBoazzo: TRIP_CONFIG.fallbackMin.toBoazzo, boazzoToDam: TRIP_CONFIG.fallbackMin.boazzoToDam, home: TRIP_CONFIG.fallbackMin.home });
  });

  it('senza percorsi usa i tempi di cammino generici e il programma resta calcolabile', () => {
    const i = buildScheduleInput({ prefs: DEFAULT_PREFS, geo: noRoutes.geo, trip: noRoutes.trip, ...SUN });
    expect(i.hikeOutBaseMin).toBe(TRIP_CONFIG.fallbackMin.hikeOut);
    expect(i.hikeBackBaseMin).toBe(TRIP_CONFIG.fallbackMin.hikeBack);
    const s = buildSchedule(i);
    expect(s.summary.arrivalHutMin).toBeGreaterThan(DEFAULT_PREFS.departureMin);
  });

  it('senza nessun dato (null) produce comunque un ingresso valido', () => {
    const i = buildScheduleInput({ prefs: DEFAULT_PREFS, geo: null, trip: null, ...SUN });
    expect(i.turnarounds).toEqual([]);
    expect(Number.isFinite(buildSchedule(i).summary.latestReturnStartMin)).toBe(true);
  });

  it('ritmo e salto del Leno arrivano al motore', () => {
    const i = buildScheduleInput({ prefs: { ...DEFAULT_PREFS, pace: 'lento', skipLeno: true }, geo: full.geo, trip: full.trip, ...SUN });
    expect(i.paceFactor).toBe(TRIP_CONFIG.paceFactors.lento);
    expect(i.skipLeno).toBe(true);
  });
});
