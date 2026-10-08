import { kvGet, kvSet } from '../storage/idb';

/**
 * Meteo da Open-Meteo (CC BY 4.0, uso non commerciale), recuperato SUL DISPOSITIVO quando c'è rete e memorizzato
 * con data/ora. Non è una previsione ufficiale: consultare Meteo Trentino. Mai bloccante: se manca la rete l'app
 * mostra l'ultimo dato disponibile con la sua età, oppure "non disponibile".
 */
export interface HourlyWeather {
  /** "YYYY-MM-DDTHH:MM" nell'ora locale richiesta. */
  time: string;
  hour: number;
  tempC: number | null;
  precipProbPct: number | null;
  precipMm: number | null;
  code: number | null;
  windKmh: number | null;
  gustKmh: number | null;
  freezingLevelM: number | null;
}

export interface WeatherSnapshot {
  fetchedAt: number;
  lat: number;
  lon: number;
  elevationM: number;
  dateISO: string;
  sunrise?: string | null;
  sunset?: string | null;
  hourly: HourlyWeather[];
}

export interface WeatherSummary {
  tempMinC: number | null;
  tempMaxC: number | null;
  precipProbMaxPct: number | null;
  precipSumMm: number | null;
  gustMaxKmh: number | null;
  freezingMinM: number | null;
  worstCode: number | null;
  text: string;
  hours: HourlyWeather[];
}

const CODE_IT: Record<number, string> = {
  0: 'sereno',
  1: 'prevalentemente sereno',
  2: 'parzialmente nuvoloso',
  3: 'coperto',
  45: 'nebbia',
  48: 'nebbia con brina',
  51: 'pioviggine debole',
  53: 'pioviggine',
  55: 'pioviggine intensa',
  56: 'pioviggine gelata',
  57: 'pioviggine gelata intensa',
  61: 'pioggia debole',
  63: 'pioggia',
  65: 'pioggia forte',
  66: 'pioggia gelata',
  67: 'pioggia gelata forte',
  71: 'neve debole',
  73: 'neve',
  75: 'neve forte',
  77: 'granelli di neve',
  80: 'rovesci deboli',
  81: 'rovesci',
  82: 'rovesci forti',
  85: 'rovesci di neve',
  86: 'rovesci di neve forti',
  95: 'temporale',
  96: 'temporale con grandine',
  99: 'temporale con forte grandine',
};

export function weatherCodeText(code: number | null): string {
  if (code === null) return 'n.d.';
  return CODE_IT[code] ?? `codice ${code}`;
}

/** Gravità per scegliere il codice "peggiore" della giornata. */
function codeSeverity(code: number): number {
  if (code >= 95) return 100;
  if (code >= 85) return 80;
  if (code >= 71) return 75;
  if (code >= 66) return 70;
  if (code >= 80) return 65;
  if (code >= 61) return 60;
  if (code >= 56) return 55;
  if (code >= 51) return 40;
  if (code >= 45) return 35;
  return code;
}

export function buildWeatherUrl(lat: number, lon: number, dateISO: string, elevationM: number): string {
  const q = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    elevation: String(Math.round(elevationM)),
    hourly: 'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,freezing_level_height',
    daily: 'sunrise,sunset',
    timezone: 'Europe/Rome',
    start_date: dateISO,
    end_date: dateISO,
    wind_speed_unit: 'kmh',
  });
  return `https://api.open-meteo.com/v1/forecast?${q.toString()}`;
}

type NumArr = Array<number | null> | undefined;
const at = (a: NumArr, i: number): number | null => {
  const v = a?.[i];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};

/** Interpreta la risposta in modo difensivo (campi mancanti o null non devono rompere l'interfaccia). */
export function parseWeather(json: unknown, req: { lat: number; lon: number; dateISO: string; elevationM: number }, fetchedAt: number): WeatherSnapshot {
  const j = json as {
    hourly?: { time?: string[]; temperature_2m?: NumArr; precipitation_probability?: NumArr; precipitation?: NumArr; weather_code?: NumArr; wind_speed_10m?: NumArr; wind_gusts_10m?: NumArr; freezing_level_height?: NumArr };
    daily?: { sunrise?: string[]; sunset?: string[] };
  };
  const h = j?.hourly;
  if (!h || !Array.isArray(h.time) || h.time.length === 0) throw new Error('Risposta meteo senza dati orari');
  const hourly: HourlyWeather[] = h.time.map((time, i) => ({
    time,
    hour: Number(time.slice(11, 13)),
    tempC: at(h.temperature_2m, i),
    precipProbPct: at(h.precipitation_probability, i),
    precipMm: at(h.precipitation, i),
    code: at(h.weather_code, i),
    windKmh: at(h.wind_speed_10m, i),
    gustKmh: at(h.wind_gusts_10m, i),
    freezingLevelM: at(h.freezing_level_height, i),
  }));
  return { fetchedAt, ...req, sunrise: j.daily?.sunrise?.[0] ?? null, sunset: j.daily?.sunset?.[0] ?? null, hourly };
}

const nn = (xs: Array<number | null>): number[] => xs.filter((x): x is number => x !== null);

/** Sintesi della fascia oraria dell'escursione (default 08–18). */
export function summarizeWeather(s: WeatherSnapshot, fromHour = 8, toHour = 18): WeatherSummary {
  const hours = s.hourly.filter((x) => x.hour >= fromHour && x.hour <= toHour);
  const temps = nn(hours.map((x) => x.tempC));
  const probs = nn(hours.map((x) => x.precipProbPct));
  const mm = nn(hours.map((x) => x.precipMm));
  const gusts = nn(hours.map((x) => x.gustKmh));
  const fl = nn(hours.map((x) => x.freezingLevelM));
  const codes = nn(hours.map((x) => x.code));
  const worst = codes.length ? codes.reduce((a, b) => (codeSeverity(b) > codeSeverity(a) ? b : a)) : null;
  return {
    tempMinC: temps.length ? Math.min(...temps) : null,
    tempMaxC: temps.length ? Math.max(...temps) : null,
    precipProbMaxPct: probs.length ? Math.max(...probs) : null,
    precipSumMm: mm.length ? Math.round(mm.reduce((a, b) => a + b, 0) * 10) / 10 : null,
    gustMaxKmh: gusts.length ? Math.max(...gusts) : null,
    freezingMinM: fl.length ? Math.min(...fl) : null,
    worstCode: worst,
    text: weatherCodeText(worst),
    hours,
  };
}

/** Avvertenze in linguaggio semplice derivate dalla sintesi (stime di modello). */
export function weatherFlags(sum: WeatherSummary, hutEleM = 1900): string[] {
  const f: string[] = [];
  if (sum.tempMinC !== null && sum.tempMinC <= 2) f.push('Temperature vicine o sotto lo zero: possibile ghiaccio sul fondo e nelle ombre.');
  if (sum.freezingMinM !== null && sum.freezingMinM < hutEleM + 300) f.push(`Zero termico previsto fino a ≈${Math.round(sum.freezingMinM / 50) * 50} m: neve o ghiaccio possibili a quota del rifugio.`);
  if (sum.precipProbMaxPct !== null && sum.precipProbMaxPct >= 50) f.push(`Probabilità di precipitazioni fino al ${Math.round(sum.precipProbMaxPct)} %: porta impermeabile.`);
  if (sum.gustMaxKmh !== null && sum.gustMaxKmh >= 45) f.push(`Raffiche fino a ${Math.round(sum.gustMaxKmh)} km/h: vento forte in quota.`);
  if (sum.worstCode !== null && sum.worstCode >= 95) f.push('Temporali previsti: valuta di rinunciare o anticipare il rientro.');
  return f;
}

export function weatherAgeMin(s: WeatherSnapshot, now: number): number {
  return Math.max(0, Math.round((now - s.fetchedAt) / 60_000));
}

export function isWeatherStale(s: WeatherSnapshot, now: number, staleAfterMin: number): boolean {
  return weatherAgeMin(s, now) > staleAfterMin;
}

export async function fetchWeather(
  req: { lat: number; lon: number; dateISO: string; elevationM: number },
  opts: { timeoutMs: number; fetchImpl?: typeof fetch; now?: () => number } = { timeoutMs: 8000 },
): Promise<WeatherSnapshot> {
  const f = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  try {
    const res = await f(buildWeatherUrl(req.lat, req.lon, req.dateISO, req.elevationM), { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Servizio meteo: risposta ${res.status}`);
    const json: unknown = await res.json();
    return parseWeather(json, req, (opts.now ?? Date.now)());
  } finally {
    clearTimeout(timer);
  }
}

const KEY = 'weather:last';

export async function loadCachedWeather(): Promise<WeatherSnapshot | undefined> {
  return kvGet<WeatherSnapshot>(KEY);
}

export async function saveWeather(s: WeatherSnapshot): Promise<void> {
  await kvSet(KEY, s);
}
