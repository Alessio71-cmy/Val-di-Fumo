import type { LngLat } from '../domain/types';
import { bearing, centroid, localProjector, localUnprojector } from './geodesy';

export interface Projection {
  /** Distanza lungo la traccia dal primo vertice (m). */
  along: number;
  /** Distanza dal punto più vicino della traccia (m). */
  dist: number;
  segment: number;
  /** Parametro (0..1) sul segmento. */
  t: number;
  point: LngLat;
}

export interface ProjectOptions {
  /** Limita la ricerca ai segmenti che intersecano [minAlong, maxAlong] (continuità del tracking). */
  minAlong?: number;
  maxAlong?: number;
}

/**
 * Polilinea con progressive cumulate (m). Tutte le distanze sono calcolate lungo la GEOMETRIA della traccia,
 * non in linea d'aria. Proiezione equirettangolare locale: errore < 0,1 % su tracce di pochi km.
 */
export class Polyline {
  readonly points: LngLat[];
  readonly cum: Float64Array;
  readonly length: number;
  private readonly xy: Float64Array;
  private readonly project_: (p: LngLat) => [number, number];
  private readonly unproject_: (xy: [number, number]) => LngLat;

  constructor(points: LngLat[]) {
    if (points.length < 2) throw new Error('Polyline: servono almeno 2 punti');
    this.points = points;
    const origin = centroid(points);
    this.project_ = localProjector(origin);
    this.unproject_ = localUnprojector(origin);
    this.xy = new Float64Array(points.length * 2);
    this.cum = new Float64Array(points.length);
    for (let i = 0; i < points.length; i++) {
      const [x, y] = this.project_(points[i] as LngLat);
      this.xy[2 * i] = x;
      this.xy[2 * i + 1] = y;
      if (i > 0) {
        const dx = x - (this.xy[2 * (i - 1)] as number);
        const dy = y - (this.xy[2 * (i - 1) + 1] as number);
        this.cum[i] = (this.cum[i - 1] as number) + Math.hypot(dx, dy);
      }
    }
    this.length = this.cum[points.length - 1] as number;
  }

  /** Proietta un punto sulla traccia. Con opts limita la ricerca a una finestra di progressive; se nella finestra non c'è nulla di vicino ricade sulla ricerca globale. */
  project(p: LngLat, opts: ProjectOptions = {}): Projection {
    const [px, py] = this.project_(p);
    const windowed = this.bestSegment(px, py, opts.minAlong, opts.maxAlong);
    if (windowed && windowed.dist < 150) return this.toProjection(windowed);
    const global = this.bestSegment(px, py);
    return this.toProjection(global as BestSeg);
  }

  private bestSegment(px: number, py: number, minAlong?: number, maxAlong?: number): BestSeg | null {
    let best: BestSeg | null = null;
    const n = this.points.length;
    for (let i = 0; i < n - 1; i++) {
      const c0 = this.cum[i] as number;
      const c1 = this.cum[i + 1] as number;
      if (minAlong !== undefined && c1 < minAlong) continue;
      if (maxAlong !== undefined && c0 > maxAlong) continue;
      const ax = this.xy[2 * i] as number;
      const ay = this.xy[2 * i + 1] as number;
      const bx = this.xy[2 * (i + 1)] as number;
      const by = this.xy[2 * (i + 1) + 1] as number;
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const cx = ax + t * dx;
      const cy = ay + t * dy;
      const dist = Math.hypot(px - cx, py - cy);
      if (!best || dist < best.dist) best = { i, t, dist, cx, cy, c0, segLen: Math.sqrt(len2) };
    }
    return best;
  }

  private toProjection(b: BestSeg): Projection {
    return {
      along: b.c0 + b.t * b.segLen,
      dist: b.dist,
      segment: b.i,
      t: b.t,
      point: this.unproject_([b.cx, b.cy]),
    };
  }

  /** Punto alla progressiva `along` (m), limitata a [0, length]. */
  pointAt(along: number): LngLat {
    const a = Math.max(0, Math.min(this.length, along));
    // ricerca binaria del segmento
    let lo = 0;
    let hi = this.points.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if ((this.cum[mid] as number) <= a) lo = mid;
      else hi = mid;
    }
    const c0 = this.cum[lo] as number;
    const c1 = this.cum[lo + 1] as number;
    const t = c1 > c0 ? (a - c0) / (c1 - c0) : 0;
    const ax = this.xy[2 * lo] as number;
    const ay = this.xy[2 * lo + 1] as number;
    const bx = this.xy[2 * (lo + 1)] as number;
    const by = this.xy[2 * (lo + 1) + 1] as number;
    return this.unproject_([ax + t * (bx - ax), ay + t * (by - ay)]);
  }

  /** Direzione di marcia (gradi) alla progressiva `along`, guardando `lookahead` m avanti. */
  bearingAt(along: number, lookahead = 25): number {
    const a = Math.max(0, Math.min(this.length - 1, along));
    const b = Math.min(this.length, a + lookahead);
    const p0 = this.pointAt(a);
    const p1 = this.pointAt(b > a ? b : this.length);
    return bearing(p0, p1);
  }

  /** Vertici della traccia fra due progressive (con i punti estremi interpolati). */
  slice(from: number, to: number): LngLat[] {
    const a = Math.max(0, Math.min(from, to));
    const b = Math.min(this.length, Math.max(from, to));
    const out: LngLat[] = [this.pointAt(a)];
    for (let i = 0; i < this.points.length; i++) {
      const c = this.cum[i] as number;
      if (c > a && c < b) out.push(this.points[i] as LngLat);
    }
    out.push(this.pointAt(b));
    return out;
  }
}

interface BestSeg {
  i: number;
  t: number;
  dist: number;
  cx: number;
  cy: number;
  c0: number;
  segLen: number;
}
