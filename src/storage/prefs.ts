import type { LngLat } from '../domain/types';
import type { PaceKey } from '../config/trip.config';
import { TRIP_CONFIG } from '../config/trip.config';
import type { Actuals } from '../schedule/engine';
import { PHASES, type Phase } from '../state/phase';
import { kvGet, kvSet } from './idb';

export type ThemePref = 'auto' | 'light' | 'dark' | 'contrast';
export type HutStatus = 'unknown' | 'confirmed-open' | 'confirmed-closed';

export interface ImportedTrack {
  name: string;
  points: LngLat[];
  importedAt: number;
}

export interface LastPosition {
  lat: number;
  lng: number;
  accuracyM: number;
  timestamp: number;
}

export interface Prefs {
  v: 1;
  departureMin: number;
  pace: PaceKey;
  skipLeno: boolean;
  theme: ThemePref;
  textScale: 1 | 1.15 | 1.3;
  offRouteAlerts: boolean;
  wakeLock: boolean;
  hutStatus: HutStatus;
  hutNote: string;
  checklist: Record<string, boolean>;
  driveOverrides: Partial<Record<'toBoazzo' | 'boazzoToDam' | 'home', number>>;
  phase: Phase;
  actuals: Actuals;
  /** Variante di sponda scelta per andata/ritorno. */
  bank: { out: boolean; back: boolean };
  /** Ultima posizione GPS nota (salvata SOLO dopo il consenso, solo sul dispositivo). */
  lastPosition: LastPosition | null;
  importedTrack: ImportedTrack | null;
  /** Tabella delle verifiche eseguite a mano dall'utente (es. telefonata al rifugio). */
  seenIntro: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  v: 1,
  departureMin: TRIP_CONFIG.departureWindow.defaultMin,
  pace: 'normale',
  skipLeno: false,
  theme: 'auto',
  textScale: 1,
  offRouteAlerts: true,
  wakeLock: false,
  hutStatus: 'unknown',
  hutNote: '',
  checklist: {},
  driveOverrides: {},
  phase: 'prep',
  actuals: {},
  bank: { out: false, back: false },
  lastPosition: null,
  importedTrack: null,
  seenIntro: false,
};

const KEY = 'prefs';
const PHASE_IDS = new Set(PHASES.map((p) => p.id));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Unisce quanto salvato con i valori predefiniti, scartando campi non validi (dati corrotti o di versioni vecchie). */
export function sanitizePrefs(raw: unknown): Prefs {
  const d = DEFAULT_PREFS;
  if (typeof raw !== 'object' || raw === null) return { ...d };
  const r = raw as Partial<Prefs>;
  const win = TRIP_CONFIG.departureWindow;
  const actuals: Actuals = {};
  if (r.actuals && typeof r.actuals === 'object') {
    for (const [k, v] of Object.entries(r.actuals)) if (typeof v === 'number' && Number.isFinite(v)) actuals[k as keyof Actuals] = v;
  }
  const checklist: Record<string, boolean> = {};
  if (r.checklist && typeof r.checklist === 'object') for (const [k, v] of Object.entries(r.checklist)) if (typeof v === 'boolean') checklist[k] = v;
  const driveOverrides: Prefs['driveOverrides'] = {};
  if (r.driveOverrides && typeof r.driveOverrides === 'object') {
    for (const k of ['toBoazzo', 'boazzoToDam', 'home'] as const) {
      const v = (r.driveOverrides as Record<string, unknown>)[k];
      if (typeof v === 'number' && v >= 5 && v <= 400) driveOverrides[k] = Math.round(v);
    }
  }
  return {
    v: 1,
    departureMin: typeof r.departureMin === 'number' ? clamp(Math.round(r.departureMin), win.earliestMin, win.latestMin) : d.departureMin,
    pace: r.pace === 'veloce' || r.pace === 'lento' || r.pace === 'normale' ? r.pace : d.pace,
    skipLeno: r.skipLeno === true,
    theme: r.theme === 'light' || r.theme === 'dark' || r.theme === 'contrast' || r.theme === 'auto' ? r.theme : d.theme,
    textScale: r.textScale === 1.15 || r.textScale === 1.3 ? r.textScale : 1,
    offRouteAlerts: r.offRouteAlerts !== false,
    wakeLock: r.wakeLock === true,
    hutStatus: r.hutStatus === 'confirmed-open' || r.hutStatus === 'confirmed-closed' ? r.hutStatus : 'unknown',
    hutNote: typeof r.hutNote === 'string' ? r.hutNote.slice(0, 300) : '',
    checklist,
    driveOverrides,
    phase: typeof r.phase === 'string' && PHASE_IDS.has(r.phase as Phase) ? (r.phase as Phase) : d.phase,
    actuals,
    bank: { out: r.bank?.out === true, back: r.bank?.back === true },
    lastPosition:
      r.lastPosition && typeof r.lastPosition.lat === 'number' && typeof r.lastPosition.lng === 'number' && typeof r.lastPosition.timestamp === 'number'
        ? { lat: r.lastPosition.lat, lng: r.lastPosition.lng, accuracyM: Number(r.lastPosition.accuracyM) || 0, timestamp: r.lastPosition.timestamp }
        : null,
    importedTrack:
      r.importedTrack && Array.isArray(r.importedTrack.points) && r.importedTrack.points.length >= 2
        ? { name: String(r.importedTrack.name ?? 'Traccia importata').slice(0, 120), points: r.importedTrack.points, importedAt: Number(r.importedTrack.importedAt) || 0 }
        : null,
    seenIntro: r.seenIntro === true,
  };
}

export async function loadPrefs(): Promise<Prefs> {
  return sanitizePrefs(await kvGet<unknown>(KEY));
}

export async function savePrefs(p: Prefs): Promise<void> {
  await kvSet(KEY, p);
}

/** Cancella TUTTI i dati personali memorizzati (posizione, orari, preferenze). */
export async function resetPrefs(): Promise<void> {
  await kvSet(KEY, DEFAULT_PREFS);
}
