import type { ScheduleEventId } from '../domain/types';

/** Fasi della giornata. Le sceglie sempre l'utente: l'app può suggerire ma non cambia fase da sola. */
export type Phase =
  | 'prep'
  | 'drive-out'
  | 'leno'
  | 'drive-dam'
  | 'trek-prep'
  | 'trek-out'
  | 'hut'
  | 'trek-back'
  | 'drive-home'
  | 'done';

export type PrimaryAction = 'prepare' | 'navigate' | 'route' | 'evaluate-return' | 'return' | 'none';

export interface PhaseDef {
  id: Phase;
  label: string;
  /** Pulsante principale contestuale in "Oggi". */
  primary: PrimaryAction;
  primaryLabel: string;
  /** Evento da registrare per passare alla fase successiva. */
  advanceEvent?: ScheduleEventId;
  advanceLabel?: string;
  next?: Phase;
  /** Destinazione del navigatore stradale in questa fase (chiave di punto). */
  driveTo?: string;
}

export const PHASES: PhaseDef[] = [
  { id: 'prep', label: 'Prima della partenza', primary: 'prepare', primaryLabel: 'Prepara il viaggio', advanceEvent: 'departed', advanceLabel: 'Sono partito da Pergine', next: 'drive-out' },
  { id: 'drive-out', label: 'In auto verso Boazzo', primary: 'navigate', primaryLabel: 'Apri navigazione stradale', advanceEvent: 'arrived-boazzo', advanceLabel: 'Sono arrivato a Boazzo', next: 'leno', driveTo: 'park-boazzo-centrale' },
  { id: 'leno', label: 'Cascata del Leno', primary: 'route', primaryLabel: 'Visualizza percorso', advanceEvent: 'left-boazzo', advanceLabel: 'Riparto da Boazzo', next: 'drive-dam' },
  { id: 'drive-dam', label: 'In auto verso la diga', primary: 'navigate', primaryLabel: 'Apri navigazione stradale', advanceEvent: 'arrived-dam', advanceLabel: 'Sono arrivato alla diga', next: 'trek-prep', driveTo: 'park-dam' },
  { id: 'trek-prep', label: 'Preparazione al trekking', primary: 'route', primaryLabel: 'Visualizza percorso', advanceEvent: 'started-hike', advanceLabel: 'Parto a piedi', next: 'trek-out' },
  { id: 'trek-out', label: 'Trekking: andata', primary: 'route', primaryLabel: 'Visualizza percorso', advanceEvent: 'arrived-hut', advanceLabel: 'Sono al rifugio', next: 'hut' },
  { id: 'hut', label: 'Al rifugio', primary: 'evaluate-return', primaryLabel: 'Valuta il ritorno', advanceEvent: 'started-return', advanceLabel: 'Inizio il ritorno', next: 'trek-back' },
  { id: 'trek-back', label: 'Ritorno a piedi', primary: 'return', primaryLabel: 'Torna al parcheggio', advanceEvent: 'back-at-car', advanceLabel: 'Sono tornato all’auto', next: 'drive-home' },
  { id: 'drive-home', label: 'Rientro in auto', primary: 'navigate', primaryLabel: 'Apri navigazione stradale', advanceEvent: 'home', advanceLabel: 'Sono arrivato', next: 'done', driveTo: 'pergine' },
  { id: 'done', label: 'Giornata conclusa', primary: 'none', primaryLabel: 'Giornata conclusa' },
];

export const PHASE_BY_ID: Record<Phase, PhaseDef> = Object.fromEntries(PHASES.map((p) => [p.id, p])) as Record<Phase, PhaseDef>;

/** Fase "attiva" per un percorso a piedi in questa fase (per scegliere quale traccia mostrare di default). */
export function defaultRouteForPhase(phase: Phase, choice: { out: string; back: string }): string {
  switch (phase) {
    case 'leno':
      return 'walk-leno';
    case 'trek-back':
    case 'hut':
    case 'drive-home':
    case 'done':
      return choice.back;
    default:
      return choice.out;
  }
}

/** Progressione complessiva (0..1) in base alla fase. */
export function phaseProgress(phase: Phase): number {
  const i = PHASES.findIndex((p) => p.id === phase);
  return i / (PHASES.length - 1);
}

/** Indice dell'evento registrato più avanzato → fase corrispondente (per ripristino coerente). */
export function phaseFromEvents(events: ScheduleEventId[]): Phase {
  let phase: Phase = 'prep';
  for (const p of PHASES) {
    if (p.advanceEvent && events.includes(p.advanceEvent) && p.next) phase = p.next;
  }
  return phase;
}
