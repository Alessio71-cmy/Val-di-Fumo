/**
 * Configurazione dell'escursione. Tutto ciò che è modificabile senza toccare il codice sta qui.
 * Le coordinate NON sono qui: arrivano da public/data/geo/points.json (pipeline OSM).
 */
export const TRIP_CONFIG = {
  id: 'val-di-fumo-2026-10-09',
  title: 'Val di Fumo — Trail Companion',
  subtitle: 'Cascata del Leno · Lago di Malga Bissina · Rifugio Val di Fumo',
  /** Data dell'escursione (YYYY-MM-DD). Modificabile: sole e programma si ricalcolano. */
  date: '2026-10-09',
  timezone: 'Europe/Rome',
  origin: 'Pergine Valsugana (TN)',

  departureWindow: { earliestMin: 7 * 60, latestMin: 8 * 60, defaultMin: 7 * 60 + 30, stepMin: 5 },

  /** Durate di base (minuti). Le durate di cammino arrivano dai dati del percorso (modello calibrato sulle fonti). */
  durations: {
    /** Cammino al ponte alla base della cascata + foto + ritorno al parcheggio. */
    lenoStopMin: 35,
    prepMin: 15,
    lunchMin: 45,
    extraStopsOutMin: 10,
    extraStopsBackMin: 5,
  },

  paceFactors: { veloce: 0.85, normale: 1.0, lento: 1.25 },

  safety: {
    /** Margine di sicurezza sul tempo di cammino del ritorno. */
    marginFraction: 0.15,
    /** Si vuole essere all'auto almeno questi minuti prima del tramonto. */
    lightMarginMin: 60,
    /** Sotto questo margine (min) il programma è "tirato"; sotto 0 è "da rivedere". */
    tightMarginMin: 30,
    /** Margine minimo (min) perché un'alternativa abbreviata sia considerata sufficiente. */
    sufficientMarginMin: 15,
  },

  /** Punto di riferimento per alba/tramonto (chiave in points.json): la diga. */
  sunReferencePoint: 'park-dam',

  gps: {
    /** Se true la posizione viene richiesta solo dopo un tap esplicito su "Attiva GPS". */
    requireExplicitConsent: true,
    maximumAgeMs: 2000,
    timeoutMs: 30_000,
  },

  weather: {
    /** Quota (m) usata per la riduzione della previsione. */
    elevationM: 1850,
    /** Il dato meteo è considerato "vecchio" dopo questi minuti. */
    staleAfterMin: 180,
    timeoutMs: 8000,
    /** Punto della previsione: Rifugio Val di Fumo. */
    pointKey: 'rifugio-val-di-fumo',
  },
} as const;

export type PaceKey = keyof typeof TRIP_CONFIG.paceFactors;
