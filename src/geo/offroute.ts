/**
 * Avviso di POSSIBILE allontanamento dalla traccia mappata.
 *
 * Obiettivi (brief §6): niente notifiche frequenti o allarmistiche per le oscillazioni del GPS; avviso solo con
 * precisione adeguata; gestione delle posizioni imprecise e di quelle obsolete.
 *
 * È un riduttore puro: `stepOffRoute(stato, campione)` → nuovo stato. Nessun effetto collaterale (niente suoni/vibrazioni).
 */
export interface OffRouteConfig {
  /** Sopra questa precisione (m) il fix è ignorato. */
  maxAccuracyM: number;
  /** Distanza minima (m) oltre la quale si considera lontano... */
  minDistM: number;
  /** ...o questo multiplo della precisione, se maggiore. */
  accuracyFactor: number;
  /** Numero minimo di fix consecutivi lontani. */
  minFixes: number;
  /** Durata minima (ms) coperta dai fix lontani consecutivi. */
  minSpanMs: number;
  /** Distanza (m) sotto la quale si considera di nuovo vicino... */
  clearDistM: number;
  /** ...o questo multiplo della precisione, se maggiore. */
  clearAccuracyFactor: number;
  /** Numero di fix consecutivi vicini per annullare l'avviso. */
  clearFixes: number;
}

export const DEFAULT_OFF_ROUTE: OffRouteConfig = {
  maxAccuracyM: 50,
  minDistM: 60,
  accuracyFactor: 2,
  minFixes: 3,
  minSpanMs: 30_000,
  clearDistM: 40,
  clearAccuracyFactor: 1.5,
  clearFixes: 2,
};

export type OffRouteStatus = 'on-route' | 'possibly-off' | 'unknown';

export interface OffRouteState {
  status: OffRouteStatus;
  farFixes: number;
  farSince: number | null;
  nearFixes: number;
  reason: string;
}

export const INITIAL_OFF_ROUTE: OffRouteState = { status: 'unknown', farFixes: 0, farSince: null, nearFixes: 0, reason: 'nessun dato' };

export interface FixSample {
  /** Epoch ms. */
  t: number;
  accuracyM: number;
  /** Distanza (m) dalla traccia. */
  distM: number;
  /** Fix obsoleto: non va usato. */
  stale?: boolean;
}

export function stepOffRoute(state: OffRouteState, fix: FixSample, cfg: OffRouteConfig = DEFAULT_OFF_ROUTE): OffRouteState {
  if (fix.stale) {
    return { ...state, status: state.status === 'possibly-off' ? 'possibly-off' : 'unknown', farFixes: 0, farSince: null, nearFixes: 0, reason: 'posizione obsoleta' };
  }
  if (!(fix.accuracyM <= cfg.maxAccuracyM)) {
    return {
      ...state,
      status: state.status === 'possibly-off' ? 'possibly-off' : 'unknown',
      farFixes: 0,
      farSince: null,
      nearFixes: 0,
      reason: 'precisione insufficiente per valutare',
    };
  }
  const farThreshold = Math.max(cfg.minDistM, cfg.accuracyFactor * fix.accuracyM);
  const nearThreshold = Math.max(cfg.clearDistM, cfg.clearAccuracyFactor * fix.accuracyM);

  if (fix.distM > farThreshold) {
    const farFixes = state.farFixes + 1;
    const farSince = state.farSince ?? fix.t;
    const off = farFixes >= cfg.minFixes && fix.t - farSince >= cfg.minSpanMs;
    return {
      status: off ? 'possibly-off' : state.status === 'possibly-off' ? 'possibly-off' : 'on-route',
      farFixes,
      farSince,
      nearFixes: 0,
      reason: off ? 'distanza dalla traccia mantenuta' : 'distanza in verifica',
    };
  }
  if (fix.distM <= nearThreshold) {
    const nearFixes = state.nearFixes + 1;
    if (state.status === 'possibly-off' && nearFixes < cfg.clearFixes) {
      return { ...state, nearFixes, farFixes: 0, farSince: null, reason: 'rientro in verifica' };
    }
    return { status: 'on-route', farFixes: 0, farSince: null, nearFixes, reason: 'sulla traccia' };
  }
  // zona intermedia: non conta come lontano né come vicino (nessun avviso nuovo, nessun annullamento)
  return { ...state, farFixes: 0, farSince: null, nearFixes: 0, status: state.status === 'unknown' ? 'on-route' : state.status, reason: 'zona intermedia' };
}
