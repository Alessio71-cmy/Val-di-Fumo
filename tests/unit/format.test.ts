import { describe, expect, it } from 'vitest';
import { fmtAgo, fmtBytes, fmtClock, fmtDelay, fmtDistance, fmtDuration, parseClock } from '../../src/geo/format';

describe('formattazione', () => {
  it('distanze', () => {
    expect(fmtDistance(12)).toBe('12 m');
    expect(fmtDistance(347)).toBe('345 m');
    expect(fmtDistance(3494)).toBe('3,49 km');
    expect(fmtDistance(12_340)).toBe('12,3 km');
    expect(fmtDistance(null)).toBe('—');
  });
  it('durate', () => {
    expect(fmtDuration(35)).toBe('35 min');
    expect(fmtDuration(60)).toBe('1 h');
    expect(fmtDuration(99)).toBe('1 h 39');
    expect(fmtDuration(125)).toBe('2 h 05');
  });
  it('orari', () => {
    expect(fmtClock(450)).toBe('07:30');
    expect(fmtClock(1440 + 5)).toBe('00:05');
    expect(fmtClock(-10)).toBe('23:50');
    expect(parseClock('07:05')).toBe(425);
    expect(parseClock('25:00')).toBeNull();
    expect(parseClock('x')).toBeNull();
  });
  it('ritardo', () => {
    expect(fmtDelay(0)).toBe('in orario');
    expect(fmtDelay(12)).toBe('+12 min di ritardo');
    expect(fmtDelay(-7)).toBe('7 min in anticipo');
  });
  it('tempo trascorso', () => {
    expect(fmtAgo(2000)).toBe('adesso');
    expect(fmtAgo(45_000)).toBe('45 s fa');
    expect(fmtAgo(5 * 60_000)).toBe('5 min fa');
  });
  it('byte', () => {
    expect(fmtBytes(2_400_000)).toBe('2,3 MB');
    expect(fmtBytes(512)).toBe('512 B');
  });
});
