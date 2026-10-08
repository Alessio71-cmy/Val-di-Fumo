import { expect, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/** Dati di riferimento letti DIRETTAMENTE dai file prodotti dalla pipeline Python (non dal codice TypeScript dell'app). */
interface RawRoute {
  id: string;
  lengthM: number;
  coords: Array<[number, number, number, number]>; // lon, lat, quota, progressiva (m) calcolata dalla pipeline
}
const ROUTES = JSON.parse(fs.readFileSync(path.resolve('public/data/geo/routes.json'), 'utf8')).routes as Record<string, RawRoute>;
const POINTS = JSON.parse(fs.readFileSync(path.resolve('public/data/geo/points.json'), 'utf8')).points as Record<string, { lat: number; lon: number; name: string | null; chainOut: number }>;

export const routeLength = (id = 'route-out') => (ROUTES[id] as RawRoute).lengthM;
export const rawPoint = (id: string) => POINTS[id] as { lat: number; lon: number; name: string | null; chainOut: number };

export interface Pt {
  lat: number;
  lon: number;
}

/** Punto sulla traccia alla progressiva indicata (interpolazione lineare fra due campioni consecutivi). */
export function pointAtChain(chain: number, id = 'route-out'): Pt & { bearing: number } {
  const c = (ROUTES[id] as RawRoute).coords;
  for (let i = 1; i < c.length; i++) {
    const a = c[i - 1] as [number, number, number, number];
    const b = c[i] as [number, number, number, number];
    if (chain <= b[3]) {
      const t = b[3] === a[3] ? 0 : (chain - a[3]) / (b[3] - a[3]);
      const dx = (b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180);
      const dy = b[1] - a[1];
      return { lon: a[0] + (b[0] - a[0]) * t, lat: a[1] + (b[1] - a[1]) * t, bearing: (Math.atan2(dx, dy) * 180) / Math.PI };
    }
  }
  const l = c[c.length - 1] as [number, number, number, number];
  return { lon: l[0], lat: l[1], bearing: 0 };
}

/** Sposta un punto di `meters` lungo la direzione `bearingDeg` (approssimazione equirettangolare, valida su poche centinaia di metri). */
export function offset(p: Pt, bearingDeg: number, meters: number): Pt {
  const r = (bearingDeg * Math.PI) / 180;
  const dLat = (meters * Math.cos(r)) / 111_320;
  const dLon = (meters * Math.sin(r)) / (111_320 * Math.cos((p.lat * Math.PI) / 180));
  return { lat: p.lat + dLat, lon: p.lon + dLon };
}

/** "3,10 km" → 3100; "494 m" → 494. */
export function parseDistance(text: string): number {
  const m = /([\d.,]+)\s*(km|m)\b/.exec(text.replace(/ /g, ' '));
  if (!m) throw new Error(`distanza non riconosciuta: "${text}"`);
  const n = Number((m[1] as string).replace(/\./g, '').replace(',', '.'));
  return m[2] === 'km' ? n * 1000 : n;
}

/** "07:30" → 450 minuti. */
export function parseClock(text: string): number {
  const m = /(\d{1,2})[:.](\d{2})/.exec(text);
  if (!m) throw new Error(`orario non riconosciuto: "${text}"`);
  return Number(m[1]) * 60 + Number(m[2]);
}

export async function openApp(page: Page, route = '/') {
  await page.goto(route);
  await expect(page.getByTestId('primary-action')).toBeVisible({ timeout: 20_000 });
}

export async function tab(page: Page, id: 'oggi' | 'mappa' | 'percorso' | 'esplora' | 'sicurezza') {
  await page.getByTestId(`tab-${id}`).click();
  await expect(page.locator('main#main')).toHaveAttribute('data-tab', id);
}

export async function waitForSwControl(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(async () => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 20_000 })
    .toBe(true);
}

/** Apre "Prepara il viaggio", scarica e attende la verifica riuscita. */
export async function prepareTrip(page: Page) {
  await tab(page, 'oggi');
  await page.getByTestId('primary-action').click();
  const dlg = page.getByRole('dialog', { name: 'Prepara il viaggio' });
  await expect(dlg).toBeVisible();
  await dlg.getByRole('button', { name: /Scarica e verifica/ }).click();
  await expect(dlg.getByText('Pronto per l’uso offline')).toBeVisible({ timeout: 60_000 });
  await dlg.getByRole('button', { name: /Chiudi/ }).first().click();
  await expect(dlg).toBeHidden();
}

export interface NetLog {
  external: string[];
  failedSameOrigin: string[];
  fromNetwork: string[];
  fromServiceWorker: number;
}

/** Registra le richieste di una pagina: serve a dimostrare che offline non ci sono richieste di rete indispensabili. */
export function logNetwork(page: Page, origin: string): NetLog {
  const log: NetLog = { external: [], failedSameOrigin: [], fromNetwork: [], fromServiceWorker: 0 };
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.protocol === 'data:' || u.protocol === 'blob:') return;
    if (u.origin !== origin) log.external.push(r.url());
  });
  page.on('requestfailed', (r) => {
    const u = new URL(r.url());
    if (u.protocol === 'data:' || u.protocol === 'blob:') return;
    if (u.origin === origin) log.failedSameOrigin.push(`${r.url()} — ${r.failure()?.errorText}`);
  });
  page.on('response', (resp) => {
    const u = new URL(resp.url());
    if (u.protocol === 'data:' || u.protocol === 'blob:') return; // blob: = immagine ricostruita in memoria da una risorsa già in cache
    if (u.origin !== origin) return;
    if (resp.fromServiceWorker()) log.fromServiceWorker++;
    else log.fromNetwork.push(resp.url());
  });
  return log;
}

export async function setGeo(ctx: BrowserContext, p: Pt, accuracy: number) {
  await ctx.setGeolocation({ latitude: p.lat, longitude: p.lon, accuracy });
}

/** Legge dal database IndexedDB dell'app le preferenze salvate (null se non c'è ancora nulla). */
export async function readStoredPrefs(page: Page): Promise<Record<string, unknown> | null> {
  return page.evaluate(
    () =>
      new Promise<Record<string, unknown> | null>((resolve) => {
        const req = indexedDB.open('vdf-trail');
        req.onerror = () => resolve(null);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('kv')) {
            db.close();
            resolve(null);
            return;
          }
          const get = db.transaction('kv', 'readonly').objectStore('kv').get('prefs');
          get.onsuccess = () => {
            db.close();
            resolve((get.result as Record<string, unknown> | undefined) ?? null);
          };
          get.onerror = () => {
            db.close();
            resolve(null);
          };
        };
      }),
  );
}

/** Piccolo server statico su una cartella (isolato dagli altri test): serve a provare l'aggiornamento del service worker modificando una copia di dist/. */
export async function serveDir(dir: string, extraHeaders: Record<string, string> = {}): Promise<{ url: string; close: () => Promise<void> }> {
  const http = await import('node:http');
  const MIME: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.geojson': 'application/geo+json',
    '.gpx': 'application/gpx+xml',
    '.svg': 'image/svg+xml',
  };
  const server = http.createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://x');
    let rel = decodeURIComponent(u.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(dir, rel);
    if (!file.startsWith(dir) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache', ...extraHeaders });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  const port = (server.address() as { port: number }).port;
  return { url: `http://127.0.0.1:${port}/`, close: () => new Promise<void>((ok) => server.close(() => ok())) };
}

/** Versione (buildId) del service worker che controlla la pagina, chiesta al worker stesso. */
export async function controllerBuildId(page: Page): Promise<string | null> {
  return page
    .evaluate(
    () =>
      new Promise<string | null>((resolve) => {
        const c = navigator.serviceWorker.controller;
        if (!c) return resolve(null);
        const ch = new MessageChannel();
        const t = setTimeout(() => resolve(null), 4000);
        navigator.serviceWorker.addEventListener(
          'message',
          (e: MessageEvent) => {
            if (e.data?.type === 'VERSION') {
              clearTimeout(t);
              resolve(e.data.buildId as string);
            }
          },
          { once: true },
        );
        void ch;
        c.postMessage({ type: 'GET_VERSION' });
      }),
    )
    .catch(() => null); // la pagina può ricaricarsi proprio mentre si interroga (cambio di controllore)
}

/** Apre una sezione richiudibile di "Sicurezza e offline" (per id: sec-gps, sec-offline, sec-track, sec-emerg, sec-check, sec-limits, sec-sources, sec-look). */
export async function openFold(page: Page, id: string) {
  const d = page.locator(`details#${id}`);
  await expect(d).toBeAttached();
  if (!(await d.evaluate((el: HTMLDetailsElement) => el.open))) await d.locator('> summary').click();
  await expect(d).toHaveJSProperty('open', true);
}
