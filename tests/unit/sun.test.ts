import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { directSunWindows, horizonAt, localMidnightEpoch, minutesSinceLocalMidnight, sunPosition, sunTimes, tzOffsetMinutes } from '../../src/geo/sun';

interface Vec { lat: number; lon: number; date: string; sunriseUTC: string; sunsetUTC: string; civilDuskUTC: string }
const vectors = JSON.parse(readFileSync('tests/fixtures-sun.json', 'utf8')) as Vec[];

describe('sole: confronto con astral (riferimento indipendente)', () => {
  // Tolleranza: ±2 min alle latitudini medie (quelle dell'app, 46°N). Oltre 50°N si accettano ±5 min: vicino al solstizio
  // d'estate il sole sfiora i -6° per ore e il tempo dell'evento è estremamente sensibile alla più piccola differenza
  // tra due implementazioni (non è un caso d'uso dell'app).
  for (const v of vectors) {
    const tol = Math.abs(v.lat) <= 50 ? 2 : 5;
    it(`${v.date} @ ${v.lat},${v.lon}: alba, tramonto, crepuscolo civile entro ${tol} minuti`, () => {
      const t = sunTimes(v.date, v.lat, v.lon);
      const dm = (a: number, iso: string) => Math.abs(a - Date.parse(iso)) / 60_000;
      expect(dm(t.sunrise, v.sunriseUTC)).toBeLessThan(tol);
      expect(dm(t.sunset, v.sunsetUTC)).toBeLessThan(tol);
      expect(dm(t.civilDusk, v.civilDuskUTC)).toBeLessThan(tol);
    });
  }
});

describe('sole: valori attesi per l\'escursione (9 ottobre 2026, diga)', () => {
  const t = sunTimes('2026-10-09', 46.05205, 10.51341);
  const hhmm = (ms: number) => new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }).format(ms);
  it('alba ≈ 07:27 e tramonto ≈ 18:43 (ora legale)', () => {
    expect(['07:26', '07:27', '07:28']).toContain(hhmm(t.sunrise));
    expect(['18:42', '18:43', '18:44']).toContain(hhmm(t.sunset));
  });
  it('mezzogiorno solare tra alba e tramonto', () => {
    expect(t.solarNoon).toBeGreaterThan(t.sunrise);
    expect(t.solarNoon).toBeLessThan(t.sunset);
  });
  it('altezza del sole a mezzogiorno ≈ 90 - lat + declinazione (~ -6°)', () => {
    const p = sunPosition(t.solarNoon, 46.05205, 10.51341);
    expect(p.elevationDeg).toBeGreaterThan(36);
    expect(p.elevationDeg).toBeLessThan(40);
    expect(Math.abs(p.azimuthDeg - 180)).toBeLessThan(3);
  });
});

describe('fuso orario', () => {
  it('Europe/Rome: CEST (+120) il 9 ottobre 2026, CET (+60) il 1 dicembre', () => {
    expect(tzOffsetMinutes(Date.UTC(2026, 9, 9, 10), 'Europe/Rome')).toBe(120);
    expect(tzOffsetMinutes(Date.UTC(2026, 11, 1, 10), 'Europe/Rome')).toBe(60);
  });
  it('mezzanotte locale e minuti dalla mezzanotte', () => {
    const m = localMidnightEpoch('2026-10-09', 'Europe/Rome');
    expect(new Date(m).toISOString()).toBe('2026-10-08T22:00:00.000Z');
    expect(minutesSinceLocalMidnight(Date.UTC(2026, 9, 9, 5, 30), '2026-10-09', 'Europe/Rome')).toBe(450);
  });
});

describe('orizzonte e sole diretto', () => {
  it('interpolazione circolare', () => {
    const p = { azStepDeg: 90, elev: [0, 10, 20, 30] };
    expect(horizonAt(p, 45)).toBe(5);
    expect(horizonAt(p, 315)).toBe(15); // tra 30 (270°) e 0 (360°)
    expect(horizonAt(p, 360)).toBe(0);
  });
  it('orizzonte piatto a 0°: il sole diretto dura dall\'alba al tramonto', () => {
    const flat = { azStepDeg: 2, elev: new Array(180).fill(0) };
    const w = directSunWindows('2026-10-09', 46.05, 10.52, flat, 2);
    expect(w.length).toBe(1);
    const t = sunTimes('2026-10-09', 46.05, 10.52);
    expect(Math.abs(w[0]!.from - t.sunrise)).toBeLessThan(6 * 60_000);
    expect(Math.abs(w[0]!.to - t.sunset)).toBeLessThan(6 * 60_000);
  });
  it('orizzonte a 15° verso ovest: il sole sparisce molto prima del tramonto', () => {
    const el = new Array(180).fill(0).map((_, i) => (i * 2 > 180 && i * 2 < 300 ? 15 : 0));
    const w = directSunWindows('2026-10-09', 46.05, 10.52, { azStepDeg: 2, elev: el }, 1);
    const t = sunTimes('2026-10-09', 46.05, 10.52);
    expect(t.sunset - w[w.length - 1]!.to).toBeGreaterThan(40 * 60_000);
  });
  it('dati reali del rifugio: sole diretto in finestra 10:20-11:00 → 17:20-18:00 (stima)', () => {
    const h = JSON.parse(readFileSync('public/data/geo/horizon.json', 'utf8')).points['rifugio-val-di-fumo'] as { lat: number; lon: number; azStepDeg: number; elev: number[] };
    const w = directSunWindows('2026-10-09', h.lat, h.lon, h, 1);
    const hhmm = (ms: number) => new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }).format(ms);
    const first = hhmm(w[0]!.from);
    const last = hhmm(w[w.length - 1]!.to);
    expect(first >= '10:20' && first <= '11:00').toBe(true);
    expect(last >= '17:20' && last <= '18:00').toBe(true);
  });
});
