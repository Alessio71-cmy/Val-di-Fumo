import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OfflinePackage } from '../../src/domain/types';
import { coreCacheName, fetchManifest, isManifest, mapCacheName, MANIFEST_PATH, RECORD_KEY } from '../../src/offline/manifest';
import { downloadAndVerify, pruneOldCaches, verifyAll, type OfflineRecord } from '../../src/offline/pack';
import { evaluateReadiness } from '../../src/offline/status';
import { __resetStorageForTests, kvGet, kvSet } from '../../src/storage/idb';

/** CacheStorage minimale in memoria (stesse operazioni usate dall'app). */
class FakeCache {
  store = new Map<string, { body: ArrayBuffer; headers: Record<string, string> }>();
  async match(url: string) {
    const e = this.store.get(url);
    return e ? new Response(e.body.slice(0), { headers: e.headers }) : undefined;
  }
  async put(url: string, res: Response) {
    this.store.set(url, { body: await res.arrayBuffer(), headers: {} });
  }
  async delete(url: string) {
    return this.store.delete(url);
  }
  async keys() {
    return [...this.store.keys()].map((u) => new Request(u));
  }
}
class FakeCacheStorage {
  caches = new Map<string, FakeCache>();
  async open(name: string) {
    if (!this.caches.has(name)) this.caches.set(name, new FakeCache());
    return this.caches.get(name) as FakeCache;
  }
  async keys() {
    return [...this.caches.keys()];
  }
  async delete(name: string) {
    return this.caches.delete(name);
  }
}

const BASE = 'https://example.test/app/';
const enc = (s: string) => new TextEncoder().encode(s);
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

const FILES: Record<string, { group: 'core' | 'map'; body: string }> = {
  'index.html': { group: 'core', body: '<html>app</html>' },
  'data/geo/routes.json': { group: 'core', body: '{"routes":{}}' },
  'data/map/contours.geojson': { group: 'map', body: '{"type":"FeatureCollection","features":[]}' },
};

function manifest(over: Partial<OfflinePackage> = {}): OfflinePackage {
  const resources = Object.entries(FILES).map(([url, f]) => ({ url, group: f.group, bytes: enc(f.body).byteLength, sha256: sha(f.body) }));
  return { buildId: 'b1', packVersion: 'p1', generatedAt: '2026-10-08T00:00:00Z', resources, totalBytes: resources.reduce((t, r) => t + r.bytes, 0), ...over };
}

function fetchFrom(files: Record<string, string>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    const rel = url.replace(BASE, '');
    if (rel === MANIFEST_PATH) return new Response(JSON.stringify(manifest()), { status: 200 });
    const body = files[rel];
    return body === undefined ? new Response('nope', { status: 404 }) : new Response(body, { status: 200 });
  }) as typeof fetch;
}

const allBodies = () => Object.fromEntries(Object.entries(FILES).map(([u, f]) => [u, f.body]));

/** Installa nella cache finta il nucleo (come farebbe il service worker) e il manifest. */
async function installCore(cs: FakeCacheStorage, m: OfflinePackage, opts: { map?: boolean } = {}) {
  const core = await cs.open(coreCacheName(m));
  const map = await cs.open(mapCacheName(m));
  for (const r of m.resources) {
    const f = FILES[r.url] as { group: 'core' | 'map'; body: string };
    if (r.group === 'core') await core.put(new URL(r.url, BASE).toString(), new Response(f.body));
    else if (opts.map) await map.put(new URL(r.url, BASE).toString(), new Response(f.body));
  }
  await core.put(new URL(MANIFEST_PATH, BASE).toString(), new Response(JSON.stringify(m)));
}

beforeEach(() => __resetStorageForTests());
afterEach(() => vi.unstubAllGlobals());

describe('manifest di precache', () => {
  it('riconosce un manifest valido e scarta quelli malformati', () => {
    expect(isManifest(manifest())).toBe(true);
    expect(isManifest({ buildId: 'x' })).toBe(false);
    expect(isManifest({ ...manifest(), resources: [{ url: 'a', bytes: 1, sha256: 'x', group: 'altro' }] })).toBe(false);
    expect(isManifest(null)).toBe(false);
  });
  it('fetchManifest restituisce null se la rete non risponde o il file non è valido', async () => {
    expect(await fetchManifest((async () => new Response('x', { status: 500 })) as typeof fetch, BASE)).toBeNull();
    expect(await fetchManifest((async () => new Response('{"a":1}')) as typeof fetch, BASE)).toBeNull();
    expect(await fetchManifest((async () => { throw new TypeError('Failed to fetch'); }) as typeof fetch, BASE)).toBeNull();
    expect((await fetchManifest(fetchFrom({}), BASE))?.buildId).toBe('b1');
  });
});

describe('download e verifica (SHA-256 riletto dalla cache)', () => {
  it('scarica ciò che manca, verifica e registra lo stato "pronto" solo a verifica riuscita', async () => {
    const cs = new FakeCacheStorage();
    const m = manifest();
    await installCore(cs, m); // nucleo già installato dal service worker
    const calls: string[] = [];
    const base = fetchFrom(allBodies());
    const fetchImpl = ((u: RequestInfo | URL, i?: RequestInit) => {
      calls.push(String(u).replace(BASE, ''));
      return base(u, i);
    }) as typeof fetch;
    const rep = await downloadAndVerify(m, { cachesImpl: cs as unknown as CacheStorage, fetchImpl, base: BASE });
    expect(rep.ok).toBe(true);
    expect(rep.checked).toBe(3);
    expect(rep.hashSkipped).toBe(false);
    expect(calls).toEqual(['data/map/contours.geojson']); // il nucleo integro non viene riscaricato
    const rec = await kvGet<OfflineRecord>(RECORD_KEY);
    expect(rec?.buildId).toBe('b1');
    expect(rec?.resources).toBe(3);
  });

  it('un file scaricato corrotto NON viene dichiarato pronto e non salva il record', async () => {
    const cs = new FakeCacheStorage();
    const m = manifest();
    await installCore(cs, m);
    const bad = { ...allBodies(), 'data/map/contours.geojson': '{"type":"FeatureCollection","features":[1]}' }; // stessa lunghezza? no: diversa → dimensione o hash errati
    const rep = await downloadAndVerify(m, { cachesImpl: cs as unknown as CacheStorage, fetchImpl: fetchFrom(bad), base: BASE });
    expect(rep.ok).toBe(false);
    expect(rep.corrupted).toEqual(['data/map/contours.geojson']);
    expect(await kvGet(RECORD_KEY)).toBeUndefined();
  });

  it('stessa dimensione ma contenuto diverso: l’hash lo scopre', async () => {
    const cs = new FakeCacheStorage();
    const m = manifest();
    await installCore(cs, m);
    const same = FILES['data/map/contours.geojson']!.body;
    const flipped = same.slice(0, -2) + 'XX'; // stessa lunghezza
    expect(enc(flipped).byteLength).toBe(enc(same).byteLength);
    const rep = await downloadAndVerify(m, { cachesImpl: cs as unknown as CacheStorage, fetchImpl: fetchFrom({ ...allBodies(), 'data/map/contours.geojson': flipped }), base: BASE });
    expect(rep.ok).toBe(false);
    expect(rep.corrupted).toContain('data/map/contours.geojson');
  });

  it('risorsa irraggiungibile (404): segnalata come mancante dopo i tentativi', async () => {
    const cs = new FakeCacheStorage();
    const m = manifest();
    await installCore(cs, m);
    const files = allBodies();
    delete files['data/map/contours.geojson'];
    const rep = await downloadAndVerify(m, { cachesImpl: cs as unknown as CacheStorage, fetchImpl: fetchFrom(files), base: BASE });
    expect(rep.ok).toBe(false);
    expect(rep.missing).toEqual(['data/map/contours.geojson']);
  }, 15_000);

  it('verifyAll profonda scopre un file sostituito in cache; quella rapida controlla solo la presenza', async () => {
    const cs = new FakeCacheStorage();
    const m = manifest();
    await installCore(cs, m, { map: true });
    expect((await verifyAll(m, { deep: true, cachesImpl: cs as unknown as CacheStorage, base: BASE })).ok).toBe(true);
    const map = await cs.open(mapCacheName(m));
    await map.put(new URL('data/map/contours.geojson', BASE).toString(), new Response('corrotto'));
    const deep = await verifyAll(m, { deep: true, cachesImpl: cs as unknown as CacheStorage, base: BASE });
    expect(deep.ok).toBe(false);
    expect(deep.corrupted).toEqual(['data/map/contours.geojson']);
    expect((await verifyAll(m, { deep: false, cachesImpl: cs as unknown as CacheStorage, base: BASE })).ok).toBe(true);
  });

  it('elimina solo le cache di versioni precedenti', async () => {
    const cs = new FakeCacheStorage();
    await cs.open('vdf-core-vecchia');
    await cs.open('vdf-map-vecchia');
    await cs.open('altra-app');
    const m = manifest();
    await cs.open(coreCacheName(m));
    await cs.open(mapCacheName(m));
    const removed = await pruneOldCaches(m, cs as unknown as CacheStorage);
    expect(removed.sort()).toEqual(['vdf-core-vecchia', 'vdf-map-vecchia']);
    expect(await cs.keys()).toContain('altra-app');
  });
});

describe('stato "pronto per l’uso offline" (mai dichiarato senza verifica)', () => {
  const stubNav = (controlled: boolean) => vi.stubGlobal('navigator', { serviceWorker: { controller: controlled ? {} : null }, storage: { estimate: async () => ({ usage: 1, quota: 100 }) } });
  const evalReady = (cs: FakeCacheStorage, fetchImpl: typeof fetch = fetchFrom({})) => evaluateReadiness({ dev: false, cachesImpl: cs as unknown as CacheStorage, base: BASE, fetchImpl });

  it('build di sviluppo: funzioni offline disattivate', async () => {
    expect((await evaluateReadiness({ dev: true })).state).toBe('dev');
  });

  it('senza service worker/Cache: non supportato', async () => {
    vi.stubGlobal('navigator', {});
    expect((await evaluateReadiness({ dev: false })).state).toBe('unsupported');
  });

  it('mai installato → none', async () => {
    stubNav(true);
    expect((await evalReady(new FakeCacheStorage())).state).toBe('none');
  });

  it('nucleo installato ma senza mappa → partial (non "pronto")', async () => {
    stubNav(true);
    const cs = new FakeCacheStorage();
    await installCore(cs, manifest());
    const info = await evalReady(cs);
    expect(info.state).toBe('partial');
    expect(info.missing).toEqual(['data/map/contours.geojson']);
    expect(info.reason).toContain('mappa');
  });

  it('tutto presente ma mai verificato su questo dispositivo → none, non ready', async () => {
    stubNav(true);
    const cs = new FakeCacheStorage();
    await installCore(cs, manifest(), { map: true });
    const info = await evalReady(cs);
    expect(info.state).toBe('none');
    expect(info.reason).toContain('mai verificate');
  });

  it('verificato ma pagina non ancora controllata dal service worker → needs-reload', async () => {
    stubNav(false);
    const cs = new FakeCacheStorage();
    const m = manifest();
    await installCore(cs, m, { map: true });
    await kvSet(RECORD_KEY, { verifiedAt: 1, buildId: m.buildId, packVersion: m.packVersion, resources: 3, bytes: m.totalBytes, hashSkipped: false });
    expect((await evalReady(cs)).state).toBe('needs-reload');
  });

  it('verificato, completo e controllato → ready', async () => {
    stubNav(true);
    const cs = new FakeCacheStorage();
    const m = manifest();
    await installCore(cs, m, { map: true });
    await kvSet(RECORD_KEY, { verifiedAt: 1, buildId: m.buildId, packVersion: m.packVersion, resources: 3, bytes: m.totalBytes, hashSkipped: false });
    const info = await evalReady(cs);
    expect(info.state).toBe('ready');
    expect(info.storage).toEqual({ usage: 1, quota: 100 });
  });

  it('verifica relativa a un’altra versione → stale; il sistema svuota la cache → torna partial', async () => {
    stubNav(true);
    const cs = new FakeCacheStorage();
    const m = manifest();
    await installCore(cs, m, { map: true });
    await kvSet(RECORD_KEY, { verifiedAt: 1, buildId: 'vecchia', packVersion: m.packVersion, resources: 3, bytes: m.totalBytes, hashSkipped: false });
    expect((await evalReady(cs)).state).toBe('stale');
    await kvSet(RECORD_KEY, { verifiedAt: 1, buildId: m.buildId, packVersion: m.packVersion, resources: 3, bytes: m.totalBytes, hashSkipped: false });
    expect((await evalReady(cs)).state).toBe('ready');
    await cs.delete(mapCacheName(m)); // lo sistema (es. iOS sotto pressione di memoria) rimuove la cache della mappa
    expect((await evalReady(cs)).state).toBe('partial');
  });

  it('segnala un aggiornamento disponibile quando in rete c’è un’altra build', async () => {
    stubNav(true);
    const cs = new FakeCacheStorage();
    const m = manifest();
    await installCore(cs, m, { map: true });
    const newer = (async () => new Response(JSON.stringify(manifest({ buildId: 'b2' })))) as typeof fetch;
    expect((await evalReady(cs, newer)).updateAvailable).toBe(true);
    expect((await evalReady(cs)).updateAvailable).toBe(false);
  });
});
