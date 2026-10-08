import { describe, expect, it } from 'vitest';
import { buildSchedule, marginStatus, type ScheduleInput } from '../../src/schedule/engine';

const base: ScheduleInput = {
  departureMin: 7 * 60 + 30,
  paceFactor: 1,
  driveMin: { toBoazzo: 110, boazzoToDam: 20, home: 125 },
  lenoStopMin: 35,
  prepMin: 15,
  lunchMin: 45,
  hikeOutBaseMin: 99,
  hikeBackBaseMin: 91,
  extraStopsOutMin: 10,
  extraStopsBackMin: 5,
  marginFraction: 0.15,
  lightMarginMin: 60,
  sunsetMin: 18 * 60 + 43,
  civilDuskMin: 19 * 60 + 13,
  turnarounds: [
    { id: 'breguzzo', name: 'Malga Breguzzo', distanceM: 3494, outMin: 50, backMin: 45 },
    { id: 'cascata-chiese', name: 'Cascata sul Chiese', distanceM: 3639, outMin: 52, backMin: 47 },
  ],
};
const T = (h: number, m = 0) => h * 60 + m;

describe('programma orario — piano base', () => {
  const r = buildSchedule(base);
  const e = (id: string) => r.entries.find((x) => x.id === id)!;
  it('calcola gli orari pianificati in sequenza dalla partenza', () => {
    expect(e('depart').plannedEndMin).toBe(T(7, 30));
    expect(e('drive-boazzo').plannedEndMin).toBe(T(9, 20));
    expect(e('leno-stop').plannedEndMin).toBe(T(9, 55));
    expect(e('drive-dam').plannedEndMin).toBe(T(10, 15));
    expect(e('prep').plannedEndMin).toBe(T(10, 30));
    expect(e('hike-out').plannedEndMin).toBe(T(10, 30) + 99 + 10);
    expect(e('lunch').plannedEndMin).toBe(T(13, 4));
    expect(e('hike-back').plannedEndMin).toBe(T(14, 40));
    expect(e('drive-home').plannedEndMin).toBe(T(16, 45));
  });
  it('ultimo orario prudenziale per iniziare il ritorno = tramonto − 60 min − ritorno con margine', () => {
    // 18:43 − 60 = 17:43 ; ritorno 91 × 1,15 + 5 = 109,65 → 15:53
    expect(r.summary.latestReturnStartMin).toBe(T(15, 53));
    expect(r.summary.carDeadlineMin).toBe(T(17, 43));
  });
  it('con partenza alle 07:30 il margine è ampio e lo stato è ok, senza suggerimenti', () => {
    expect(r.summary.marginMin).toBe(169);
    expect(r.summary.status).toBe('ok');
    expect(r.summary.suggestions).toHaveLength(0);
    expect(r.summary.homeAfterDusk).toBe(false);
  });
  it('durata totale pianificata = 9 h 15', () => {
    expect(r.summary.totalPlannedMin).toBe(9 * 60 + 15);
  });
  it('la prima voce senza orario effettivo è quella corrente', () => {
    expect(r.summary.currentEntryId).toBe('depart');
  });
});

describe('programma orario — cambio dell\'orario di partenza e del ritmo', () => {
  it('aggiornare la partenza sposta l\'intera pianificazione', () => {
    const a = buildSchedule({ ...base, departureMin: T(7, 0) });
    const b = buildSchedule({ ...base, departureMin: T(8, 0) });
    expect(b.entries[8]!.plannedEndMin - a.entries[8]!.plannedEndMin).toBe(60);
    expect(b.summary.marginMin - a.summary.marginMin).toBe(-60);
  });
  it('ritmo lento (×1,25) allunga il cammino e riduce l\'ora limite', () => {
    const n = buildSchedule(base);
    const s = buildSchedule({ ...base, paceFactor: 1.25 });
    expect(s.entries.find((x) => x.id === 'hike-out')!.durationMin).toBe(Math.round(99 * 1.25) + 10);
    expect(s.summary.latestReturnStartMin).toBeLessThan(n.summary.latestReturnStartMin);
  });
  it('con tramonto anticipato (data più tarda) il margine cala', () => {
    const a = buildSchedule(base);
    const b = buildSchedule({ ...base, sunsetMin: T(15, 30), civilDuskMin: T(16, 0) });
    expect(b.summary.marginMin).toBeLessThan(a.summary.marginMin - 100);
    expect(b.summary.status).toBe('late');
    expect(b.summary.suggestions.length).toBeGreaterThan(0);
  });
});

describe('programma orario — orari effettivi e ritardo', () => {
  it('una partenza in ritardo di 10 minuti sposta le voci successive', () => {
    const r = buildSchedule({ ...base, actuals: { departed: T(7, 40) } });
    expect(r.entries[0]!.projectedEndMin).toBe(T(7, 40));
    expect(r.entries[8]!.projectedEndMin).toBe(T(16, 55));
    expect(r.entries[1]!.delayMin).toBe(10);
    expect(r.summary.delayMin).toBe(10);
    expect(r.entries[0]!.status).toBe('done');
    expect(r.summary.currentEntryId).toBe('drive-boazzo');
  });
  it('distingue pianificato, effettivo e proiettato', () => {
    const r = buildSchedule({ ...base, actuals: { departed: T(7, 30), 'arrived-boazzo': T(9, 40) } });
    const d = r.entries.find((x) => x.id === 'drive-boazzo')!;
    expect(d.plannedEndMin).toBe(T(9, 20));
    expect(d.actualEndMin).toBe(T(9, 40));
    expect(d.projectedEndMin).toBe(T(9, 40));
    expect(d.delayMin).toBe(20);
    const next = r.entries.find((x) => x.id === 'leno-stop')!;
    expect(next.projectedStartMin).toBe(T(9, 40));
    expect(next.projectedEndMin).toBe(T(10, 15));
    expect(next.actualEndMin).toBeUndefined();
  });
  it('scenario in ritardo: stato "tirato", suggerisce di accorciare il pranzo', () => {
    const r = buildSchedule({
      ...base,
      departureMin: T(8, 0),
      paceFactor: 1.25,
      actuals: { departed: T(8, 0), 'arrived-boazzo': T(10, 10), 'left-boazzo': T(11, 10), 'arrived-dam': T(11, 35), 'started-hike': T(12, 5) },
    });
    expect(r.summary.status).toBe('tight');
    const lunch = r.summary.suggestions.find((s) => s.kind === 'shorten-lunch');
    expect(lunch).toBeDefined();
    expect(lunch!.savedMin).toBe(15);
    expect(lunch!.sufficient).toBe(true);
    // Leno già fatto: non lo si suggerisce più
    expect(r.summary.suggestions.some((s) => s.kind === 'skip-leno' || s.kind === 'shorten-leno')).toBe(false);
  });
  it('scenario non compatibile: propone abbreviazioni dell\'itinerario con margine sufficiente', () => {
    const r = buildSchedule({ ...base, departureMin: T(8, 0), sunsetMin: T(16, 20), civilDuskMin: T(16, 50) });
    expect(r.summary.status).toBe('late');
    const t = r.summary.suggestions.filter((s) => s.kind === 'turnaround');
    expect(t.length).toBe(2);
    const breg = t.find((s) => s.turnaround!.id === 'breguzzo')!;
    expect(breg.sufficient).toBe(true);
    expect(breg.turnaround!.returnStartMin).toBeLessThan(r.summary.projectedReturnStartMin);
  });
  it('dopo l\'arrivo al rifugio non si propongono più abbreviazioni dell\'andata', () => {
    const r = buildSchedule({
      ...base,
      sunsetMin: T(16, 0),
      civilDuskMin: T(16, 30),
      actuals: { departed: T(7, 30), 'arrived-boazzo': T(9, 20), 'left-boazzo': T(9, 55), 'arrived-dam': T(10, 15), 'started-hike': T(10, 30), 'arrived-hut': T(12, 10) },
    });
    expect(r.summary.suggestions.some((s) => s.kind === 'turnaround')).toBe(false);
  });
  it('tempo rimanente all\'ora limite', () => {
    const r = buildSchedule({ ...base, nowMin: T(12, 0) });
    expect(r.summary.timeToLatestReturnMin).toBe(T(15, 53) - T(12, 0));
  });
  it('saltare il Leno azzera la sosta', () => {
    const r = buildSchedule({ ...base, skipLeno: true });
    expect(r.entries.find((x) => x.id === 'leno-stop')!.durationMin).toBe(0);
  });
});

describe('stato del margine', () => {
  it('soglie', () => {
    expect(marginStatus(45)).toBe('ok');
    expect(marginStatus(30)).toBe('ok');
    expect(marginStatus(29)).toBe('tight');
    expect(marginStatus(0)).toBe('tight');
    expect(marginStatus(-1)).toBe('late');
  });
});
