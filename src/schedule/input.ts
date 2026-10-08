import { TRIP_CONFIG } from '../config/trip.config';
import type { GeoBundle } from '../data/loader';
import { turnaroundOptions } from '../data/trip';
import type { Trip } from '../domain/types';
import type { Prefs } from '../storage/prefs';
import type { ScheduleInput } from './engine';

const FALLBACK = TRIP_CONFIG.fallbackMin;

export interface ScheduleInputArgs {
  prefs: Pick<Prefs, 'departureMin' | 'pace' | 'driveOverrides' | 'actuals' | 'skipLeno'>;
  geo: GeoBundle | null;
  trip: Trip | null;
  sunsetMin: number;
  civilDuskMin: number;
  /** Minuti dalla mezzanotte locale "adesso" (solo il giorno dell'escursione). */
  nowMin?: number;
}

/**
 * Costruisce l'ingresso del motore del programma da preferenze, dati e configurazione.
 * Priorità dei tempi di guida: valore inserito dall'utente → stima da dati stradali OSM → valore generico di ripiego.
 * I tempi di cammino arrivano dai percorsi (modello calibrato), con ripiego generico se mancano.
 */
export function buildScheduleInput(a: ScheduleInputArgs): ScheduleInput {
  const legs = a.geo?.drive.ok ? a.geo.drive.data.legs : null;
  const out = a.trip?.routes['route-out'];
  const back = a.trip?.routes['route-back'];
  return {
    departureMin: a.prefs.departureMin,
    paceFactor: TRIP_CONFIG.paceFactors[a.prefs.pace],
    driveMin: {
      toBoazzo: a.prefs.driveOverrides.toBoazzo ?? legs?.['pergine-boazzo'].nominalMinutes ?? FALLBACK.toBoazzo,
      boazzoToDam: a.prefs.driveOverrides.boazzoToDam ?? legs?.['boazzo-dam'].nominalMinutes ?? FALLBACK.boazzoToDam,
      home: a.prefs.driveOverrides.home ?? legs?.['dam-pergine'].nominalMinutes ?? FALLBACK.home,
    },
    lenoStopMin: TRIP_CONFIG.durations.lenoStopMin,
    prepMin: TRIP_CONFIG.durations.prepMin,
    lunchMin: TRIP_CONFIG.durations.lunchMin,
    hikeOutBaseMin: out?.nominalMin ?? FALLBACK.hikeOut,
    hikeBackBaseMin: back?.nominalMin ?? FALLBACK.hikeBack,
    extraStopsOutMin: TRIP_CONFIG.durations.extraStopsOutMin,
    extraStopsBackMin: TRIP_CONFIG.durations.extraStopsBackMin,
    marginFraction: TRIP_CONFIG.safety.marginFraction,
    lightMarginMin: TRIP_CONFIG.safety.lightMarginMin,
    sunsetMin: a.sunsetMin,
    civilDuskMin: a.civilDuskMin,
    actuals: a.prefs.actuals,
    nowMin: a.nowMin,
    turnarounds: a.trip ? turnaroundOptions(a.trip) : [],
    skipLeno: a.prefs.skipLeno,
    tightMarginMin: TRIP_CONFIG.safety.tightMarginMin,
    sufficientMarginMin: TRIP_CONFIG.safety.sufficientMarginMin,
  };
}
