import type { ValidationStatus } from './types';

/**
 * Politica centrale: cosa può fare l'app con un dato in base al suo stato di validazione.
 * Regola del brief: un dato non verificabile NON guida automaticamente l'utente.
 */
export interface GuidancePolicy {
  /** Il dato può comparire sulla mappa/nelle schede. */
  show: boolean;
  /** Progressione e distanza residua lungo la traccia (sempre etichettate come indicative se non verificate). */
  progress: boolean;
  /** Avviso soft di possibile allontanamento dalla traccia. */
  softOffRouteAlert: boolean;
  /** Il testo va etichettato "stima". */
  labelAsEstimate: boolean;
  /** Il testo va etichettato "da verificare". */
  labelAsToVerify: boolean;
  /** Mai usare istruzioni di svolta generate dalla polilinea (vale per tutti gli stati). */
  turnByTurn: false;
}

export function guidancePolicy(status: ValidationStatus): GuidancePolicy {
  switch (status) {
    case 'field-verified':
    case 'official-verified':
      return { show: true, progress: true, softOffRouteAlert: true, labelAsEstimate: false, labelAsToVerify: false, turnByTurn: false };
    case 'cross-checked':
      return { show: true, progress: true, softOffRouteAlert: true, labelAsEstimate: false, labelAsToVerify: true, turnByTurn: false };
    case 'source-derived':
      return { show: true, progress: true, softOffRouteAlert: true, labelAsEstimate: false, labelAsToVerify: true, turnByTurn: false };
    case 'estimated':
      return { show: true, progress: false, softOffRouteAlert: false, labelAsEstimate: true, labelAsToVerify: true, turnByTurn: false };
    case 'unverified':
    default:
      return { show: true, progress: false, softOffRouteAlert: false, labelAsEstimate: false, labelAsToVerify: true, turnByTurn: false };
  }
}

export const VALIDATION_LABEL: Record<ValidationStatus, string> = {
  'field-verified': 'Verificato sul campo',
  'official-verified': 'Fonte ufficiale',
  'cross-checked': 'Riscontrato su più fonti',
  'source-derived': 'Da OpenStreetMap, non verificato sul campo',
  estimated: 'Stima',
  unverified: 'Non verificato',
};

export const VALIDATION_SHORT: Record<ValidationStatus, string> = {
  'field-verified': 'Campo',
  'official-verified': 'Ufficiale',
  'cross-checked': 'Riscontrato',
  'source-derived': 'Da OSM',
  estimated: 'Stima',
  unverified: 'Non verificato',
};

export const VALIDATION_RANK: Record<ValidationStatus, number> = {
  unverified: 0,
  estimated: 1,
  'source-derived': 2,
  'cross-checked': 3,
  'official-verified': 4,
  'field-verified': 5,
};
