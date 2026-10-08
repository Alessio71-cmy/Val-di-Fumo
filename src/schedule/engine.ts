import type { ScheduleEntry, ScheduleEventId, ScheduleKind } from '../domain/types';

/** Orari effettivi registrati dall'utente (minuti dalla mezzanotte locale della data dell'escursione). */
export type Actuals = Partial<Record<ScheduleEventId, number>>;

export interface TurnaroundOption {
  id: string;
  name: string;
  /** Distanza dall'inizio del percorso (m). */
  distanceM: number;
  /** Tempo nominale di andata fino a qui (min, ritmo normale). */
  outMin: number;
  /** Tempo nominale di ritorno da qui al parcheggio (min, ritmo normale). */
  backMin: number;
}

export interface ScheduleInput {
  departureMin: number;
  /** 1 = ritmo normale. */
  paceFactor: number;
  driveMin: { toBoazzo: number; boazzoToDam: number; home: number };
  lenoStopMin: number;
  prepMin: number;
  lunchMin: number;
  /** Tempo nominale di cammino (ritmo normale), dai dati del percorso. */
  hikeOutBaseMin: number;
  hikeBackBaseMin: number;
  extraStopsOutMin: number;
  extraStopsBackMin: number;
  marginFraction: number;
  lightMarginMin: number;
  sunsetMin: number;
  civilDuskMin: number;
  actuals?: Actuals;
  /** Ora corrente (minuti dalla mezzanotte), per "tempo rimanente". */
  nowMin?: number;
  turnarounds?: TurnaroundOption[];
  skipLeno?: boolean;
  /** Soglie (min) per lo stato del margine. */
  tightMarginMin?: number;
  sufficientMarginMin?: number;
}

type Basis = ScheduleEntry['basis'];

interface EntryDef {
  id: ScheduleKind;
  label: string;
  duration: number;
  basis: Basis;
  endEvent: ScheduleEventId;
}

const END_EVENT: Record<ScheduleKind, ScheduleEventId> = {
  depart: 'departed',
  'drive-boazzo': 'arrived-boazzo',
  'leno-stop': 'left-boazzo',
  'drive-dam': 'arrived-dam',
  prep: 'started-hike',
  'hike-out': 'arrived-hut',
  lunch: 'started-return',
  'hike-back': 'back-at-car',
  'drive-home': 'home',
};

export const SCHEDULE_LABEL: Record<ScheduleKind, string> = {
  depart: 'Partenza da Pergine',
  'drive-boazzo': 'In auto fino a Boazzo',
  'leno-stop': 'Cascata del Leno (sosta fotografica)',
  'drive-dam': 'In auto fino alla diga di Malga Bissina',
  prep: 'Preparazione e partenza del trekking',
  'hike-out': 'Cammino fino al Rifugio Val di Fumo',
  lunch: 'Pranzo al sacco e foto',
  'hike-back': 'Ritorno a piedi alla diga',
  'drive-home': 'Rientro in auto a Pergine',
};

export type MarginStatus = 'ok' | 'tight' | 'late';

export interface Suggestion {
  id: string;
  kind: 'shorten-lunch' | 'shorten-leno' | 'skip-leno' | 'turnaround';
  /** Minuti recuperati sul margine. */
  savedMin: number;
  /** Margine risultante (min) rispetto all'ora limite per iniziare il ritorno. */
  resultingMarginMin: number;
  sufficient: boolean;
  /** Per le abbreviazioni dell'itinerario. */
  turnaround?: { id: string; name: string; distanceM: number; returnStartMin: number; backAtCarMin: number };
}

export interface ScheduleSummary {
  /** Orario previsto di arrivo al rifugio (proiettato). */
  arrivalHutMin: number;
  plannedReturnStartMin: number;
  projectedReturnStartMin: number;
  /** Ultimo orario prudenziale per INIZIARE il ritorno dal rifugio. */
  latestReturnStartMin: number;
  /** Ora entro cui essere all'auto (tramonto − margine di luce). */
  carDeadlineMin: number;
  /** Margine (min) tra l'ora limite e il ritorno proiettato; negativo = oltre il limite. */
  marginMin: number;
  status: MarginStatus;
  projectedBackAtCarMin: number;
  projectedHomeMin: number;
  homeAfterDusk: boolean;
  sunsetMin: number;
  civilDuskMin: number;
  /** Ritardo corrente rispetto al piano (min), dall'ultimo evento registrato. */
  delayMin: number;
  /** Tempo rimanente (min) all'ultimo orario prudenziale per iniziare il ritorno, se noto `nowMin`. */
  timeToLatestReturnMin?: number;
  currentEntryId?: ScheduleKind;
  /** Durata totale pianificata (partenza → rientro). */
  totalPlannedMin: number;
  suggestions: Suggestion[];
}

export interface ScheduleResult {
  entries: ScheduleEntry[];
  summary: ScheduleSummary;
}

function defs(i: ScheduleInput): EntryDef[] {
  const out = Math.round(i.hikeOutBaseMin * i.paceFactor) + i.extraStopsOutMin;
  const back = Math.round(i.hikeBackBaseMin * i.paceFactor) + i.extraStopsBackMin;
  const leno = i.skipLeno ? 0 : i.lenoStopMin;
  return [
    { id: 'depart', label: SCHEDULE_LABEL.depart, duration: 0, basis: 'user', endEvent: END_EVENT.depart },
    { id: 'drive-boazzo', label: SCHEDULE_LABEL['drive-boazzo'], duration: i.driveMin.toBoazzo, basis: 'estimated', endEvent: END_EVENT['drive-boazzo'] },
    { id: 'leno-stop', label: SCHEDULE_LABEL['leno-stop'], duration: leno, basis: 'estimated', endEvent: END_EVENT['leno-stop'] },
    { id: 'drive-dam', label: SCHEDULE_LABEL['drive-dam'], duration: i.driveMin.boazzoToDam, basis: 'estimated', endEvent: END_EVENT['drive-dam'] },
    { id: 'prep', label: SCHEDULE_LABEL.prep, duration: i.prepMin, basis: 'user', endEvent: END_EVENT.prep },
    { id: 'hike-out', label: SCHEDULE_LABEL['hike-out'], duration: out, basis: 'model', endEvent: END_EVENT['hike-out'] },
    { id: 'lunch', label: SCHEDULE_LABEL.lunch, duration: i.lunchMin, basis: 'user', endEvent: END_EVENT.lunch },
    { id: 'hike-back', label: SCHEDULE_LABEL['hike-back'], duration: back, basis: 'model', endEvent: END_EVENT['hike-back'] },
    { id: 'drive-home', label: SCHEDULE_LABEL['drive-home'], duration: i.driveMin.home, basis: 'estimated', endEvent: END_EVENT['drive-home'] },
  ];
}

function latestReturnStart(i: ScheduleInput, backBaseMin = i.hikeBackBaseMin): number {
  const walk = Math.round(backBaseMin * i.paceFactor);
  const needed = walk * (1 + i.marginFraction) + i.extraStopsBackMin;
  return i.sunsetMin - i.lightMarginMin - needed;
}

export function marginStatus(marginMin: number, tight = 30): MarginStatus {
  if (marginMin >= tight) return 'ok';
  if (marginMin >= 0) return 'tight';
  return 'late';
}

export function buildSchedule(input: ScheduleInput): ScheduleResult {
  const actuals = input.actuals ?? {};
  const d = defs(input);
  const entries: ScheduleEntry[] = [];

  let plannedCursor = input.departureMin;
  let projectedCursor: number | null = null;
  let firstOpen: ScheduleKind | undefined;
  let lastDelay = 0;

  d.forEach((def, idx) => {
    const plannedStart = plannedCursor;
    const plannedEnd = plannedStart + def.duration;
    plannedCursor = plannedEnd;

    const actualEnd = actuals[def.endEvent];
    const prev = entries[idx - 1];
    const actualStart = idx === 0 ? undefined : prev ? (actuals[END_EVENT[prev.id]] ?? undefined) : undefined;

    const projectedStart: number = idx === 0 ? (actualEnd ?? plannedStart) : (projectedCursor as number);
    const projectedEnd: number = actualEnd !== undefined ? actualEnd : idx === 0 ? plannedEnd : projectedStart + def.duration;
    projectedCursor = projectedEnd;

    const done = actualEnd !== undefined;
    if (!done && firstOpen === undefined) firstOpen = def.id;
    const status: ScheduleEntry['status'] = done ? 'done' : firstOpen === def.id ? 'current' : 'future';
    const delay = projectedEnd - plannedEnd;
    if (done) lastDelay = delay;

    entries.push({
      id: def.id,
      label: def.label,
      plannedStartMin: plannedStart,
      plannedEndMin: plannedEnd,
      durationMin: def.duration,
      basis: def.basis,
      actualStartMin: idx === 0 ? actualEnd : actualStart,
      actualEndMin: actualEnd,
      projectedStartMin: projectedStart,
      projectedEndMin: projectedEnd,
      delayMin: delay,
      status,
    });
  });

  const get = (id: ScheduleKind) => entries.find((e) => e.id === id) as ScheduleEntry;
  const hut = get('hike-out');
  const lunch = get('lunch');
  const back = get('hike-back');
  const home = get('drive-home');

  const latest = latestReturnStart(input);
  const margin = latest - lunch.projectedEndMin;
  const tight = input.tightMarginMin ?? 30;
  const sufficient = input.sufficientMarginMin ?? 15;
  const status = marginStatus(margin, tight);

  const suggestions: Suggestion[] = [];
  if (status !== 'ok') {
    const returnRecorded = actuals['started-return'] !== undefined;
    const lenoDone = actuals['left-boazzo'] !== undefined;
    const hutDone = actuals['arrived-hut'] !== undefined;
    const mk = (id: string, kind: Suggestion['kind'], saved: number, extra?: Partial<Suggestion>): Suggestion => ({
      id,
      kind,
      savedMin: saved,
      resultingMarginMin: Math.round(margin + saved),
      sufficient: margin + saved >= sufficient,
      ...extra,
    });
    if (!returnRecorded && input.lunchMin > 30) suggestions.push(mk('lunch-30', 'shorten-lunch', input.lunchMin - 30));
    if (!lenoDone && !input.skipLeno && input.lenoStopMin > 20) suggestions.push(mk('leno-20', 'shorten-leno', input.lenoStopMin - 20));
    if (!lenoDone && !input.skipLeno && input.lenoStopMin > 0) suggestions.push(mk('leno-skip', 'skip-leno', input.lenoStopMin));
    if (!hutDone && !returnRecorded) {
      for (const t of input.turnarounds ?? []) {
        const outWalk = Math.round(t.outMin * input.paceFactor) + Math.round(input.extraStopsOutMin / 2);
        const backWalk = Math.round(t.backMin * input.paceFactor) + input.extraStopsBackMin;
        const startHike = get('prep').projectedEndMin;
        const returnStart = startHike + outWalk + Math.min(input.lunchMin, 30);
        const latestHere = input.sunsetMin - input.lightMarginMin - (Math.round(t.backMin * input.paceFactor) * (1 + input.marginFraction) + input.extraStopsBackMin);
        const m = latestHere - returnStart;
        suggestions.push({
          id: `turn-${t.id}`,
          kind: 'turnaround',
          savedMin: Math.round(m - margin),
          resultingMarginMin: Math.round(m),
          sufficient: m >= sufficient,
          turnaround: { id: t.id, name: t.name, distanceM: t.distanceM, returnStartMin: Math.round(returnStart), backAtCarMin: Math.round(returnStart + backWalk) },
        });
      }
    }
  }

  const current = entries.find((e) => e.status === 'current');
  const summary: ScheduleSummary = {
    arrivalHutMin: hut.projectedEndMin,
    plannedReturnStartMin: lunch.plannedEndMin,
    projectedReturnStartMin: lunch.projectedEndMin,
    latestReturnStartMin: Math.round(latest),
    carDeadlineMin: input.sunsetMin - input.lightMarginMin,
    marginMin: Math.round(margin),
    status,
    projectedBackAtCarMin: back.projectedEndMin,
    projectedHomeMin: home.projectedEndMin,
    homeAfterDusk: home.projectedEndMin > input.civilDuskMin,
    sunsetMin: input.sunsetMin,
    civilDuskMin: input.civilDuskMin,
    delayMin: Math.round(lastDelay),
    timeToLatestReturnMin: input.nowMin !== undefined ? Math.round(latest - input.nowMin) : undefined,
    currentEntryId: current?.id,
    totalPlannedMin: home.plannedEndMin - input.departureMin,
    suggestions,
  };
  return { entries, summary };
}
