import type { LngLat } from '../domain/types';
import { Polyline } from './polyline';

export interface GpxPoint {
  lon: number;
  lat: number;
  ele?: number;
}
export interface GpxTrack {
  name: string;
  points: GpxPoint[];
}
export interface GpxWaypoint extends GpxPoint {
  name: string;
  desc?: string;
}
export interface GpxData {
  name?: string;
  tracks: GpxTrack[];
  waypoints: GpxWaypoint[];
}

export const MAX_GPX_BYTES = 5 * 1024 * 1024;

function num(el: Element | null, attr: string): number | null {
  if (!el) return null;
  const v = Number(el.getAttribute(attr));
  return Number.isFinite(v) ? v : null;
}

function text(el: Element, tag: string): string | undefined {
  const c = el.getElementsByTagName(tag)[0];
  const t = c?.textContent?.trim();
  return t ? t : undefined;
}

function readPoints(parent: Element, tag: string): GpxPoint[] {
  const out: GpxPoint[] = [];
  const els = parent.getElementsByTagName(tag);
  for (let i = 0; i < els.length; i++) {
    const el = els[i] as Element;
    const lat = num(el, 'lat');
    const lon = num(el, 'lon');
    if (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    const ele = Number(text(el, 'ele'));
    out.push(Number.isFinite(ele) && text(el, 'ele') !== undefined ? { lon, lat, ele } : { lon, lat });
  }
  return out;
}

/** Interpreta un file GPX 1.0/1.1 (tracce, rotte, waypoint). Lancia un errore con messaggio in italiano se non valido. */
export function parseGpx(xml: string): GpxData {
  if (xml.length > MAX_GPX_BYTES) throw new Error('File GPX troppo grande (massimo 5 MB).');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0 || !doc.documentElement || doc.documentElement.localName.toLowerCase() !== 'gpx') {
    throw new Error('Il file non è un GPX valido.');
  }
  const tracks: GpxTrack[] = [];
  const trks = doc.getElementsByTagName('trk');
  for (let i = 0; i < trks.length; i++) {
    const trk = trks[i] as Element;
    const pts = readPoints(trk, 'trkpt');
    if (pts.length >= 2) tracks.push({ name: text(trk, 'name') ?? `Traccia ${i + 1}`, points: pts });
  }
  const rtes = doc.getElementsByTagName('rte');
  for (let i = 0; i < rtes.length; i++) {
    const rte = rtes[i] as Element;
    const pts = readPoints(rte, 'rtept');
    if (pts.length >= 2) tracks.push({ name: text(rte, 'name') ?? `Rotta ${i + 1}`, points: pts });
  }
  const waypoints: GpxWaypoint[] = [];
  const wpts = doc.getElementsByTagName('wpt');
  for (let i = 0; i < wpts.length; i++) {
    const el = wpts[i] as Element;
    const lat = num(el, 'lat');
    const lon = num(el, 'lon');
    if (lat === null || lon === null) continue;
    const eleTxt = text(el, 'ele');
    const ele = eleTxt !== undefined && Number.isFinite(Number(eleTxt)) ? Number(eleTxt) : undefined;
    waypoints.push({ lat, lon, ele, name: text(el, 'name') ?? `Punto ${i + 1}`, desc: text(el, 'desc') });
  }
  const meta = doc.getElementsByTagName('metadata')[0];
  if (tracks.length === 0) throw new Error('Il GPX non contiene tracce utilizzabili (servono almeno 2 punti).');
  return { name: meta ? text(meta, 'name') : undefined, tracks, waypoints };
}

/** Riduce il numero di punti mantenendo la forma (distanza minima tra punti consecutivi in gradi ≈ metri). */
export function decimate(points: GpxPoint[], minStepM = 5): GpxPoint[] {
  if (points.length <= 2) return points;
  const out: GpxPoint[] = [points[0] as GpxPoint];
  let last = points[0] as GpxPoint;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i] as GpxPoint;
    const dx = (p.lon - last.lon) * 111_320 * Math.cos((p.lat * Math.PI) / 180);
    const dy = (p.lat - last.lat) * 110_540;
    if (Math.hypot(dx, dy) >= minStepM) {
      out.push(p);
      last = p;
    }
  }
  out.push(points[points.length - 1] as GpxPoint);
  return out;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface GpxExportInput {
  name: string;
  description: string;
  points: Array<{ lon: number; lat: number; ele?: number }>;
  waypoints?: GpxWaypoint[];
}

/** Serializza una traccia in GPX 1.1 con avvertenza sulla provenienza dei dati. */
export function toGpx(input: GpxExportInput, now = new Date()): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Val di Fumo Trail Companion" xmlns="http://www.topografix.com/GPX/1/1">',
    '<metadata>',
    `<name>${esc(input.name)}</name>`,
    `<desc>${esc(input.description)}</desc>`,
    '<copyright author="OpenStreetMap contributors"><year>2026</year><license>https://opendatacommons.org/licenses/odbl/1-0/</license></copyright>',
    `<time>${now.toISOString()}</time>`,
    '</metadata>',
  ];
  for (const w of input.waypoints ?? []) {
    lines.push(`<wpt lat="${w.lat.toFixed(6)}" lon="${w.lon.toFixed(6)}">`);
    if (w.ele !== undefined) lines.push(`<ele>${Math.round(w.ele)}</ele>`);
    lines.push(`<name>${esc(w.name)}</name>`);
    if (w.desc) lines.push(`<desc>${esc(w.desc)}</desc>`);
    lines.push('</wpt>');
  }
  lines.push(`<trk><name>${esc(input.name)}</name><desc>${esc(input.description)}</desc><trkseg>`);
  for (const p of input.points) {
    lines.push(`<trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}">${p.ele !== undefined ? `<ele>${Math.round(p.ele)}</ele>` : ''}</trkpt>`);
  }
  lines.push('</trkseg></trk></gpx>');
  return lines.join('\n') + '\n';
}

export type TrackVerdict = 'coerente' | 'parzialmente-coerente' | 'diversa';

export interface TrackComparison {
  /** Numero di campioni (ogni ~20 m) della traccia importata. */
  samples: number;
  meanM: number;
  medianM: number;
  p95M: number;
  maxM: number;
  /** Quota (%) di campioni della traccia importata entro 25 m / 50 m da quella di riferimento. */
  within25Pct: number;
  within50Pct: number;
  /** Quota (%) della traccia di riferimento coperta (entro 50 m) dalla traccia importata. */
  coverageOfReferencePct: number;
  lengthRatio: number;
  verdict: TrackVerdict;
  notes: string[];
}

function resample(line: Polyline, stepM: number): LngLat[] {
  const n = Math.max(2, Math.ceil(line.length / stepM) + 1);
  const out: LngLat[] = [];
  for (let i = 0; i < n; i++) out.push(line.pointAt((i * line.length) / (n - 1)));
  return out;
}

/** Confronta una traccia importata con quella di riferimento (nessuna rete: tutto sul dispositivo). */
export function compareToReference(reference: Polyline, otherPts: LngLat[], stepM = 20): TrackComparison {
  const other = new Polyline(otherPts);
  const samples = resample(other, stepM);
  const d = samples.map((p) => reference.project(p).dist).sort((a, b) => a - b);
  const pct = (x: number) => (100 * d.filter((v) => v <= x).length) / d.length;
  const q = (p: number) => d[Math.min(d.length - 1, Math.floor(p * d.length))] as number;
  const refSamples = resample(reference, stepM);
  const covered = refSamples.filter((p) => other.project(p).dist <= 50).length;
  const coverage = (100 * covered) / refSamples.length;
  const lengthRatio = other.length / reference.length;
  const within50 = pct(50);
  const notes: string[] = [];
  if (lengthRatio < 0.7 || lengthRatio > 1.3) notes.push(`Lunghezza molto diversa (${(lengthRatio * 100).toFixed(0)} % della traccia incorporata).`);
  if (coverage < 90) notes.push(`La traccia importata copre solo il ${coverage.toFixed(0)} % del percorso incorporato.`);
  let verdict: TrackVerdict;
  if (q(0.95) <= 40 && coverage >= 90 && within50 >= 95) verdict = 'coerente';
  else if (within50 >= 70 && coverage >= 60) verdict = 'parzialmente-coerente';
  else verdict = 'diversa';
  return {
    samples: d.length,
    meanM: d.reduce((a, b) => a + b, 0) / d.length,
    medianM: q(0.5),
    p95M: q(0.95),
    maxM: d[d.length - 1] as number,
    within25Pct: pct(25),
    within50Pct: within50,
    coverageOfReferencePct: coverage,
    lengthRatio,
    verdict,
    notes,
  };
}
