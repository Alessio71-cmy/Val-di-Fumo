import { describe, expect, it } from 'vitest';
import { classifyAccuracy, classifyAge, isUsableFix } from '../../src/gps/quality';
import { GpsController, type GeolocationLike } from '../../src/gps/controller';

class FakeGeo implements GeolocationLike {
  success: PositionCallback | null = null;
  error: PositionErrorCallback | null = null;
  opts: PositionOptions | undefined;
  watches = 0;
  cleared: number[] = [];
  watchPosition(s: PositionCallback, e?: PositionErrorCallback | null, o?: PositionOptions): number {
    this.success = s;
    this.error = e ?? null;
    this.opts = o;
    this.watches++;
    return 100 + this.watches;
  }
  clearWatch(id: number): void {
    this.cleared.push(id);
  }
  emit(lat: number, lng: number, acc: number, ts: number): void {
    this.success!({ coords: { latitude: lat, longitude: lng, accuracy: acc, altitude: 1800, altitudeAccuracy: 10, heading: null, speed: null, toJSON: () => ({}) }, timestamp: ts, toJSON: () => ({}) } as GeolocationPosition);
  }
  fail(code: 1 | 2 | 3): void {
    this.error!({ code, message: 'x', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
  }
}
const OPTS = { maximumAgeMs: 2000, timeoutMs: 30_000 };

describe('controller GPS', () => {
  it('nessuna lettura prima del consenso: il watch non parte finché non si chiama start()', () => {
    const g = new FakeGeo();
    const c = new GpsController(g, OPTS);
    expect(c.getState().status).toBe('idle');
    expect(g.watches).toBe(0);
  });
  it('start(): richiede alta precisione e passa a "requesting" poi "tracking"', () => {
    const g = new FakeGeo();
    const c = new GpsController(g, { ...OPTS, now: () => 1000 });
    c.start();
    expect(c.getState().status).toBe('requesting');
    expect(g.opts).toMatchObject({ enableHighAccuracy: true, maximumAge: 2000, timeout: 30_000 });
    g.emit(46.0845, 10.5625, 12, 5000);
    const s = c.getState();
    expect(s.status).toBe('tracking');
    expect(s.position).toMatchObject({ lat: 46.0845, lng: 10.5625, accuracyM: 12, timestamp: 5000 });
    expect(s.fixes).toBe(1);
  });
  it('start() ripetuto non crea watch doppi', () => {
    const g = new FakeGeo();
    const c = new GpsController(g, OPTS);
    c.start();
    c.start();
    expect(g.watches).toBe(1);
  });
  it('permesso negato → "denied" e watch cancellato', () => {
    const g = new FakeGeo();
    const c = new GpsController(g, OPTS);
    c.start();
    g.fail(1);
    expect(c.getState().status).toBe('denied');
    expect(g.cleared.length).toBe(1);
  });
  it('GPS non disponibile prima del primo fix → "unavailable"; dopo un fix resta "tracking" con avviso', () => {
    const g = new FakeGeo();
    const c = new GpsController(g, OPTS);
    c.start();
    g.fail(2);
    expect(c.getState().status).toBe('unavailable');
    g.emit(46, 10.5, 30, 10);
    g.fail(2);
    expect(c.getState().status).toBe('tracking');
    expect(c.getState().warning).toBe('unavailable');
  });
  it('timeout: resta in attesa e lo segnala', () => {
    const g = new FakeGeo();
    const c = new GpsController(g, OPTS);
    c.start();
    g.fail(3);
    expect(c.getState().status).toBe('requesting');
    expect(c.getState().warning).toBe('timeout');
  });
  it('geolocalizzazione assente → "unsupported"', () => {
    const c = new GpsController(undefined, OPTS);
    c.start();
    expect(c.getState().status).toBe('unsupported');
  });
  it('contesto non sicuro → "insecure" senza interrogare il dispositivo', () => {
    const g = new FakeGeo();
    const c = new GpsController(g, { ...OPTS, secureContext: false });
    c.start();
    expect(c.getState().status).toBe('insecure');
    expect(g.watches).toBe(0);
  });
  it('stop() e restart()', () => {
    const g = new FakeGeo();
    const c = new GpsController(g, OPTS);
    c.start();
    c.restart();
    expect(g.watches).toBe(2);
    expect(g.cleared.length).toBe(1);
    c.stop();
    expect(c.getState().status).toBe('idle');
    expect(g.cleared.length).toBe(2);
  });
  it('notifica gli ascoltatori e permette di annullare la sottoscrizione', () => {
    const g = new FakeGeo();
    const c = new GpsController(g, OPTS);
    const seen: string[] = [];
    const un = c.subscribe((s) => seen.push(s.status));
    c.start();
    g.emit(46, 10, 5, 1);
    un();
    g.emit(46, 10, 5, 2);
    expect(seen).toEqual(['requesting', 'tracking']);
  });
});

describe('qualità del fix', () => {
  it('classi di precisione', () => {
    expect(classifyAccuracy(8)).toBe('buona');
    expect(classifyAccuracy(35)).toBe('discreta');
    expect(classifyAccuracy(80)).toBe('scarsa');
    expect(classifyAccuracy(250)).toBe('inaffidabile');
    expect(classifyAccuracy(Number.NaN)).toBe('inaffidabile');
  });
  it('classi di età (posizione obsoleta)', () => {
    expect(classifyAge(10_000)).toBe('fresca');
    expect(classifyAge(60_000)).toBe('non-aggiornata');
    expect(classifyAge(300_000)).toBe('obsoleta');
  });
  it('un fix impreciso o obsoleto non è utilizzabile per progresso e avvisi', () => {
    const now = 1_000_000;
    expect(isUsableFix({ lat: 0, lng: 0, accuracyM: 15, timestamp: now - 5000 }, now)).toBe(true);
    expect(isUsableFix({ lat: 0, lng: 0, accuracyM: 300, timestamp: now - 5000 }, now)).toBe(false);
    expect(isUsableFix({ lat: 0, lng: 0, accuracyM: 15, timestamp: now - 600_000 }, now)).toBe(false);
  });
});
