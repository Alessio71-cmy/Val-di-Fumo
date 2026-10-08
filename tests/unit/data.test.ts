import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLACE_DEFS } from '../../src/content/places';
import { POI_CONTENT, STAGE_CONTENT } from '../../src/content/itinerary';
import { SAFETY_NOTICES } from '../../src/content/safety';
import { loadGeo } from '../../src/data/loader';
import { buildTrip, SOURCE_BY_ID, SOURCES, turnaroundOptions } from '../../src/data/trip';
import { haversine } from '../../src/geo/geodesy';
import { Polyline } from '../../src/geo/polyline';
import { guidancePolicy } from '../../src/domain/validation';

const fileFetch = (missing: string[] = []) =>
  (async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
    const name = url.pathname.replace(/^\//, '');
    if (missing.some((m) => name.endsWith(m))) return new Response('not found', { status: 404 });
    try {
      return new Response(new Uint8Array(readFileSync(`public/${name}`)));
    } catch {
      return new Response('not found', { status: 404 });
    }
  }) as typeof fetch;

const AOI = { w: 10.47, e: 10.6, s: 45.985, n: 46.097 };

describe('integrità dei dati geografici', async () => {
  const geo = await loadGeo(fileFetch(), 'http://localhost/');
  it('tutti i file generati si caricano', () => {
    for (const [k, v] of Object.entries(geo)) expect(v.ok, `${k}: ${v.ok ? '' : v.error}`).toBe(true);
  });
  const { trip, warnings } = buildTrip(geo);

  it('nessun avviso di dati mancanti con i dati completi', () => {
    expect(warnings).toEqual([]);
  });
  it('ogni luogo dei contenuti ha coordinate, ID OSM e cade nell\'area della mappa (tranne la partenza)', () => {
    for (const d of PLACE_DEFS) {
      const p = trip.points[d.id];
      expect(p, `punto ${d.id}`).toBeDefined();
      expect(p!.osmIds.length, `ID OSM di ${d.id}`).toBeGreaterThan(0);
      if (d.id !== 'pergine') {
        const [lon, lat] = p!.coordinates;
        expect(lon).toBeGreaterThan(AOI.w);
        expect(lon).toBeLessThan(AOI.e);
        expect(lat).toBeGreaterThan(AOI.s);
        expect(lat).toBeLessThan(AOI.n);
        expect(p!.elevationM).toBeGreaterThan(1000);
        expect(p!.elevationM).toBeLessThan(2100);
      }
    }
  });
  it('ogni tappa e scheda fa riferimento a un luogo esistente', () => {
    for (const s of STAGE_CONTENT) expect(trip.points[s.placeId], s.id).toBeDefined();
    for (const p of POI_CONTENT) expect(trip.points[p.placeId], p.id).toBeDefined();
  });
  it('ogni fonte citata nei contenuti esiste nel registro', () => {
    const ids = new Set<string>();
    for (const s of STAGE_CONTENT) s.sourceIds.forEach((i) => ids.add(i));
    for (const p of POI_CONTENT) p.sourceIds.forEach((i) => ids.add(i));
    for (const p of PLACE_DEFS) p.sourceIds.forEach((i) => ids.add(i));
    for (const n of SAFETY_NOTICES) n.sourceIds.forEach((i) => ids.add(i));
    for (const id of ids) expect(SOURCE_BY_ID[id], `fonte ${id}`).toBeDefined();
    expect(new Set(SOURCES.map((s) => s.id)).size).toBe(SOURCES.length);
  });
  it('ogni fonte ha licenza/stato di accesso/data e le fonti bloccate sono dichiarate non consultate', () => {
    for (const s of SOURCES) {
      expect(s.accessedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.accessMode).toMatch(/direct|search-summary|blocked/);
    }
    for (const id of ['sat-rifugio', 'pnab-val-di-fumo', 'visittrentino-leno', 'iter-bissina']) {
      expect(SOURCE_BY_ID[id]!.accessMode).toBe('blocked');
      expect(SOURCE_BY_ID[id]!.usedFor).toMatch(/NON CONSULTATA/);
    }
  });
  it('i contenuti non contengono coordinate digitate a mano', () => {
    for (const f of readdirSync('src/content').filter((x) => x.endsWith('.ts'))) {
      const txt = readFileSync(`src/content/${f}`, 'utf8');
      expect(txt, f).not.toMatch(/\b4[56]\.\d{3,}\b/);
      expect(txt, f).not.toMatch(/\b1[01]\.\d{3,}\b/);
    }
  });
  it('percorsi: progressive crescenti, lunghezza coerente, estremi sui punti attesi', () => {
    for (const r of Object.values(trip.routes)) {
      for (let i = 1; i < r.chain.length; i++) expect(r.chain[i]!).toBeGreaterThanOrEqual(r.chain[i - 1]!);
      expect(Math.abs(r.chain[r.chain.length - 1]! - r.lengthM)).toBeLessThan(2);
      expect(r.geometry.length).toBe(r.elevations.length);
    }
    const out = trip.routes['route-out']!;
    const start = out.geometry[0]!;
    const end = out.geometry[out.geometry.length - 1]!;
    expect(haversine(start, trip.points['park-dam']!.coordinates)).toBeLessThan(60);
    expect(haversine(end, trip.points['rifugio-val-di-fumo']!.coordinates)).toBeLessThan(40);
    const back = trip.routes['route-back']!;
    expect(haversine(back.geometry[0]!, end)).toBeLessThan(1);
    expect(back.lengthM).toBeCloseTo(out.lengthM, 0);
  });
  it('punti sul percorso: Malga Breguzzo, cascata sul Chiese e rifugio sono entro 60 m dalla traccia', () => {
    const pl = new Polyline(trip.routes['route-out']!.geometry);
    for (const id of ['malga-breguzzo', 'fall-chiese', 'malga-val-di-fumo', 'rifugio-val-di-fumo']) {
      expect(pl.project(trip.points[id]!.coordinates).dist, id).toBeLessThan(60);
    }
    // ordine lungo la traccia: breguzzo < chiese < malga val di fumo < rifugio
    const a = (id: string) => pl.project(trip.points[id]!.coordinates).along;
    expect(a('malga-breguzzo')).toBeLessThan(a('fall-chiese'));
    expect(a('fall-chiese')).toBeLessThan(a('malga-val-di-fumo'));
    expect(a('malga-val-di-fumo')).toBeLessThan(a('rifugio-val-di-fumo'));
  });
  it('durate e distanze delle tappe', () => {
    const byId = Object.fromEntries(trip.stages.map((s) => [s.id, s]));
    expect(byId['s2-leno']!.duration.basis).toBe('estimated');
    expect(byId['s2-leno']!.distanceFromPrevM!).toBeGreaterThan(75_000);
    const walkSum = ['s4-lago', 's5-breguzzo', 's6-chiese', 's7-rifugio'].reduce((t, id) => t + (byId[id]!.distanceFromPrevM ?? 0), 0);
    expect(walkSum).toBeCloseTo(trip.routes['route-out']!.lengthM, -1);
    const minSum = ['s4-lago', 's6-chiese', 's7-rifugio'].reduce((t, id) => t + byId[id]!.duration.nominal, 0);
    expect(minSum).toBeGreaterThan(80);
    expect(minSum).toBeLessThan(130);
    for (const s of trip.stages) expect(s.sourceIds.length, s.id).toBeGreaterThan(0);
  });
  it('schede Esplora: distingue sul percorso da deviazione', () => {
    const by = Object.fromEntries(trip.pois.map((p) => [p.id, p]));
    expect(by['poi-breguzzo']!.onRoute).toBe(true);
    expect(by['poi-chiese']!.onRoute).toBe(true);
    expect(by['poi-rifugio']!.onRoute).toBe(true);
    expect(by['poi-paesaggio']!.onRoute).toBe(false);
    expect(by['poi-paesaggio']!.detourM).toBeGreaterThan(300);
    expect(by['poi-diga']!.onRoute).toBe(false);
    expect(by['poi-diga']!.detourM).toBeGreaterThan(200);
    for (const p of trip.pois) expect(p.photos).toEqual([]);
    expect(trip.pois.length).toBe(8);
  });
  it('opzioni di abbreviazione con tempi crescenti e ritorno decrescente', () => {
    const t = turnaroundOptions(trip);
    expect(t.length).toBe(2);
    expect(t[0]!.outMin).toBeLessThan(trip.routes['route-out']!.nominalMin);
    expect(t[0]!.backMin).toBeLessThan(trip.routes['route-back']!.nominalMin);
    expect(t[0]!.outMin + t[0]!.backMin).toBeGreaterThan(70);
  });
  it('punti critici: ponti e bivi su andata e ritorno, ordinati per progressiva', () => {
    expect(trip.criticalPoints.filter((c) => c.routeId === 'route-out' && c.kind === 'bridge').length).toBe(5);
    expect(trip.criticalPoints.filter((c) => c.routeId === 'route-back').length).toBeGreaterThan(5);
    const out = trip.criticalPoints.filter((c) => c.routeId === 'route-out').map((c) => c.chainM);
    expect(out).toEqual([...out].sort((a, b) => a - b));
  });
  it('tutta la geometria mostrata è "da OSM, non verificata sul campo": nessun dato è dichiarato verificato', () => {
    for (const r of Object.values(trip.routes)) expect(r.provenance.validation).toBe('source-derived');
    for (const p of Object.values(trip.points)) expect(['source-derived', 'unverified', 'estimated']).toContain(p.provenance.validation);
    for (const s of trip.stages) expect(['source-derived', 'estimated', 'unverified']).toContain(s.validation);
  });
  it('i controlli di coerenza della pipeline sono tutti superati', () => {
    expect(geo.validation.ok).toBe(true);
    if (geo.validation.ok) for (const c of geo.validation.data.checks) expect(c.ok, c.check).toBe(true);
  });
});

describe('gestione di dati incompleti', () => {
  it('senza routes.json: nessuna eccezione, avvisi espliciti, testi e tappe disponibili', async () => {
    const geo = await loadGeo(fileFetch(['routes.json']), 'http://localhost/');
    expect(geo.routes.ok).toBe(false);
    const { trip, warnings } = buildTrip(geo);
    expect(warnings.some((w) => /Tracce non disponibili/.test(w))).toBe(true);
    expect(Object.keys(trip.routes)).toHaveLength(0);
    expect(trip.stages.length).toBe(9);
    expect(turnaroundOptions(trip)).toEqual([]);
  });
  it('senza points.json: avviso e schede senza posizione omesse', async () => {
    const geo = await loadGeo(fileFetch(['points.json']), 'http://localhost/');
    const { trip, warnings } = buildTrip(geo);
    expect(warnings.some((w) => /Punti geografici non disponibili/.test(w))).toBe(true);
    expect(trip.pois).toHaveLength(0);
    expect(trip.stages.length).toBe(9);
  });
  it('senza drive.json: durate di guida non derivabili ma nessun crash', async () => {
    const geo = await loadGeo(fileFetch(['drive.json']), 'http://localhost/');
    const { trip, warnings } = buildTrip(geo);
    expect(warnings.some((w) => /Tratti in auto non disponibili/.test(w))).toBe(true);
    expect(trip.stages.find((s) => s.id === 's2-leno')!.duration.nominal).toBe(0);
  });
  it('JSON corrotto è rifiutato con un messaggio', async () => {
    const bad = (async () => new Response('{"routes": {"route-out": {"coords": []}}}')) as unknown as typeof fetch;
    const geo = await loadGeo(bad, 'http://localhost/');
    expect(geo.routes.ok).toBe(false);
    if (!geo.routes.ok) expect(geo.routes.error).toMatch(/route-out|incompleto/);
  });
  it('rete assente (fetch che lancia): ogni dataset segnala l\'errore senza propagare eccezioni', async () => {
    const down = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    const geo = await loadGeo(down, 'http://localhost/');
    for (const v of Object.values(geo)) expect(v.ok).toBe(false);
    const { warnings } = buildTrip(geo);
    expect(warnings.length).toBeGreaterThan(2);
  });
});

describe('politica di guida in base allo stato di validazione', () => {
  it('un dato non verificabile non guida: niente progresso né avvisi', () => {
    const p = guidancePolicy('unverified');
    expect(p.progress).toBe(false);
    expect(p.softOffRouteAlert).toBe(false);
    expect(p.labelAsToVerify).toBe(true);
  });
  it('una stima è etichettata come tale e non genera avvisi', () => {
    const p = guidancePolicy('estimated');
    expect(p.labelAsEstimate).toBe(true);
    expect(p.softOffRouteAlert).toBe(false);
  });
  it('dato da OSM: progresso e avviso soft, sempre "da verificare"', () => {
    const p = guidancePolicy('source-derived');
    expect(p.progress).toBe(true);
    expect(p.softOffRouteAlert).toBe(true);
    expect(p.labelAsToVerify).toBe(true);
  });
  it('nessuno stato abilita istruzioni di svolta', () => {
    for (const s of ['field-verified', 'official-verified', 'cross-checked', 'source-derived', 'estimated', 'unverified'] as const) {
      expect(guidancePolicy(s).turnByTurn).toBe(false);
    }
  });
});
