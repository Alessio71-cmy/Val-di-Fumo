import { describe, expect, it } from 'vitest';
import { buildWeatherUrl, fetchWeather, isWeatherStale, parseWeather, summarizeWeather, weatherAgeMin, weatherCodeText, weatherFlags } from '../../src/weather/openmeteo';

// ATTENZIONE: risposta SIMULATA con la struttura documentata di Open-Meteo. Il servizio non era raggiungibile
// dall'ambiente di sviluppo: l'integrazione dal vivo NON è stata provata (vedi docs/TEST-REPORT.md).
const hours = Array.from({ length: 24 }, (_, h) => `2026-10-09T${String(h).padStart(2, '0')}:00`);
const mock = {
  hourly: {
    time: hours,
    temperature_2m: hours.map((_, h) => 2 + Math.max(0, 9 - Math.abs(h - 14))),
    precipitation_probability: hours.map((_, h) => (h >= 13 && h <= 16 ? 60 : 10)),
    precipitation: hours.map((_, h) => (h >= 14 && h <= 15 ? 0.6 : 0)),
    weather_code: hours.map((_, h) => (h < 12 ? 2 : h < 15 ? 61 : 3)),
    wind_speed_10m: hours.map(() => 12),
    wind_gusts_10m: hours.map((_, h) => (h === 15 ? 52 : 20)),
    freezing_level_height: hours.map(() => 2400),
  },
  daily: { sunrise: ['2026-10-09T07:27'], sunset: ['2026-10-09T18:43'] },
};
const req = { lat: 46.0845, lon: 10.5625, dateISO: '2026-10-09', elevationM: 1850 };

describe('meteo (risposta simulata)', () => {
  it('URL: coordinate, data, quota, fuso, unità', () => {
    const u = new URL(buildWeatherUrl(req.lat, req.lon, req.dateISO, req.elevationM));
    expect(u.hostname).toBe('api.open-meteo.com');
    expect(u.searchParams.get('start_date')).toBe('2026-10-09');
    expect(u.searchParams.get('elevation')).toBe('1850');
    expect(u.searchParams.get('timezone')).toBe('Europe/Rome');
    expect(u.searchParams.get('hourly')).toContain('freezing_level_height');
  });
  it('parse + sintesi 08–18', () => {
    const snap = parseWeather(mock, req, 1_000_000);
    expect(snap.hourly).toHaveLength(24);
    const s = summarizeWeather(snap);
    expect(s.hours.length).toBe(11);
    expect(s.tempMaxC).toBe(11);
    expect(s.precipProbMaxPct).toBe(60);
    expect(s.gustMaxKmh).toBe(52);
    expect(s.worstCode).toBe(61);
    expect(s.text).toBe('pioggia debole');
    expect(s.precipSumMm).toBeCloseTo(1.2, 1);
    expect(snap.sunset).toBe('2026-10-09T18:43');
  });
  it('avvertenze in linguaggio semplice', () => {
    const f = weatherFlags(summarizeWeather(parseWeather(mock, req, 0)));
    expect(f.join(' ')).toMatch(/precipitazioni/);
    expect(f.join(' ')).toMatch(/Raffiche/);
  });
  it('campi mancanti/null non rompono la sintesi', () => {
    const snap = parseWeather({ hourly: { time: hours.slice(0, 3), temperature_2m: [null, 4, null] } }, req, 0);
    const s = summarizeWeather(snap, 0, 23);
    expect(s.tempMinC).toBe(4);
    expect(s.gustMaxKmh).toBeNull();
    expect(s.text).toBe('n.d.');
  });
  it('risposta senza dati orari → errore comprensibile', () => {
    expect(() => parseWeather({}, req, 0)).toThrow(/dati orari/);
  });
  it('età e dato vecchio', () => {
    const snap = parseWeather(mock, req, 0);
    expect(weatherAgeMin(snap, 125 * 60_000)).toBe(125);
    expect(isWeatherStale(snap, 125 * 60_000, 180)).toBe(false);
    expect(isWeatherStale(snap, 200 * 60_000, 180)).toBe(true);
  });
  it('codici meteo in italiano', () => {
    expect(weatherCodeText(0)).toBe('sereno');
    expect(weatherCodeText(95)).toBe('temporale');
    expect(weatherCodeText(null)).toBe('n.d.');
  });
  it('fetch: risposta non ok → errore; successo → snapshot con ora di aggiornamento', async () => {
    const ok = (async () => new Response(JSON.stringify(mock), { status: 200 })) as typeof fetch;
    const snap = await fetchWeather(req, { timeoutMs: 500, fetchImpl: ok, now: () => 42 });
    expect(snap.fetchedAt).toBe(42);
    const bad = (async () => new Response('x', { status: 400 })) as typeof fetch;
    await expect(fetchWeather(req, { timeoutMs: 500, fetchImpl: bad })).rejects.toThrow(/400/);
  });
  it('fetch: timeout (rete lenta/assente) non resta appeso', async () => {
    const slow = ((_: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      })) as typeof fetch;
    await expect(fetchWeather(req, { timeoutMs: 30, fetchImpl: slow })).rejects.toThrow();
  });
});
