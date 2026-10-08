import type { GPSPosition } from '../domain/types';

export type AccuracyClass = 'buona' | 'discreta' | 'scarsa' | 'inaffidabile';
export type AgeClass = 'fresca' | 'non-aggiornata' | 'obsoleta';

export const ACCURACY_LIMITS = { good: 20, fair: 50, poor: 100 } as const;
export const AGE_LIMITS_MS = { fresh: 30_000, stale: 120_000 } as const;

export function classifyAccuracy(accuracyM: number): AccuracyClass {
  if (!Number.isFinite(accuracyM) || accuracyM < 0) return 'inaffidabile';
  if (accuracyM <= ACCURACY_LIMITS.good) return 'buona';
  if (accuracyM <= ACCURACY_LIMITS.fair) return 'discreta';
  if (accuracyM <= ACCURACY_LIMITS.poor) return 'scarsa';
  return 'inaffidabile';
}

export function classifyAge(ageMs: number): AgeClass {
  if (ageMs <= AGE_LIMITS_MS.fresh) return 'fresca';
  if (ageMs <= AGE_LIMITS_MS.stale) return 'non-aggiornata';
  return 'obsoleta';
}

export const ACCURACY_LABEL: Record<AccuracyClass, string> = {
  buona: 'Precisione buona',
  discreta: 'Precisione discreta',
  scarsa: 'Precisione scarsa',
  inaffidabile: 'Posizione imprecisa: non affidabile',
};

export const AGE_LABEL: Record<AgeClass, string> = {
  fresca: 'Aggiornata',
  'non-aggiornata': 'Non aggiornata',
  obsoleta: 'Obsoleta',
};

/** Un fix può alimentare progresso e avvisi solo se abbastanza preciso e recente. */
export function isUsableFix(pos: GPSPosition, now: number): boolean {
  return classifyAccuracy(pos.accuracyM) !== 'inaffidabile' && classifyAge(now - pos.timestamp) !== 'obsoleta';
}

/** Età in ms del fix rispetto ad `now`; mai negativa (orologi non allineati). */
export function fixAgeMs(pos: GPSPosition, now: number): number {
  return Math.max(0, now - pos.timestamp);
}
