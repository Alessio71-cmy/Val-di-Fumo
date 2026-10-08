import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { controllerBuildId, openApp, openFold, prepareTrip, serveDir, tab, waitForSwControl } from './helpers';

/** Test AUTOMATICI su Chromium: manifest, installabilità, service worker, verifica del pacchetto offline, aggiornamento. */

function pngSize(buf: Buffer): { w: number; h: number } {
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

test('manifest PWA completo; icone esistenti con le dimensioni dichiarate; meta per iOS', async ({ page, request }) => {
  await openApp(page);
  const href = await page.locator('link[rel=manifest]').getAttribute('href');
  expect(href).toBeTruthy();
  const mUrl = new URL(href as string, page.url()).toString();
  const res = await request.get(mUrl);
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m.name).toContain('Val di Fumo');
  expect(m.short_name.length).toBeLessThanOrEqual(12);
  expect(m.display).toBe('standalone');
  expect(m.lang).toBe('it');
  expect(m.start_url).toBeTruthy();
  expect(m.scope).toBeTruthy();
  expect(m.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  expect(m.theme_color).toBe(await page.locator('meta[name=theme-color]').getAttribute('content'));
  const sizes = (m.icons as Array<{ src: string; sizes: string; purpose?: string; type?: string }>).map((i) => `${i.sizes}:${i.purpose ?? 'any'}`);
  expect(sizes).toEqual(expect.arrayContaining(['192x192:any', '512x512:any', '512x512:maskable']));
  for (const icon of m.icons as Array<{ src: string; sizes: string; type: string }>) {
    const r = await request.get(new URL(icon.src, mUrl).toString());
    expect(r.ok(), icon.src).toBe(true);
    expect(r.headers()['content-type']).toContain('image/png');
    const { w, h } = pngSize(await r.body());
    expect(`${w}x${h}`, icon.src).toBe(icon.sizes);
  }
  // iOS: icona nella Home e modalità app
  const apple = await page.locator('link[rel=apple-touch-icon]').getAttribute('href');
  const ar = await request.get(new URL(apple as string, page.url()).toString());
  expect(ar.ok()).toBe(true);
  expect(pngSize(await ar.body())).toEqual({ w: 180, h: 180 });
  expect(await page.locator('meta[name=apple-mobile-web-app-capable]').getAttribute('content')).toBe('yes');
  expect(await page.locator('meta[name=viewport]').getAttribute('content')).toContain('viewport-fit=cover');
  expect(await page.locator('html').getAttribute('lang')).toBe('it');
});

test('"pronto per l’uso offline" compare solo dopo download e verifica; mai prima', async ({ page }) => {
  await openApp(page);
  await waitForSwControl(page);
  await expect(page.getByTestId('chip-offline')).toContainText(/incompleto|Riapri/);
  expect(await page.getByText('Offline pronto').count()).toBe(0);
  await tab(page, 'sicurezza');
  await openFold(page, 'sec-offline');
  await expect(page.getByTestId('offline-state')).not.toHaveText('Pronto per l’uso offline');
  await prepareTrip(page);
  await expect(page.getByTestId('chip-offline')).toContainText('Offline pronto');
  await tab(page, 'sicurezza');
  await openFold(page, 'sec-offline');
  await expect(page.getByTestId('offline-state')).toHaveText('Pronto per l’uso offline');
  await expect(page.getByText(/Ultima verifica/).first()).toBeVisible();
  // il sito chiede l'archiviazione persistente (iOS/Android possono comunque svuotare la cache sotto pressione)
  await tab(page, 'oggi');
  await page.getByTestId('primary-action').click();
  await expect(page.getByText(/Archiviazione persistente:/)).toBeVisible();
});

test('controprova: una risorsa della mappa manomessa nella cache viene scoperta e lo stato smette di essere "pronto"', async ({ page }) => {
  await openApp(page);
  await waitForSwControl(page);
  await prepareTrip(page);
  await expect(page.getByTestId('chip-offline')).toContainText('Offline pronto');

  // manomissione: stessa chiave, contenuto diverso
  await page.evaluate(async () => {
    const k = (await caches.keys()).find((n) => n.startsWith('vdf-map-')) as string;
    const c = await caches.open(k);
    await c.put(new URL('data/map/contours.geojson', document.baseURI).toString(), new Response('{"corrotto":true}'));
  });
  await page.reload();
  await expect(page.getByTestId('primary-action')).toBeVisible();
  // la verifica profonda automatica (una volta per sessione) lo rileva senza che l'utente faccia nulla
  await expect(page.getByTestId('chip-offline')).toContainText('Offline incompleto', { timeout: 15_000 });
  await tab(page, 'sicurezza');
  await openFold(page, 'sec-offline');
  await expect(page.getByTestId('offline-state')).toHaveText('Parziale: mancano risorse');
  await expect(page.getByText(/danneggiate/).first()).toBeVisible();

  // riparazione con "Prepara il viaggio"
  await prepareTrip(page);
  await expect(page.getByTestId('chip-offline')).toContainText('Offline pronto');
});

test('controprova: cache della mappa svuotata dal sistema → stato "incompleto" e mappa schematica, non "pronto"', async ({ page }) => {
  await openApp(page);
  await waitForSwControl(page);
  await prepareTrip(page);
  await page.evaluate(async () => {
    for (const k of await caches.keys()) if (k.startsWith('vdf-map-')) await caches.delete(k);
  });
  await page.reload();
  await expect(page.getByTestId('chip-offline')).toContainText('Offline incompleto', { timeout: 15_000 });
});

test('aggiornamento del service worker: la nuova versione attende la conferma dell’utente e poi pulisce le vecchie cache', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vdf-update-'));
  fs.cpSync(path.resolve('dist'), tmp, { recursive: true });
  const srv = await serveDir(tmp);
  const ctx = await browser.newContext({ baseURL: srv.url, serviceWorkers: 'allow' });
  const page = await ctx.newPage();
  try {
    await page.goto(srv.url);
    await expect(page.getByTestId('primary-action')).toBeVisible();
    await waitForSwControl(page);
    const oldId = (await controllerBuildId(page)) as string;
    expect(oldId).toMatch(/^[0-9a-f]{12}$/);
    await prepareTrip(page);

    // pubblico una "nuova build": cambia solo il buildId (sw.js e manifest di precache)
    const newId = 'ffffffffffff';
    const swPath = path.join(tmp, 'sw.js');
    fs.writeFileSync(swPath, fs.readFileSync(swPath, 'utf8').replace(`const BUILD_ID = '${oldId}'`, `const BUILD_ID = '${newId}'`));
    const mPath = path.join(tmp, 'precache-manifest.json');
    const man = JSON.parse(fs.readFileSync(mPath, 'utf8'));
    man.buildId = newId;
    fs.writeFileSync(mPath, JSON.stringify(man));

    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg?.update();
    });
    await expect(page.getByTestId('update-banner')).toBeVisible({ timeout: 20_000 });
    // non si è attivata da sola: la pagina è ancora controllata dalla versione precedente, anche dopo una ricarica
    expect(await controllerBuildId(page)).toBe(oldId);
    await page.reload();
    await expect(page.getByTestId('primary-action')).toBeVisible();
    expect(await controllerBuildId(page)).toBe(oldId);
    await expect(page.getByTestId('update-banner')).toBeVisible();

    // l'utente conferma → nuova versione attiva, vecchia cache del nucleo rimossa
    await tab(page, 'sicurezza');
    await openFold(page, 'sec-offline');
    const origin0 = await page.evaluate(() => performance.timeOrigin);
    await page.getByRole('button', { name: /Applica l’aggiornamento dell’app/ }).click();
    // si attende il ricaricamento della pagina SENZA interrogare il vecchio service worker: ogni messaggio o richiesta gli
    // impedirebbe di fermarsi e quindi alla nuova versione di attivarsi (comportamento di Chromium, non dell'app)
    await expect.poll(async () => page.evaluate(() => performance.timeOrigin).catch(() => origin0), { timeout: 20_000 }).not.toBe(origin0);
    await expect.poll(async () => controllerBuildId(page), { timeout: 20_000 }).toBe(newId);
    // la pagina si ricarica da sola dopo il cambio di controllore: si riprova finché il contesto è stabile
    const cacheNames = async () => {
      try {
        return await page.evaluate(async () => caches.keys());
      } catch {
        return [] as string[];
      }
    };
    await expect.poll(cacheNames, { timeout: 20_000 }).toContain(`vdf-core-${newId}`);
    await expect.poll(cacheNames, { timeout: 20_000 }).not.toContain(`vdf-core-${oldId}`);
    // dopo l'aggiornamento il pacchetto va riverificato: non resta "pronto" per ereditarietà
    await expect(page.getByTestId('chip-offline')).not.toContainText('Offline pronto');
  } finally {
    await ctx.close();
    await srv.close();
    fs.rmSync(tmp, { recursive: true, force: true });
    void testInfo;
  }
});

test('installazione: stato, pulsante "Installa l’app" (evento beforeinstallprompt SIMULATO) e istruzioni per iPhone/Safari', async ({ page, browser }) => {
  await openApp(page);
  // browser (non installata): istruzioni generiche per Android
  await expect(page.getByTestId('install-line')).toContainText('Aperta nel browser');
  await expect(page.getByTestId('install-button')).toHaveCount(0);
  // Chrome offre l'installazione: l'app raccoglie l'evento e mostra il pulsante SOLO su richiesta dell'utente
  await page.evaluate(() => {
    const ev = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: async () => {
        (window as unknown as { __prompted: number }).__prompted = ((window as unknown as { __prompted?: number }).__prompted ?? 0) + 1;
      },
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    });
    window.dispatchEvent(ev);
  });
  await expect(page.getByTestId('install-button')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __prompted?: number }).__prompted ?? 0)).toBe(0); // nessuna finestra mostrata da sola
  await page.getByTestId('install-button').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __prompted?: number }).__prompted ?? 0)).toBe(1);
  await expect(page.getByTestId('install-button')).toHaveCount(0); // l'evento si usa una volta sola
  await tab(page, 'sicurezza');
  await openFold(page, 'sec-offline');
  await expect(page.getByTestId('install-state')).toContainText('Non installata');

  // iPhone con Safari (user agent emulato su Chromium: prova i TESTI, non il comportamento di iOS)
  const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const c1 = await browser.newContext({ userAgent: safari, viewport: { width: 390, height: 844 } });
  const p1 = await c1.newPage();
  await p1.goto('/');
  await expect(p1.getByTestId('install-line')).toContainText('Condividi → “Aggiungi alla schermata Home”', { timeout: 20_000 });
  await expect(p1.getByTestId('install-line')).toContainText('prepara il viaggio dall’icona');
  await c1.close();

  // iPhone con Chrome: l'app consiglia Safari invece di affermare cose non verificabili
  const chromeIos = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1';
  const c2 = await browser.newContext({ userAgent: chromeIos, viewport: { width: 390, height: 844 } });
  const p2 = await c2.newPage();
  await p2.goto('/');
  await expect(p2.getByTestId('install-line')).toContainText('apri lo stesso indirizzo in Safari', { timeout: 20_000 });
  await c2.close();
});
