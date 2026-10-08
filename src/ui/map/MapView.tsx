import maplibregl, { type GeoJSONSource, type Map as MLMap, type Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { MapPack } from '../../data/loader';
import type { CriticalPoint, GPSPosition, LngLat, Route, Trip } from '../../domain/types';
import { fmtDistance } from '../../geo/format';
import { compassIT } from '../../geo/geodesy';
import { routeWaypoints } from '../../geo/nav';
import { buildStyle, circlePolygon, EMPTY_FC } from './mapStyle';

export interface MapHandle {
  fit: () => void;
  center: () => void;
}

export interface MapViewProps {
  trip: Trip;
  pack: MapPack;
  routeId: string;
  /** Percorso alternativo (variante) mostrato tratteggiato. */
  otherRouteId: string | null;
  position: GPSPosition | null;
  /** Direzione verso cui è rivolto il telefono (bussola), in gradi dal nord; null se spenta o non disponibile. */
  heading?: number | null;
  imported: LngLat[] | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Il contesto WebGL non è disponibile o è andato perso: l'interfaccia passa alla mappa schematica. */
  onFail: (reason: string) => void;
  /** Spazio (px) coperto dai controlli sovrapposti in alto e in basso: la traccia va inquadrata nella parte libera. */
  insets?: { top: number; bottom: number };
}

const line = (coords: LngLat[]): GeoJSON.FeatureCollection => ({
  type: 'FeatureCollection',
  features: coords.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }] : [],
});

function btn(cls: string, label: string, text: string, pressed = false): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.setAttribute('aria-label', label);
  b.setAttribute('aria-pressed', String(pressed));
  b.textContent = text;
  return b;
}

export const MapView = forwardRef<MapHandle, MapViewProps>(function MapView(props, ref) {
  const { trip, pack, routeId, otherRouteId, position, heading, imported, selectedId, onSelect, onFail, insets } = props;
  const insetsRef = useRef(insets ?? { top: 110, bottom: 150 });
  insetsRef.current = insets ?? insetsRef.current;
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const wpMarkers = useRef<Map<string, { marker: Marker; el: HTMLButtonElement; prio: number }>>(new Map());
  const critMarkers = useRef<Array<{ marker: Marker; el: HTMLButtonElement }>>([]);
  const selectedRef = useRef<string | null>(null);
  const userMarker = useRef<Marker | null>(null);
  const posRef = useRef<GPSPosition | null>(null);
  const routeRef = useRef<Route | undefined>(undefined);
  const loaded = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onFailRef = useRef(onFail);
  onFailRef.current = onFail;
  posRef.current = position;
  const headingRef = useRef<number | null>(null);
  headingRef.current = heading ?? null;
  selectedRef.current = selectedId;
  routeRef.current = trip.routes[routeId];

  const fitRoute = () => {
    const m = mapRef.current;
    const r = routeRef.current;
    if (!m || !r) return;
    let w = 180;
    let s = 90;
    let e = -180;
    let n = -90;
    for (const [x, y] of r.geometry) {
      if (x < w) w = x;
      if (x > e) e = x;
      if (y < s) s = y;
      if (y > n) n = y;
    }
    const ins = insetsRef.current;
    m.fitBounds([[w, s], [e, n]], { padding: { top: ins.top + 14, bottom: ins.bottom + 14, left: 30, right: 30 }, duration: 600, maxZoom: 16 });
  };
  const centerOnUser = () => {
    const m = mapRef.current;
    const p = posRef.current;
    if (m && p) m.easeTo({ center: [p.lng, p.lat], zoom: Math.max(m.getZoom(), 15), duration: 500 });
  };
  useImperativeHandle(ref, () => ({ fit: fitRoute, center: centerOnUser }));

  // ---- creazione della mappa (una volta) ----
  useEffect(() => {
    if (!el.current) return;
    let map: MLMap;
    try {
      const b = pack.meta.bounds;
      map = new maplibregl.Map({
        container: el.current,
        style: buildStyle(pack),
        bounds: [[b[0], b[1]], [b[2], b[3]]],
        fitBoundsOptions: { padding: 10 },
        maxBounds: [[b[0] - 0.01, b[1] - 0.01], [b[2] + 0.01, b[3] + 0.01]],
        minZoom: 11,
        maxZoom: 17,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        renderWorldCopies: false,
        fadeDuration: 0,
        maxTileCacheSize: 4,
        // nessuna richiesta di rete: tutti i dati sono già nello stile
        transformRequest: (url) => (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith(location.origin) ? { url } : { url: 'data:,' }),
      });
    } catch (e) {
      onFailRef.current(e instanceof Error ? e.message : 'WebGL non disponibile');
      return;
    }
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.on('error', (ev) => {
      const msg = String((ev as { error?: Error }).error?.message ?? '');
      if (/webgl|context/i.test(msg)) onFailRef.current(msg);
    });
    const canvas = map.getCanvas();
    const lost = () => onFailRef.current('Contesto WebGL perso (memoria insufficiente?)');
    canvas.addEventListener('webglcontextlost', lost);
    map.on('load', () => {
      loaded.current = true;
      if (el.current) el.current.dataset.ready = '1';
      // etichette DOM: cime, laghi, rifugi (non interattive)
      for (const l of pack.labels) {
        if (l.t === 'saddle' || l.t === 'information') continue;
        const d = document.createElement('div');
        d.className = `lbl ${l.t === 'peak' ? 'peak' : l.t === 'lake' ? 'lake' : ''}`;
        d.dataset.t = l.t;
        d.setAttribute('aria-hidden', 'true');
        d.textContent = l.t === 'peak' && l.e ? `${l.n} ${l.e}` : l.n;
        new maplibregl.Marker({ element: d, anchor: 'left', offset: [4, 0] }).setLngLat([l.x, l.y]).addTo(map);
      }
      syncRoutes();
      syncMarkers();
      syncUser();
      fitRoute();
      map.on('zoom', () => {
        applyZoomBand();
        declutter();
      });
      applyZoomBand();
      declutter();
    });
    map.on('click', () => onSelectRef.current(null));
    return () => {
      canvas.removeEventListener('webglcontextlost', lost);
      wpMarkers.current.forEach((m) => m.marker.remove());
      wpMarkers.current.clear();
      critMarkers.current.forEach((m) => m.marker.remove());
      critMarkers.current = [];
      userMarker.current?.remove();
      userMarker.current = null;
      map.remove();
      mapRef.current = null;
      loaded.current = false;
      if (el.current) delete el.current.dataset.ready;
    };
    // la mappa si crea una sola volta per pacchetto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack]);

  function applyZoomBand() {
    const m = mapRef.current;
    const c = el.current;
    if (!m || !c) return;
    const z = m.getZoom();
    c.dataset.z = z < 12.5 ? 'low' : z < 14 ? 'mid' : 'high';
  }

  /**
   * Evita marker sovrapposti (bersagli di tocco coperti l'uno dall'altro): se due punti distano meno di 30 px sullo schermo
   * resta visibile il più importante (rifugio > parcheggio > malghe > cascate > punti critici; il punto selezionato vince sempre).
   * I punti nascosti restano disponibili in "Elenco punti" e ricompaiono ingrandendo.
   */
  function declutter() {
    const m = mapRef.current;
    const c = el.current;
    if (!m || !c || !loaded.current) return;
    const band = c.dataset.z;
    const items: Array<{ el: HTMLElement; ll: { lng: number; lat: number }; prio: number }> = [];
    wpMarkers.current.forEach((x, id) => items.push({ el: x.el, ll: x.marker.getLngLat(), prio: id === selectedRef.current ? 9 : x.prio }));
    for (const x of critMarkers.current) if (band === 'high') items.push({ el: x.el, ll: x.marker.getLngLat(), prio: 1 });
    items.sort((a, b) => b.prio - a.prio);
    const kept: Array<{ x: number; y: number }> = [];
    for (const it of items) {
      const p = m.project([it.ll.lng, it.ll.lat]);
      const clash = kept.some((k) => Math.hypot(k.x - p.x, k.y - p.y) < 30);
      it.el.style.visibility = clash ? 'hidden' : '';
      if (!clash) kept.push({ x: p.x, y: p.y });
    }
  }

  function syncRoutes() {
    const m = mapRef.current;
    if (!m || !loaded.current) return;
    const r = trip.routes[routeId];
    const o = otherRouteId ? trip.routes[otherRouteId] : undefined;
    (m.getSource('route-active') as GeoJSONSource | undefined)?.setData(r ? line(r.geometry) : EMPTY_FC);
    (m.getSource('route-other') as GeoJSONSource | undefined)?.setData(o ? line(o.geometry) : EMPTY_FC);
    (m.getSource('imported') as GeoJSONSource | undefined)?.setData(imported ? line(imported) : EMPTY_FC);
  }

  function syncMarkers() {
    const m = mapRef.current;
    if (!m || !loaded.current) return;
    wpMarkers.current.forEach((x) => x.marker.remove());
    wpMarkers.current.clear();
    critMarkers.current.forEach((x) => x.marker.remove());
    critMarkers.current = [];
    const wps = routeWaypoints(trip, routeId);
    wps.forEach((w, i) => {
      const p = trip.points[w.id];
      if (!p) return;
      const type = p.type === 'parking' ? 'park' : p.type === 'hut' ? 'hut' : p.type === 'waterfall' ? 'fall' : '';
      const b = btn(`wp ${type}`, `Punto ${i + 1}: ${p.name}, a ${fmtDistance(w.chainM)} dall'inizio del percorso`, String(i + 1), selectedId === w.id);
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onSelectRef.current(w.id);
      });
      const marker = new maplibregl.Marker({ element: b }).setLngLat(p.coordinates).addTo(m);
      b.setAttribute('aria-label', `Punto ${i + 1}: ${p.name}, a ${fmtDistance(w.chainM)} dall'inizio del percorso`); // MapLibre imposta "Map marker" in addTo()
      const prio = p.type === 'hut' ? 5 : p.type === 'parking' ? 4 : p.type === 'waterfall' ? 2 : 3;
      wpMarkers.current.set(w.id, { marker, el: b, prio });
    });
    const crit: CriticalPoint[] = trip.criticalPoints.filter((c) => c.routeId === routeId);
    for (const c of crit) {
      const b = btn(`wp crit ${c.kind} crit-marker`, `${c.label} a ${fmtDistance(c.chainM)} dall'inizio: ${c.detail}`, c.kind === 'bridge' ? 'P' : '⑂');
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onSelectRef.current(c.id);
      });
      critMarkers.current.push({ marker: new maplibregl.Marker({ element: b }).setLngLat(c.coordinates).addTo(m), el: b });
      b.setAttribute('aria-label', `${c.label} a ${fmtDistance(c.chainM)} dall'inizio: ${c.detail}`);
    }
    declutter();
  }

  function syncUser() {
    const m = mapRef.current;
    if (!m || !loaded.current) return;
    const p = posRef.current;
    const acc = m.getSource('gps-acc') as GeoJSONSource | undefined;
    if (!p) {
      acc?.setData(EMPTY_FC);
      userMarker.current?.remove();
      userMarker.current = null;
      return;
    }
    acc?.setData({ type: 'FeatureCollection', features: [circlePolygon(p.lng, p.lat, Math.max(3, p.accuracyM))] });
    if (!userMarker.current) {
      const d = document.createElement('div');
      d.className = 'user-dot';
      d.setAttribute('role', 'img');
      d.setAttribute('aria-label', 'La tua posizione');
      const cone = document.createElement('div');
      cone.className = 'user-heading';
      cone.setAttribute('aria-hidden', 'true');
      d.appendChild(cone);
      userMarker.current = new maplibregl.Marker({ element: d }).setLngLat([p.lng, p.lat]).addTo(m);
    } else {
      userMarker.current.setLngLat([p.lng, p.lat]);
    }
    syncHeading();
  }

  function syncHeading() {
    const d = userMarker.current?.getElement();
    if (!d) return;
    const h = headingRef.current;
    if (h === null) {
      d.classList.remove('has-heading');
      d.removeAttribute('data-heading');
      d.setAttribute('aria-label', 'La tua posizione');
      return;
    }
    d.classList.add('has-heading');
    d.dataset.heading = String(h);
    d.style.setProperty('--hd', `${h}deg`);
    d.setAttribute('aria-label', `La tua posizione, rivolto verso ${compassIT(h)} (bussola del telefono, indicativa)`);
  }

  useEffect(syncRoutes, [routeId, otherRouteId, imported, trip]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    syncMarkers();
    fitRoute();
  }, [routeId, trip]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(syncUser, [position]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(syncHeading, [heading]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    wpMarkers.current.forEach((x, id) => x.el.setAttribute('aria-pressed', String(id === selectedId)));
    declutter();
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={el}
      className="map"
      data-testid="gl-map"
      role="region"
      aria-label="Mappa topografica offline. Usa i pulsanti dei punti per i dettagli; zoom con due dita o con i pulsanti del browser."
    />
  );
});
