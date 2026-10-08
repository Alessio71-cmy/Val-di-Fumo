import type { FilterSpecification, StyleSpecification } from 'maplibre-gl';
import type { MapPack } from '../../data/loader';

export const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

const land = (cls: string[]): FilterSpecification => ['all', ['==', ['get', 'kind'], 'land'], ['in', ['get', 'cls'], ['literal', cls]]];

/**
 * Stile MapLibre interamente LOCALE: nessun sprite, nessun glyph (le etichette sono elementi DOM), nessun tile remoto.
 * Dati: OpenStreetMap (ODbL) tramite Overture; rilievo da EU-DEM (Terrain Tiles). Vedi docs/03-architecture.md.
 */
export function buildStyle(pack: MapPack): StyleSpecification {
  const fc = (d: GeoJSON.FeatureCollection) => ({ type: 'geojson' as const, data: d });
  return {
    version: 8,
    name: 'val-di-fumo-offline',
    sources: {
      areas: fc(pack.areas),
      waterlines: fc(pack.waterlines),
      transport: fc(pack.transport),
      bridges: fc(pack.bridges),
      contours: fc(pack.contours),
      hillshade: { type: 'image', url: pack.hillshadeUrl, coordinates: pack.meta.coordinates },
      'route-other': fc(EMPTY_FC),
      'route-active': fc(EMPTY_FC),
      imported: fc(EMPTY_FC),
      'gps-acc': fc(EMPTY_FC),
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#f1ede0' } },
      { id: 'forest', type: 'fill', source: 'areas', filter: land(['forest']), paint: { 'fill-color': '#cadcb4' } },
      { id: 'scrub', type: 'fill', source: 'areas', filter: land(['scrub', 'wetland']), paint: { 'fill-color': '#dbe6bf' } },
      { id: 'grass', type: 'fill', source: 'areas', filter: land(['grassland', 'grass']), paint: { 'fill-color': '#e7efcf' } },
      { id: 'scree', type: 'fill', source: 'areas', filter: land(['scree']), paint: { 'fill-color': '#e3dccf' } },
      { id: 'rock', type: 'fill', source: 'areas', filter: land(['bare_rock', 'rock']), paint: { 'fill-color': '#d3cdc3' } },
      { id: 'glacier', type: 'fill', source: 'areas', filter: land(['glacier']), paint: { 'fill-color': '#f3fafe', 'fill-outline-color': '#9ccfe8' } },
      { id: 'water', type: 'fill', source: 'areas', filter: ['==', ['get', 'kind'], 'water'], paint: { 'fill-color': '#9fd0f2', 'fill-outline-color': '#5aa9e6' } },
      { id: 'hillshade', type: 'raster', source: 'hillshade', paint: { 'raster-opacity': 1, 'raster-fade-duration': 0, 'raster-resampling': 'linear' } },
      {
        id: 'contours-minor',
        type: 'line',
        source: 'contours',
        minzoom: 13,
        filter: ['==', ['get', 'major'], 0],
        paint: { 'line-color': '#9b7b45', 'line-width': 0.5, 'line-opacity': 0.45 },
      },
      {
        id: 'contours-major',
        type: 'line',
        source: 'contours',
        filter: ['==', ['get', 'major'], 1],
        paint: { 'line-color': '#7a5a28', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 15, 1.2], 'line-opacity': 0.75 },
      },
      { id: 'waterlines', type: 'line', source: 'waterlines', paint: { 'line-color': '#3b8fd6', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 16, 2.4] } },
      {
        id: 'road-casing',
        type: 'line',
        source: 'transport',
        filter: ['in', ['get', 'cls'], ['literal', ['tertiary', 'secondary', 'primary', 'unclassified', 'residential', 'service', 'track']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2, 16, 7], 'line-opacity': 0.9 },
      },
      {
        id: 'road',
        type: 'line',
        source: 'transport',
        filter: ['in', ['get', 'cls'], ['literal', ['tertiary', 'secondary', 'primary', 'unclassified', 'residential', 'service']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#3a3a3a', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 16, 4] },
      },
      {
        id: 'track',
        type: 'line',
        source: 'transport',
        filter: ['==', ['get', 'cls'], 'track'],
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: { 'line-color': '#8c564b', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.9, 16, 3], 'line-dasharray': [5, 1.5] },
      },
      {
        id: 'path',
        type: 'line',
        source: 'transport',
        filter: ['in', ['get', 'cls'], ['literal', ['path', 'footway', 'steps', 'pedestrian', 'cycleway']]],
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: { 'line-color': '#a8281a', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 16, 2.2], 'line-dasharray': [2, 1.6], 'line-opacity': 0.8 },
      },
      { id: 'bridges', type: 'line', source: 'bridges', paint: { 'line-color': '#111111', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 2, 17, 6] } },
      {
        id: 'imported',
        type: 'line',
        source: 'imported',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#7e22ce', 'line-width': 3, 'line-dasharray': [1, 2] },
      },
      {
        id: 'route-other',
        type: 'line',
        source: 'route-other',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#1d4ed8', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2, 16, 5], 'line-dasharray': [2, 2], 'line-opacity': 0.9 },
      },
      {
        id: 'route-casing',
        type: 'line',
        source: 'route-active',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 5, 16, 11] },
      },
      {
        id: 'route-line',
        type: 'line',
        source: 'route-active',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#d9480f', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3, 16, 7] },
      },
      { id: 'gps-acc-fill', type: 'fill', source: 'gps-acc', paint: { 'fill-color': '#0b5fff', 'fill-opacity': 0.14 } },
      { id: 'gps-acc-line', type: 'line', source: 'gps-acc', paint: { 'line-color': '#0b5fff', 'line-width': 1.5, 'line-opacity': 0.7 } },
    ],
  };
}

/** Poligono approssimato di un cerchio di raggio `radiusM` (m) attorno a un punto. */
export function circlePolygon(lng: number, lat: number, radiusM: number, n = 48): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];
  const dLat = radiusM / 111_320;
  const dLon = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    coords.push([lng + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } };
}

export function webglSupported(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}
