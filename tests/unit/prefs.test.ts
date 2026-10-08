import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, sanitizePrefs } from '../../src/storage/prefs';

describe('preferenze: dati corrotti o vecchi non rompono l\'app', () => {
  it('valori mancanti → predefiniti', () => {
    expect(sanitizePrefs(undefined)).toEqual(DEFAULT_PREFS);
    expect(sanitizePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(sanitizePrefs('x')).toEqual(DEFAULT_PREFS);
    expect(sanitizePrefs({})).toEqual(DEFAULT_PREFS);
  });
  it('orario di partenza limitato alla finestra 07:00–08:00', () => {
    expect(sanitizePrefs({ departureMin: 300 }).departureMin).toBe(420);
    expect(sanitizePrefs({ departureMin: 900 }).departureMin).toBe(480);
    expect(sanitizePrefs({ departureMin: 455 }).departureMin).toBe(455);
  });
  it('campi non validi scartati', () => {
    const p = sanitizePrefs({ pace: 'turbo', theme: 'neon', textScale: 5, phase: 'boh', actuals: { departed: 'x', home: 1000 }, driveOverrides: { home: 9999, toBoazzo: 100 } });
    expect(p.pace).toBe('normale');
    expect(p.theme).toBe('auto');
    expect(p.textScale).toBe(1);
    expect(p.phase).toBe('prep');
    expect(p.actuals).toEqual({ home: 1000 });
    expect(p.driveOverrides).toEqual({ toBoazzo: 100 });
  });
  it('ultima posizione solo se completa', () => {
    expect(sanitizePrefs({ lastPosition: { lat: 1 } }).lastPosition).toBeNull();
    expect(sanitizePrefs({ lastPosition: { lat: 46, lng: 10, accuracyM: 12, timestamp: 5 } }).lastPosition).toEqual({ lat: 46, lng: 10, accuracyM: 12, timestamp: 5 });
  });
  it('per impostazione predefinita nessuna posizione è memorizzata', () => {
    expect(DEFAULT_PREFS.lastPosition).toBeNull();
    expect(DEFAULT_PREFS.hutStatus).toBe('unknown');
  });
});
