/* Service worker — Val di Fumo Trail Companion.
 * Scritto a mano, senza dipendenze. BUILD_ID viene sostituito dal build (vite.config.ts → tools/offlinePlugin.ts).
 *
 * Strategia:
 *  - install: scarica nella cache "core" tutte le risorse del gruppo core del manifest (shell + testi + tracce + GPX);
 *  - fetch  : cache-first per le risorse del manifest (core e mappa); rete come ripiego; navigazioni → index.html;
 *  - la mappa (gruppo "map") la scarica la pagina con "Prepara il viaggio", che poi la verifica (dimensione + SHA-256);
 *  - la nuova versione NON si attiva da sola quando c'è già una versione installata: attende la conferma dell'utente;
 *  - le richieste verso altre origini (meteo, link esterni) non vengono intercettate.
 */
const BUILD_ID = '__BUILD_ID__';
const CORE_PREFIX = 'vdf-core-';
const MAP_PREFIX = 'vdf-map-';
const CORE_CACHE = CORE_PREFIX + BUILD_ID;
const MANIFEST_PATH = 'precache-manifest.json';
const SCOPE = self.registration.scope;
const abs = (p) => new URL(p, SCOPE).toString();

let manifestPromise = null;
function getManifest() {
  if (!manifestPromise) {
    manifestPromise = caches
      .open(CORE_CACHE)
      .then((c) => c.match(abs(MANIFEST_PATH)))
      .then((r) => (r ? r.json() : null))
      .catch(() => null);
  }
  return manifestPromise;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const res = await fetch(abs(MANIFEST_PATH), { cache: 'no-store' });
      if (!res.ok) throw new Error('manifest: HTTP ' + res.status);
      const manifest = await res.json();
      if (manifest.buildId !== BUILD_ID) throw new Error('manifest e service worker non appartengono alla stessa build');
      const cache = await caches.open(CORE_CACHE);
      const core = manifest.resources.filter((r) => r.group === 'core');
      for (let i = 0; i < core.length; i += 6) {
        await Promise.all(
          core.slice(i, i + 6).map(async (r) => {
            const resp = await fetch(abs(r.url), { cache: 'reload' });
            if (!resp.ok) throw new Error(r.url + ': HTTP ' + resp.status);
            await cache.put(abs(r.url), resp);
          }),
        );
      }
      await cache.put(abs(MANIFEST_PATH), new Response(JSON.stringify(manifest), { headers: { 'content-type': 'application/json' } }));
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const k of await caches.keys()) {
        if (k.startsWith(CORE_PREFIX) && k !== CORE_CACHE) await caches.delete(k);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  const d = event.data;
  if (d && d.type === 'SKIP_WAITING') self.skipWaiting();
  if (d && d.type === 'GET_VERSION' && event.source) event.source.postMessage({ type: 'VERSION', buildId: BUILD_ID });
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // meteo e link esterni: non intercettati
  event.respondWith(handle(req));
});

async function handle(req) {
  const core = await caches.open(CORE_CACHE);
  const key = new URL(req.mode === 'navigate' ? abs('index.html') : req.url);
  key.search = '';
  key.hash = '';
  let hit = await core.match(key.toString());
  if (!hit) {
    const manifest = await getManifest();
    if (manifest) {
      const map = await caches.open(MAP_PREFIX + manifest.packVersion);
      hit = await map.match(key.toString());
    }
  }
  if (hit) return hit;
  try {
    return await fetch(req);
  } catch (e) {
    if (req.mode === 'navigate') {
      const idx = await core.match(abs('index.html'));
      if (idx) return idx;
    }
    return new Response('Offline: risorsa non disponibile.', {
      status: 503,
      statusText: 'Offline',
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
}
