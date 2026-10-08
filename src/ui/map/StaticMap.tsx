import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { MapPack } from '../../data/loader';
import type { GPSPosition, LngLat, Trip } from '../../domain/types';
import { fmtDistance } from '../../geo/format';
import { compassIT } from '../../geo/geodesy';
import { routeWaypoints } from '../../geo/nav';
import type { MapHandle } from './MapView';

/**
 * Mappa schematica SVG: stessi dati locali (percorso, punti, ed eventualmente rilievo/acqua/sentieri), nessun WebGL.
 * È il ripiego quando WebGL non è disponibile o il pacchetto mappa non è stato scaricato.
 * Coordinate: x = lon, y = -Mercatore(lat) (in gradi), così l'ombreggiatura (griglia Mercatore) combacia.
 */
const mercY = (lat: number) => (Math.asinh(Math.tan((lat * Math.PI) / 180)) * 180) / Math.PI;
const P = (c: LngLat): [number, number] => [c[0], -mercY(c[1])];

interface VB {
  x: number;
  y: number;
  w: number;
  h: number;
}

function ring(coords: number[][]): string {
  return coords.map((c, i) => `${i ? 'L' : 'M'}${c[0]!.toFixed(5)} ${(-mercY(c[1]!)).toFixed(5)}`).join('') + 'Z';
}
function polyPath(g: GeoJSON.Geometry): string {
  if (g.type === 'Polygon') return g.coordinates.map(ring).join('');
  if (g.type === 'MultiPolygon') return g.coordinates.map((p) => p.map(ring).join('')).join('');
  return '';
}
function linePath(g: GeoJSON.Geometry): string {
  const one = (cs: number[][]) => cs.map((c, i) => `${i ? 'L' : 'M'}${c[0]!.toFixed(5)} ${(-mercY(c[1]!)).toFixed(5)}`).join('');
  if (g.type === 'LineString') return one(g.coordinates);
  if (g.type === 'MultiLineString') return g.coordinates.map(one).join('');
  return '';
}

export interface StaticMapProps {
  trip: Trip;
  pack: MapPack | null;
  routeId: string;
  otherRouteId: string | null;
  position: GPSPosition | null;
  /** Direzione verso cui è rivolto il telefono (bussola), in gradi dal nord; null se spenta o non disponibile. */
  heading?: number | null;
  imported: LngLat[] | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export const StaticMap = forwardRef<MapHandle, StaticMapProps>(function StaticMap({ trip, pack, routeId, otherRouteId, position, heading, imported, selectedId, onSelect }, ref) {
  const route = trip.routes[routeId];
  const other = otherRouteId ? trip.routes[otherRouteId] : undefined;
  const wps = useMemo(() => routeWaypoints(trip, routeId), [trip, routeId]);
  const box = useRef<HTMLDivElement>(null);
  const bounds = useMemo(() => {
    const pts = (route?.geometry ?? []).map(P);
    if (pts.length === 0) return { x: 10.5, y: -mercY(46.05), w: 0.1, h: 0.1 } as VB;
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const y0 = Math.min(...ys);
    const y1 = Math.max(...ys);
    const padX = (x1 - x0) * 0.12 + 0.002;
    const padY = (y1 - y0) * 0.12 + 0.002;
    return { x: x0 - padX, y: y0 - padY, w: x1 - x0 + 2 * padX, h: y1 - y0 + 2 * padY };
  }, [route]);
  const [vb, setVb] = useState<VB>(bounds);
  useEffect(() => setVb(bounds), [bounds]);

  const fit = useCallback(() => setVb(bounds), [bounds]);
  const center = useCallback(() => {
    if (!position) return;
    const [x, y] = P([position.lng, position.lat]);
    setVb((v) => ({ ...v, x: x - v.w / 2, y: y - v.h / 2 }));
  }, [position]);
  useImperativeHandle(ref, () => ({ fit, center }), [fit, center]);

  // pan/zoom con puntatori (trascina, rotella, pizzica).
  // Il puntatore viene "catturato" solo quando il movimento supera una soglia: catturarlo già al tocco farebbe arrivare il click
  // al contenitore invece che al punto toccato e renderebbe i marker non selezionabili con il tocco.
  const pointers = useRef(new Map<number, { x: number; y: number; sx: number; sy: number; captured: boolean }>());
  const pinch = useRef<number | null>(null);
  const dragged = useRef(false);
  const toUnits = (px: number, py: number, v: VB) => {
    const r = box.current!.getBoundingClientRect();
    return { x: v.x + ((px - r.left) / r.width) * v.w, y: v.y + ((py - r.top) / r.height) * v.h };
  };
  const zoomAt = (factor: number, cx: number, cy: number) =>
    setVb((v) => {
      const u = toUnits(cx, cy, v);
      const w = Math.max(0.004, Math.min(0.4, v.w * factor));
      const h = (v.h / v.w) * w;
      const fx = (u.x - v.x) / v.w;
      const fy = (u.y - v.y) / v.h;
      return { x: u.x - fx * w, y: u.y - fy * h, w, h };
    });
  const onDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, captured: false });
    pinch.current = null;
    dragged.current = false;
  };
  const onMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !box.current) return;
    const cur = { ...prev, x: e.clientX, y: e.clientY };
    if (!cur.captured && Math.hypot(e.clientX - prev.sx, e.clientY - prev.sy) > 6) {
      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {
        /* puntatore già rilasciato */
      }
      cur.captured = true;
      dragged.current = true;
    }
    pointers.current.set(e.pointerId, cur);
    if (!cur.captured && pointers.current.size === 1) return;
    const r = box.current.getBoundingClientRect();
    if (pointers.current.size === 1) {
      setVb((v) => ({ ...v, x: v.x - ((e.clientX - prev.x) / r.width) * v.w, y: v.y - ((e.clientY - prev.y) / r.height) * v.h }));
    } else if (pointers.current.size === 2) {
      dragged.current = true;
      const [a, b] = Array.from(pointers.current.values());
      if (a && b) {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch.current) zoomAt(pinch.current / d, (a.x + b.x) / 2, (a.y + b.y) / 2);
        pinch.current = d;
      }
    }
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinch.current = null;
  };
  const onWheel = (e: React.WheelEvent) => zoomAt(e.deltaY > 0 ? 1.15 : 0.87, e.clientX, e.clientY);
  /** Dopo un trascinamento il click finale non deve selezionare/deselezionare nulla. */
  const swallowClick = () => {
    if (dragged.current) {
      dragged.current = false;
      return true;
    }
    return false;
  };

  const scale = vb.w; // unità per larghezza vista, per le dimensioni dei testi/marker
  const r = scale * 0.012; // raggio marker in unità
  const sh = pack?.meta.coordinates;
  const imgBox = sh ? (() => {
    const nw = P(sh[0]);
    const se = P(sh[2]);
    return { x: nw[0], y: nw[1], w: se[0] - nw[0], h: se[1] - nw[1] };
  })() : null;

  return (
    <div ref={box} className="map" data-testid="svg-map" role="region" aria-label="Mappa schematica locale. Trascina per spostare, due dita o rotella per lo zoom." style={{ touchAction: 'none', background: '#ece6d4' }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel} onClick={() => { if (!swallowClick()) onSelect(null); }}>
      <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden={false}>
        {pack && imgBox ? <image href={pack.hillshadeUrl} x={imgBox.x} y={imgBox.y} width={imgBox.w} height={imgBox.h} preserveAspectRatio="none" /> : null}
        {pack?.areas.features.map((f, i) =>
          (f.properties as { kind?: string; cls?: string } | null)?.kind === 'water' ? <path key={`w${i}`} d={polyPath(f.geometry)} fill="#9fd0f2" stroke="#5aa9e6" strokeWidth={1} vectorEffect="non-scaling-stroke" fillOpacity={0.85} /> : null,
        )}
        {pack?.waterlines.features.map((f, i) => <path key={`wl${i}`} d={linePath(f.geometry)} fill="none" stroke="#3b8fd6" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
        {pack?.contours.features.filter((f) => (f.properties as { major?: number } | null)?.major === 1).map((f, i) => <path key={`c${i}`} d={linePath(f.geometry)} fill="none" stroke="#7a5a28" strokeOpacity={0.6} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />)}
        {pack?.transport.features.map((f, i) => {
          const cls = (f.properties as { cls?: string } | null)?.cls ?? '';
          const road = ['tertiary', 'secondary', 'primary', 'unclassified', 'residential', 'service'].includes(cls);
          return <path key={`t${i}`} d={linePath(f.geometry)} fill="none" stroke={road ? '#333' : cls === 'track' ? '#8c564b' : '#a8281a'} strokeWidth={road ? 2 : 1.2} strokeDasharray={road ? undefined : '4 3'} strokeOpacity={0.85} vectorEffect="non-scaling-stroke" />;
        })}
        {imported ? <path d={linePath({ type: 'LineString', coordinates: imported })} fill="none" stroke="#7e22ce" strokeWidth={3} strokeDasharray="2 4" vectorEffect="non-scaling-stroke" /> : null}
        {other ? <path d={linePath({ type: 'LineString', coordinates: other.geometry })} fill="none" stroke="#1d4ed8" strokeWidth={3} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" /> : null}
        {route ? (
          <>
            <path d={linePath({ type: 'LineString', coordinates: route.geometry })} fill="none" stroke="#fff" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <path d={linePath({ type: 'LineString', coordinates: route.geometry })} fill="none" stroke="#d9480f" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" data-testid="svg-route" />
          </>
        ) : null}
        {wps.map((w, i) => {
          const p = trip.points[w.id];
          if (!p) return null;
          const [x, y] = P(p.coordinates);
          const sel = selectedId === w.id;
          return (
            <g
              key={w.id}
              role="button"
              tabIndex={0}
              aria-label={`Punto ${i + 1}: ${p.name}, a ${fmtDistance(w.chainM)} dall'inizio`}
              aria-pressed={sel}
              onClick={(e) => {
                e.stopPropagation();
                if (!swallowClick()) onSelect(w.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(w.id);
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <circle cx={x} cy={y} r={r * (sel ? 1.5 : 1.15)} fill={sel ? '#d9480f' : '#14532d'} stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              <text x={x} y={y} fontSize={r * 1.3} fill="#fff" textAnchor="middle" dominantBaseline="central" fontWeight={800} style={{ pointerEvents: 'none' }}>
                {i + 1}
              </text>
              {sel || vb.w < bounds.w * 0.45 ? (
                <text x={x + r * 1.7} y={y} fontSize={r * 1.25} fill="#111" stroke="#fff" strokeWidth={r * 0.35} paintOrder="stroke" dominantBaseline="central" fontWeight={700}>
                  {p.name.replace(/ \(.*/, '').slice(0, 26)}
                </text>
              ) : null}
            </g>
          );
        })}
        {position ? (() => {
          const [x, y] = P([position.lng, position.lat]);
          const accU = (position.accuracyM / 111_320) * 1; // gradi di lat ≈ unità
          return (
            <g aria-label={heading != null ? `La tua posizione, rivolto verso ${compassIT(heading)} (bussola del telefono, indicativa)` : 'La tua posizione'} role="img" data-heading={heading ?? undefined}>
              <circle cx={x} cy={y} r={Math.max(accU, r * 0.6)} fill="#0b5fff" fillOpacity={0.15} stroke="#0b5fff" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              {heading != null ? (
                <polygon
                  data-testid="heading-cone"
                  points={`${x},${y - r * 5} ${x - r * 1.9},${y - r * 1.1} ${x + r * 1.9},${y - r * 1.1}`}
                  transform={`rotate(${heading} ${x} ${y})`}
                  fill="#0b5fff"
                  fillOpacity={0.55}
                  stroke="#fff"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              <circle cx={x} cy={y} r={r * 0.9} fill="#0b5fff" stroke="#fff" strokeWidth={3} vectorEffect="non-scaling-stroke" />
            </g>
          );
        })() : null}
      </svg>
    </div>
  );
});
