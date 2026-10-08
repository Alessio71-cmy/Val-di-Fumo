import { chromium, devices, expect, test, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { logNetwork, openApp, openFold, parseDistance, pointAtChain, prepareTrip, rawPoint, routeLength, setGeo, tab, waitForSwControl } from './helpers';

/**
 * Test AUTOMATICI su Chromium. La "modalità aereo" è SIMULATA con BrowserContext.setOffline(true) e la "chiusura e riapertura
 * dell'app" con la chiusura e la riapertura di un profilo persistente. Non sostituiscono la prova su un telefono reale
 * (iPhone/Safari, modalità aereo vera, GPS senza dati mobili): vedi docs/TEST-REPORT.md.
 */
const BASE = 'http://127.0.0.1:4173';

function launch(profile: string, extra: Parameters<typeof chromium.launchPersistentContext>[1] = {}) {
  const { defaultBrowserType: _ignored, ...pixel } = devices['Pixel 7'];
  void _ignored;
  return chromium.launchPersistentContext(profile, {
    ...pixel,
    baseURL: BASE,
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    ...extra,
  });
}

async function firstPage(ctx: BrowserContext): Promise<Page> {
  return ctx.pages()[0] ?? (await ctx.newPage());
}

test('T4–T8, T19: download verificato → offline simulato → riapertura → mappa, punti e GPS senza rete', async ({}, testInfo) => {
  test.setTimeout(300_000);
  // percorso ASCII: con caratteri non ASCII nel percorso del profilo Chromium non registra il service worker
  const profile = path.resolve('test-results', 'profiles', `offline-${testInfo.workerIndex}-${Date.now()}`);
  fs.rmSync(profile, { recursive: true, force: true });

  // ---------- A. online: installazione del service worker e download verificato ----------
  const ctx1 = await launch(profile);
  try {
    const page = await firstPage(ctx1);
    await openApp(page);
    await waitForSwControl(page);
    // prima del download la mappa non c'è: lo stato NON deve dire "pronto"
    await expect(page.getByTestId('chip-offline')).toContainText(/incompleto|Riapri/);
    await prepareTrip(page);
    await expect(page.getByTestId('chip-offline')).toContainText('Offline pronto');

    // la cache contiene davvero quanto promette il manifest
    const caches1 = await page.evaluate(async () => {
      const out: Record<string, string[]> = {};
      for (const k of await caches.keys()) out[k] = (await (await caches.open(k)).keys()).map((r) => new URL(r.url).pathname);
      return out;
    });
    const names = Object.keys(caches1);
    expect(names.some((n) => n.startsWith('vdf-core-'))).toBe(true);
    expect(names.some((n) => n.startsWith('vdf-map-'))).toBe(true);
    const all = Object.values(caches1).flat();
    for (const must of ['/data/map/hillshade.webp', '/data/map/contours.geojson', '/data/geo/routes.json', '/data/gpx/andata-diga-rifugio.gpx', '/index.html', '/precache-manifest.json']) {
      expect(all, `manca in cache: ${must}`).toContain(must);
    }
    await expect(page.getByTestId('chip-offline')).toContainText('Offline pronto');
  } finally {
    await ctx1.close();
  }

  // ---------- B. riapertura (profilo persistente) con rete DISATTIVATA dall'inizio ----------
  const ctx2 = await launch(profile, { permissions: ['geolocation'], geolocation: { latitude: 46.0521, longitude: 10.5134, accuracy: 10 } });
  try {
    await ctx2.setOffline(true);
    const page = await firstPage(ctx2);
    const net = logNetwork(page, BASE);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/');
    await expect(page.getByTestId('primary-action')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('chip-network')).toHaveText(/Senza rete/);
    await expect(page.getByTestId('chip-offline')).toContainText('Offline pronto', { timeout: 20_000 });

    // T7 — mappa offline: il rendering WebGL completa il caricamento dello stile senza rete
    await tab(page, 'mappa');
    await expect(page.getByTestId('map-screen')).toHaveAttribute('data-mode', 'gl');
    await expect(page.getByTestId('gl-map')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
    expect(await page.locator('.wp').count()).toBeGreaterThanOrEqual(5);
    await expect(page.getByTestId('no-pack')).toHaveCount(0);

    // T8 — waypoint offline: elenco testuale con distanze e coordinate
    await page.getByRole('button', { name: /Elenco punti/ }).click();
    const list = page.getByTestId('wp-list');
    await expect(list.locator('li')).toHaveCount(5);
    await expect(list).toContainText('Malga Breguzzo');
    await expect(list).toContainText('Rifugio Val');
    await expect(list.locator('li').first()).toContainText(/46,\d{4}|46\.\d{4}|46°/);
    await page.getByRole('dialog').getByRole('button', { name: 'Chiudi' }).click();

    // percorso e tappe
    await tab(page, 'percorso');
    await expect(page.getByTestId('timeline').locator('li')).toHaveCount(9);
    // sicurezza: guida di emergenza consultabile offline
    await tab(page, 'sicurezza');
    await openFold(page, 'sec-emerg');
    await expect(page.getByTestId('emergency-text')).toContainText('EMERGENZA');
    await expect(page.getByTestId('call-112')).toHaveAttribute('href', 'tel:112');

    // T9 (SIMULATO) — acquisizione GPS senza rete: consenso esplicito, poi posizione con precisione
    await tab(page, 'mappa');
    await expect(page.getByTestId('gl-map')).toHaveAttribute('data-ready', '1');
    await page.getByTestId('gps-toggle').click();
    await expect(page.locator('.user-dot')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#hud-where')).toContainText(/Sulla traccia|dalla traccia/);

    // distanza lungo il tracciato, confrontata con il valore della pipeline (a 3000 m dall'inizio)
    await setGeo(ctx2, pointAtChain(3000), 8);
    await expect.poll(async () => parseDistance((await page.locator('#hud-left .v').innerText()) || '0 m'), { timeout: 20_000 }).toBeGreaterThan(0);
    await expect
      .poll(async () => Math.abs(parseDistance(await page.locator('#hud-left .v').innerText()) - (routeLength() - 3000)), { timeout: 20_000 })
      .toBeLessThan(40);
    const next = page.locator('#hud-next');
    await expect(next).toContainText('Malga Breguzzo');
    const toNext = parseDistance(await next.locator('.s').innerText());
    expect(Math.abs(toNext - (rawPoint('malga-breguzzo').chainOut - 3000))).toBeLessThan(40);

    // T19 — nessuna richiesta di rete: niente richieste verso altri domini, nessuna richiesta fallita verso l'origine
    expect(net.external, `richieste esterne: ${net.external.join(', ')}`).toEqual([]);
    expect(net.failedSameOrigin, `richieste fallite: ${net.failedSameOrigin.join(', ')}`).toEqual([]);
    expect(net.fromNetwork, `servite dalla rete invece che dalla cache: ${net.fromNetwork.join(', ')}`).toEqual([]);
    expect(net.fromServiceWorker).toBeGreaterThan(5);
    expect(errors).toEqual([]);
  } finally {
    await ctx2.close();
  }
});
