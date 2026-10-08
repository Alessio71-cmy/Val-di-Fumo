/**
 * Posizione del sole, alba/tramonto e crepuscolo — algoritmo NOAA (General Solar Position Calculations).
 * Calcolo interamente locale: nessuna rete. Verificato contro la libreria `astral` (tests/sun.test.ts, ±2 min).
 *
 * Convenzioni: longitudine positiva a est; tempi in epoch ms (UTC).
 */
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

const SUNRISE_ZENITH = 90.833; // rifrazione + semidiametro
const CIVIL_ZENITH = 96;

interface SolarParams {
  decl: number; // rad
  eqTime: number; // minuti
}

function julianDay(epochMs: number): number {
  return epochMs / 86_400_000 + 2_440_587.5;
}

function solarParams(epochMs: number): SolarParams {
  const T = (julianDay(epochMs) - 2_451_545.0) / 36_525.0;
  const L0 = (280.46646 + T * (36_000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35_999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const Mr = M * RAD;
  const C =
    Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * Mr) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * Mr) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = (trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD)) * RAD;
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = (eps0 + 0.00256 * Math.cos(omega * RAD)) * RAD;
  const decl = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const y = Math.tan(eps / 2) ** 2;
  const L0r = L0 * RAD;
  const eqTime =
    4 *
    DEG *
    (y * Math.sin(2 * L0r) -
      2 * e * Math.sin(Mr) +
      4 * e * y * Math.sin(Mr) * Math.cos(2 * L0r) -
      0.5 * y * y * Math.sin(4 * L0r) -
      1.25 * e * e * Math.sin(2 * Mr));
  return { decl, eqTime };
}

function refraction(elevDeg: number): number {
  // correzione in gradi (NOAA)
  if (elevDeg > 85) return 0;
  const tanE = Math.tan(elevDeg * RAD);
  let sec: number;
  if (elevDeg > 5) sec = 58.1 / tanE - 0.07 / tanE ** 3 + 0.000086 / tanE ** 5;
  else if (elevDeg > -0.575) sec = 1735 + elevDeg * (-518.2 + elevDeg * (103.4 + elevDeg * (-12.79 + elevDeg * 0.711)));
  else sec = -20.772 / tanE;
  return sec / 3600;
}

export interface SunPosition {
  /** Altezza sull'orizzonte matematico (gradi), con rifrazione. */
  elevationDeg: number;
  /** Azimut (gradi da nord, orario). */
  azimuthDeg: number;
}

export function sunPosition(epochMs: number, lat: number, lon: number): SunPosition {
  const { decl, eqTime } = solarParams(epochMs);
  const minutesUTC = (((epochMs / 60_000) % 1440) + 1440) % 1440;
  const tst = (((minutesUTC + eqTime + 4 * lon) % 1440) + 1440) % 1440;
  let H = tst / 4 - 180;
  if (H < -180) H += 360;
  const latr = lat * RAD;
  const cosZ = Math.sin(latr) * Math.sin(decl) + Math.cos(latr) * Math.cos(decl) * Math.cos(H * RAD);
  const zen = Math.acos(Math.max(-1, Math.min(1, cosZ)));
  const elev = 90 - zen * DEG;
  const denom = Math.cos(latr) * Math.sin(zen);
  let az: number;
  if (Math.abs(denom) > 0.001) {
    const x = Math.max(-1, Math.min(1, (Math.sin(latr) * cosZ - Math.sin(decl)) / denom));
    const a = Math.acos(x) * DEG;
    az = H > 0 ? (a + 180) % 360 : (540 - a) % 360;
  } else {
    az = lat > 0 ? 180 : 0;
  }
  return { elevationDeg: elev + refraction(elev), azimuthDeg: az };
}

export interface SunTimes {
  sunrise: number;
  sunset: number;
  solarNoon: number;
  civilDawn: number;
  civilDusk: number;
}

/** Istanti (epoch ms) per la data civile `dateISO` (YYYY-MM-DD) in Europa (data UTC = data locale per alba/tramonto). */
export function sunTimes(dateISO: string, lat: number, lon: number): SunTimes {
  const [y, m, d] = dateISO.split('-').map(Number) as [number, number, number];
  const midnight = Date.UTC(y, m - 1, d);
  const latr = lat * RAD;

  const event = (zenith: number, rising: boolean): number => {
    // stima iniziale dal mezzogiorno solare, poi 3 iterazioni valutando decl/eqTime all'istante stimato
    let tMin = 720 - 4 * lon;
    for (let i = 0; i < 4; i++) {
      const { decl, eqTime } = solarParams(midnight + tMin * 60_000);
      const cosH = Math.cos(zenith * RAD) / (Math.cos(latr) * Math.cos(decl)) - Math.tan(latr) * Math.tan(decl);
      const ha = Math.acos(Math.max(-1, Math.min(1, cosH))) * DEG;
      tMin = rising ? 720 - 4 * (lon + ha) - eqTime : 720 - 4 * (lon - ha) - eqTime;
    }
    return midnight + tMin * 60_000;
  };

  const { eqTime } = solarParams(midnight + (720 - 4 * lon) * 60_000);
  const solarNoon = midnight + (720 - 4 * lon - eqTime) * 60_000;
  return {
    sunrise: event(SUNRISE_ZENITH, true),
    sunset: event(SUNRISE_ZENITH, false),
    solarNoon,
    civilDawn: event(CIVIL_ZENITH, true),
    civilDusk: event(CIVIL_ZENITH, false),
  };
}

/** Profilo dell'orizzonte (da DEM): elevazione in gradi ogni `azStepDeg` gradi di azimut, da 0 (nord) in senso orario. */
export interface HorizonProfile {
  azStepDeg: number;
  elev: number[];
}

export function horizonAt(profile: HorizonProfile, azimuthDeg: number): number {
  const n = profile.elev.length;
  const a = (((azimuthDeg % 360) + 360) % 360) / profile.azStepDeg;
  const i0 = Math.floor(a) % n;
  const i1 = (i0 + 1) % n;
  const f = a - Math.floor(a);
  return (profile.elev[i0] as number) * (1 - f) + (profile.elev[i1] as number) * f;
}

export interface Interval {
  from: number;
  to: number;
}

/**
 * Finestre (epoch ms) in cui il sole è sopra sia l'orizzonte matematico sia il profilo del rilievo.
 * STIMA: dal DEM ~25 m, senza vegetazione/edifici; incertezza tipica ±15-20 minuti.
 */
export function directSunWindows(dateISO: string, lat: number, lon: number, profile: HorizonProfile, stepMin = 1): Interval[] {
  const t = sunTimes(dateISO, lat, lon);
  const out: Interval[] = [];
  let start: number | null = null;
  for (let ms = t.sunrise - 30 * 60_000; ms <= t.sunset + 30 * 60_000; ms += stepMin * 60_000) {
    const { elevationDeg, azimuthDeg } = sunPosition(ms, lat, lon);
    const lit = elevationDeg > 0 && elevationDeg > horizonAt(profile, azimuthDeg);
    if (lit && start === null) start = ms;
    if (!lit && start !== null) {
      out.push({ from: start, to: ms });
      start = null;
    }
  }
  if (start !== null) out.push({ from: start, to: t.sunset });
  return out;
}

// ---- fuso orario (senza librerie) ----

export function tzOffsetMinutes(epochMs: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(epochMs)) parts[p.type] = p.value;
  const asUTC = Date.UTC(+(parts.year as string), +(parts.month as string) - 1, +(parts.day as string), +(parts.hour as string), +(parts.minute as string), +(parts.second as string));
  return Math.round((asUTC - Math.floor(epochMs / 1000) * 1000) / 60_000);
}

/** Epoch ms della mezzanotte locale della data `dateISO` nel fuso `timeZone`. */
export function localMidnightEpoch(dateISO: string, timeZone: string): number {
  const [y, m, d] = dateISO.split('-').map(Number) as [number, number, number];
  const base = Date.UTC(y, m - 1, d);
  let guess = base;
  for (let i = 0; i < 3; i++) guess = base - tzOffsetMinutes(guess, timeZone) * 60_000;
  return guess;
}

/** Minuti dalla mezzanotte locale della data `dateISO` (può uscire da [0,1440) se l'istante è su un altro giorno). */
export function minutesSinceLocalMidnight(epochMs: number, dateISO: string, timeZone: string): number {
  return (epochMs - localMidnightEpoch(dateISO, timeZone)) / 60_000;
}
