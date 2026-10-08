import { expect, test, type Page, type Route } from '@playwright/test';
import { openApp, openFold, tab } from './helpers';

/**
 * T15 — gestione di dati incompleti, e ripiego quando WebGL manca o va perso.
 * Test AUTOMATICI su Chromium. Il service worker è bloccato perché l'intercettazione delle richieste della pagina
 * (page.route) non vede le risposte servite dalla cache del service worker.
 */
test.use({ serviceWorkers: 'block' });

const fail404 = (r: Route) => r.fulfill({ status: 404, body: 'not found' });
const fail500 = (r: Route) => r.fulfill({ status: 500, body: 'boom' });
const garbage = (r: Route) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"routes": ' });

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/ERR_TUNNEL_CONNECTION_FAILED|Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  return errors;
}

test('traccia assente (404): avviso chiaro, mappa e programma non inventano nulla, il resto funziona', async ({ page }) => {
  const errors = collectErrors(page);
  await page.route('**/data/geo/routes.json', fail404);
  await openApp(page);
  const warn = page.getByRole('alert').filter({ hasText: 'Dati incompleti' });
  await expect(warn).toBeVisible();
  await expect(warn).toContainText('routes.json');
  await expect(warn).toContainText('disattivate o mostrate come non disponibili');

  await tab(page, 'mappa');
  const err = page.getByRole('alert').filter({ hasText: 'Traccia non disponibile' });
  await expect(err).toBeVisible();
  await page.getByRole('button', { name: /elenco testuale delle tappe/ }).click();
  await expect(page.getByTestId('timeline').locator('li')).toHaveCount(9); // il testo dell'itinerario resta consultabile
  await tab(page, 'sicurezza');
  await openFold(page, 'sec-emerg');
  await expect(page.getByTestId('call-112')).toBeVisible();
  expect(errors).toEqual([]);
});

test('traccia illeggibile (JSON troncato): stessa gestione, nessuna eccezione', async ({ page }) => {
  const errors = collectErrors(page);
  await page.route('**/data/geo/routes.json', garbage);
  await openApp(page);
  await expect(page.getByRole('alert').filter({ hasText: 'Dati incompleti' })).toBeVisible();
  await tab(page, 'mappa');
  await expect(page.getByRole('alert').filter({ hasText: 'Traccia non disponibile' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('punti assenti (500): l’app resta usabile e lo dichiara', async ({ page }) => {
  const errors = collectErrors(page);
  await page.route('**/data/geo/points.json', fail500);
  await openApp(page);
  await expect(page.getByRole('alert').filter({ hasText: 'Dati incompleti' })).toContainText('points.json');
  for (const t of ['mappa', 'percorso', 'esplora', 'sicurezza', 'oggi'] as const) {
    await tab(page, t);
    await expect(page.locator('main#main')).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('tempi di guida e orizzonte assenti: il programma usa stime di ripiego dichiarate, senza sole diretto', async ({ page }) => {
  const errors = collectErrors(page);
  await page.route('**/data/geo/drive.json', fail404);
  await page.route('**/data/geo/horizon.json', fail404);
  await openApp(page);
  await expect(page.getByRole('alert').filter({ hasText: 'Dati incompleti' })).toContainText('durate di guida sostituite da valori prudenziali');
  await expect(page.getByRole('alert').filter({ hasText: 'Dati incompleti' })).toContainText('niente stima del sole diretto');
  await page.getByRole('button', { name: /Programma completo/ }).click();
  await expect(page.getByTestId('latest-return')).toHaveText(/\d\d:\d\d/);
  await expect(page.locator('#drive-toBoazzo')).toHaveValue('120'); // ripiego generico, modificabile
  await expect(page.getByTestId('latest-card')).toContainText('n.d.'); // finestre di sole diretto non disponibili
  expect(errors).toEqual([]);
});

test('tutti i dati geografici assenti: nessuna schermata bianca, nessuna eccezione', async ({ page }) => {
  const errors = collectErrors(page);
  await page.route('**/data/geo/*.json', fail404);
  await openApp(page);
  const warn = page.getByRole('alert').filter({ hasText: 'Dati incompleti' });
  expect(await warn.locator('li').count()).toBeGreaterThanOrEqual(5);
  await expect(warn).toContainText('routes.json');
  await expect(warn).toContainText('points.json');
  for (const t of ['mappa', 'percorso', 'esplora', 'sicurezza'] as const) {
    await tab(page, t);
    await expect(page.locator('main#main')).not.toBeEmpty();
  }
  expect(errors).toEqual([]);
});

test('pacchetto mappa incompleto: mappa schematica con traccia e punti e avviso, non una mappa vuota', async ({ page }) => {
  const errors = collectErrors(page);
  await page.route('**/data/map/contours.geojson', fail404);
  await openApp(page);
  await tab(page, 'mappa');
  await expect(page.getByTestId('map-screen')).toHaveAttribute('data-mode', 'svg');
  await expect(page.getByTestId('no-pack')).toContainText('Pacchetto mappa non disponibile');
  await expect(page.getByTestId('svg-route')).toBeVisible();
  const wp = page.getByRole('button', { name: /^Punto 2:/ });
  await wp.click();
  await expect(page.getByTestId('selected-panel')).toContainText('Malga Breguzzo');
  expect(errors).toEqual([]);
});

test('WebGL non disponibile: ripiego SVG con traccia, punti selezionabili e tastiera', async ({ page }) => {
  const errors = collectErrors(page);
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (/webgl/i.test(type)) return null;
      return (orig as (...a: unknown[]) => unknown).call(this, type, ...rest) as never;
    } as typeof orig;
  });
  await openApp(page);
  await tab(page, 'mappa');
  await expect(page.getByTestId('map-screen')).toHaveAttribute('data-mode', 'svg');
  await expect(page.getByTestId('svg-route')).toBeVisible();
  const wp = page.getByRole('button', { name: /^Punto 5:/ });
  await wp.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('selected-panel')).toContainText('Rifugio');
  // i tre indicatori principali restano disponibili
  await expect(page.locator('#hud-where')).toBeVisible();
  await expect(page.locator('#hud-next')).toBeVisible();
  await expect(page.locator('#hud-left')).toContainText('km');
  expect(errors).toEqual([]);
});

test('contesto WebGL perso a mappa aperta: passaggio automatico alla mappa schematica con avviso', async ({ page }) => {
  await openApp(page);
  await tab(page, 'mappa');
  await expect(page.getByTestId('gl-map')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
  await page.evaluate(() => {
    const c = document.querySelector('.maplibregl-canvas');
    c?.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  });
  await expect(page.getByTestId('map-screen')).toHaveAttribute('data-mode', 'svg');
  await expect(page.getByTestId('gl-failed')).toContainText('mappa schematica');
  await expect(page.getByTestId('svg-route')).toBeVisible();
});
