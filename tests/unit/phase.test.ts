import { describe, expect, it } from 'vitest';
import { defaultRouteForPhase, PHASES, PHASE_BY_ID, phaseFromEvents, phaseProgress } from '../../src/state/phase';
import type { ScheduleEventId } from '../../src/domain/types';

describe('fasi della giornata', () => {
  it('le etichette del pulsante principale sono quelle richieste (niente pulsanti generici)', () => {
    expect(PHASE_BY_ID.prep.primaryLabel).toBe('Prepara il viaggio');
    for (const p of ['drive-out', 'drive-dam', 'drive-home'] as const) expect(PHASE_BY_ID[p].primaryLabel).toBe('Apri navigazione stradale');
    for (const p of ['trek-prep', 'trek-out'] as const) expect(PHASE_BY_ID[p].primaryLabel).toBe('Visualizza percorso');
    expect(PHASE_BY_ID['trek-back'].primaryLabel).toBe('Torna al parcheggio');
  });
  it('la catena delle fasi percorre tutti e 9 gli eventi del programma una sola volta, nell\'ordine', () => {
    const ev: ScheduleEventId[] = [];
    let p = PHASE_BY_ID.prep;
    while (p.next) {
      ev.push(p.advanceEvent!);
      p = PHASE_BY_ID[p.next];
    }
    expect(p.id).toBe('done');
    expect(ev).toEqual(['departed', 'arrived-boazzo', 'left-boazzo', 'arrived-dam', 'started-hike', 'arrived-hut', 'started-return', 'back-at-car', 'home']);
  });
  it('destinazioni del navigatore stradale', () => {
    expect(PHASE_BY_ID['drive-out'].driveTo).toBe('park-boazzo-centrale');
    expect(PHASE_BY_ID['drive-dam'].driveTo).toBe('park-dam');
    expect(PHASE_BY_ID['drive-home'].driveTo).toBe('pergine');
  });
  it('ripristino della fase dagli eventi registrati', () => {
    expect(phaseFromEvents([])).toBe('prep');
    expect(phaseFromEvents(['departed'])).toBe('drive-out');
    expect(phaseFromEvents(['departed', 'arrived-boazzo', 'left-boazzo', 'arrived-dam', 'started-hike'])).toBe('trek-out');
    expect(phaseFromEvents(['departed', 'arrived-boazzo', 'left-boazzo', 'arrived-dam', 'started-hike', 'arrived-hut', 'started-return'])).toBe('trek-back');
  });
  it('percorso predefinito per fase e progressione', () => {
    const choice = { out: 'route-out', back: 'route-back' };
    expect(defaultRouteForPhase('leno', choice)).toBe('walk-leno');
    expect(defaultRouteForPhase('trek-out', choice)).toBe('route-out');
    expect(defaultRouteForPhase('trek-back', choice)).toBe('route-back');
    expect(phaseProgress('prep')).toBe(0);
    expect(phaseProgress('done')).toBe(1);
    expect(PHASES).toHaveLength(10);
  });
});
