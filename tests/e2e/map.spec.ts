import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { offset, openApp, openFold, parseDistance, pointAtChain, routeLength, tab } from './helpers';

/** Test AUTOMATICI su Chromium (WebGL via SwiftShader): interazione con mappa, punti, varianti, confronto GPX. */

async function openMap(page: Page) {
  await tab(page, 'mappa');
  await expect(page.getByTestId('gl-map')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
}

const marker = (page: Page, n: number) => page.getByRole('button', { name: new RegExp(`^Punto ${n}:`) });

test('i marker hanno un nome accessibile significativo (non "Map marker") e il punto selezionato mostra distanza e stato di validazione', async ({ page }) => {
  await openApp(page);
  await openMap(page);
  expect(await page.getByRole('button', { name: 'Map marker' }).count()).toBe(0);
  await marker(page, 2).click();
  const panel = page.getByTestId('selected-panel');
  await expect(panel).toContainText('Malga Breguzzo');
  await expect(panel).toContainText(/3,49 km dall’inizio del percorso/);
  await expect(panel).toContainText(/OpenStreetMap/);
  await expect(marker(page, 2)).toHaveAttribute('aria-pressed', 'true');
  await panel.getByRole('button', { name: 'Chiudi la scheda del punto' }).click();
  await expect(panel).toBeHidden();
});

test('marker troppo vicini non si sovrappongono: il meno importante riappare ingrandendo; i punti critici compaiono solo a zoom alto', async ({ page }) => {
  await openApp(page);
  await openMap(page);
  // alla vista d'insieme "Punto 3" (cascata, a 145 m da Malga Breguzzo) è nascosto per non coprire "Punto 2"
  await expect(marker(page, 2)).toBeVisible();
  await expect(marker(page, 3)).toBeHidden();
  expect(await page.locator('.crit-marker').evaluateAll((els) => els.filter((e) => getComputedStyle(e).display !== 'none').length)).toBe(0);

  // zoom con la rotella sul punto 2
  const box = (await marker(page, 2).boundingBox()) as { x: number; y: number; width: number; height: number };
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  // il punto 3 riappare quando la distanza sullo schermo supera 30 px (zoom ≈ 13,5), la fascia "alto" parte da 14
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(150);
  }
  await expect(marker(page, 3)).toBeVisible({ timeout: 10_000 });
  for (let i = 0; i < 20 && (await page.getByTestId('gl-map').getAttribute('data-z')) !== 'high'; i++) {
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(150);
  }
  await expect(page.getByTestId('gl-map')).toHaveAttribute('data-z', 'high');
  // a zoom alto compaiono i punti critici (ponti/bivi) vicini all'area inquadrata, con il loro dettaglio nel nome accessibile
  const crit = page.locator('.crit-marker');
  expect(await crit.count()).toBeGreaterThan(0);
  const labels = await crit.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
  for (const l of labels) expect(l).toMatch(/dall’inizio|dall'inizio/);
});

test('"Vedi sulla mappa" dalla tappa del Leno mostra la passeggiata al ponte (345 m); la variante mostra la sponda opposta', async ({ page }) => {
  await openApp(page);
  await tab(page, 'percorso');
  await page.getByTestId('stage-s2-leno').click();
  await page.getByRole('dialog').getByRole('button', { name: /Vedi sulla mappa/ }).click();
  await expect(page.getByRole('button', { name: 'Leno', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#hud-left .v')).toHaveText(/34\d m|35\d m/);

  await tab(page, 'percorso');
  await page.getByRole('button', { name: /Vedi la variante sulla mappa/ }).click();
  await expect(page.getByRole('button', { name: 'Sponda opposta', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(parseDistance(await page.locator('#hud-left .v').innerText())).toBeGreaterThan(6100);
  expect(parseDistance(await page.locator('#hud-left .v').innerText())).toBeLessThan(6200);
});

test('scelta della sponda per il ritorno (anello): il ritorno usa la variante e lo ricorda', async ({ page }) => {
  await openApp(page);
  await tab(page, 'percorso');
  await page.getByLabel(/Usa la sponda sud-est per il ritorno/).check();
  await tab(page, 'mappa');
  const chips = page.getByRole('group', { name: 'Percorso mostrato' });
  await chips.getByRole('button', { name: 'Ritorno' }).click();
  await expect(chips.getByRole('button', { name: 'Ritorno' })).toHaveAttribute('aria-pressed', 'true');
  expect(parseDistance(await page.locator('#hud-left .v').innerText())).toBeGreaterThan(6100); // 6,15 km = variante
});

test('elenco punti e mappa mostrano le stesse distanze lungo la traccia (da OSM, non in linea d’aria)', async ({ page }) => {
  await openApp(page);
  await tab(page, 'mappa');
  await page.getByRole('button', { name: /Elenco punti/ }).click();
  const items = page.getByTestId('wp-list').locator('li');
  const distances: number[] = [];
  const n = await items.count();
  expect(n).toBe(5);
  for (let i = 0; i < n; i++) {
    const m = /—\s*([\d.,]+\s*(?:km|m))\b/.exec((await items.nth(i).innerText()).replace(/\u00a0/g, ' '));
    distances.push(parseDistance((m as RegExpExecArray)[1] as string));
  }
  // le progressive devono essere strettamente crescenti e l'ultima uguale alla lunghezza del percorso
  for (let i = 1; i < distances.length; i++) expect(distances[i] as number).toBeGreaterThan(distances[i - 1] as number);
  expect(Math.abs((distances[distances.length - 1] as number) - routeLength())).toBeLessThan(5);
});

function gpx(points: Array<{ lat: number; lon: number }>, name: string) {
  return `<?xml version="1.0"?><gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${name}</name><trkseg>${points.map((p) => `<trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"></trkpt>`).join('')}</trkseg></trk></gpx>`;
}

test('confronto con un GPX importato: uguale → coerente; spostato di 200 m → diverso; file non valido → errore chiaro', async ({ page }) => {
  await openApp(page);
  await tab(page, 'sicurezza');
  await openFold(page, 'sec-track');
  const input = page.getByTestId('gpx-input');

  // 1. la nostra stessa traccia
  await input.setInputFiles(path.resolve('public/data/gpx/andata-diga-rifugio.gpx'));
  const res = page.getByTestId('gpx-result');
  await expect(res).toContainText('coerente con la traccia incorporata');
  await expect(res).toContainText(/Scostamento mediano.*0 m/s);

  // 2. stessa traccia traslata di 200 m verso est
  const pts = Array.from({ length: 121 }, (_, i) => offset(pointAtChain((routeLength() * i) / 120), 90, 200));
  await input.setInputFiles({ name: 'spostata.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from(gpx(pts, 'Spostata di 200 m')) });
  await expect(res).toContainText('diversa dalla traccia incorporata');

  // 3. sfasata di soli 20 m: coerente
  const near = Array.from({ length: 121 }, (_, i) => offset(pointAtChain((routeLength() * i) / 120), 90, 20));
  await input.setInputFiles({ name: 'vicina.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from(gpx(near, 'Vicina')) });
  await expect(res).toContainText('coerente con la traccia incorporata');

  // 4. file non valido
  await input.setInputFiles({ name: 'rotto.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from('<gpx><trk>') });
  await expect(page.getByRole('alert').filter({ hasText: /GPX|traccia|XML|valido/i })).toBeVisible();
  await expect(page.getByTestId('gpx-result')).toHaveCount(0);

  // 5. una traccia valida può essere mostrata in mappa e rimossa
  await input.setInputFiles({ name: 'vicina.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from(gpx(near, 'Vicina')) });
  await page.getByRole('button', { name: /Mostra in Mappa/ }).click();
  await expect(page.getByText(/Traccia importata in Mappa:/)).toContainText('Vicina');
  await page.getByRole('button', { name: 'Rimuovi' }).click();
  await expect(page.getByText(/Traccia importata in Mappa:/)).toHaveCount(0);
});

test('esportazione GPX: file valido, stesso numero di punti della traccia ufficiale incorporata, quote presenti', async ({ page }) => {
  await openApp(page);
  await tab(page, 'sicurezza');
  await openFold(page, 'sec-track');
  for (const [label, file, ref] of [
    ['Andata (diga → rifugio)', 'andata-diga-rifugio.gpx', 'andata-diga-rifugio.gpx'],
    ['Ritorno (rifugio → diga)', 'ritorno-rifugio-diga.gpx', 'ritorno-rifugio-diga.gpx'],
    ['Variante sponda opposta', 'variante-sponda-opposta.gpx', 'variante-sponda-opposta.gpx'],
    ['Passeggiata al ponte del Leno', 'cascata-del-leno.gpx', 'cascata-del-leno.gpx'],
  ] as const) {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: `Scarica GPX: ${label}` }).click()]);
    expect(dl.suggestedFilename()).toBe(file);
    const xml = fs.readFileSync((await dl.path()) as string, 'utf8');
    const refXml = fs.readFileSync(path.resolve('public/data/gpx', ref), 'utf8');
    const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
    expect(count(xml, /<trkpt /g), file).toBe(count(refXml, /<trkpt /g));
    expect(count(xml, /<ele>/g), `${file}: quote`).toBeGreaterThanOrEqual(count(refXml, /<trkpt /g));
    expect(xml).toMatch(/^<\?xml/);
    expect(xml.trim().endsWith('</gpx>')).toBe(true);
  }
});
