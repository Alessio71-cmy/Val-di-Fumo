import { expect, test } from '@playwright/test';
import { openApp, openFold, tab } from './helpers';

/** Test AUTOMATICI: ogni elemento geografico/itinerario espone i campi di provenienza richiesti dal brief (fonte, stato, data di verifica). */

test('Percorso: 9 tappe in ordine, ciascuna con modalità, posizione, distanza, tempo, segnavia, stato, data di verifica e fonti', async ({ page }) => {
  await openApp(page);
  await tab(page, 'percorso');
  const items = page.getByTestId('timeline').locator('li > button.item');
  await expect(items).toHaveCount(9);
  for (let i = 0; i < 9; i++) {
    await tab(page, 'percorso');
    await page.getByTestId('timeline').locator('li > button.item').nth(i).click();
    const dlg = page.getByRole('dialog');
    await expect(dlg).toBeVisible();
    const name = (await dlg.getByRole('heading', { level: 2 }).first().innerText()).trim();
    await expect(dlg.locator('.chip', { hasText: /In auto|A piedi|Sosta/ }).first(), name).toBeVisible();
    await expect(dlg.locator('.badge').first(), `${name}: stato di validazione`).toBeVisible();
    await expect(dlg, `${name}: data di verifica`).toContainText(/Verificato il 2026-\d\d-\d\d/);
    for (const dt of ['Posizione', 'Distanza dalla tappa precedente', 'Tempo indicativo', 'Segnavia da seguire']) {
      await expect(dlg.locator('dt', { hasText: dt }), `${name}: manca "${dt}"`).toHaveCount(1);
    }
    await expect(dlg, `${name}: dati incompleti`).not.toContainText('non disponibile (dati incompleti)');
    const sources = dlg.locator('summary', { hasText: /^\s*Fonti \(\d+\)/ });
    await expect(sources, `${name}: fonti`).toHaveCount(1);
    const nSrc = Number(/\((\d+)\)/.exec(await sources.innerText())?.[1]);
    expect(nSrc, `${name}: almeno una fonte`).toBeGreaterThanOrEqual(1);
    if (/A piedi/.test(await dlg.innerText())) await expect(dlg.getByRole('heading', { name: 'Difficoltà e avvertenze' }), `${name}: avvertenze`).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dlg).toBeHidden();
  }
});

test('Percorso: punti di attenzione (ponti, bivi) con distanza dalla diga e dichiarazione di origine OSM', async ({ page }) => {
  await openApp(page);
  await tab(page, 'percorso');
  const list = page.getByTestId('critical-list');
  expect(await list.locator('li').count()).toBeGreaterThanOrEqual(5);
  await expect(page.getByRole('heading', { name: /Punti di attenzione/ })).toBeVisible();
  await expect(page.getByText(/L’app non dice “destra\/sinistra”/)).toBeVisible();
  await expect(list.locator('li').first()).toContainText(/dalla diga/);
});

test('Esplora: 8 schede con tipo (sul percorso/deviazione), provenienza, suggerimenti fotografici e nota sulle immagini; i filtri sono coerenti', async ({ page }) => {
  await openApp(page);
  await tab(page, 'esplora');
  const cards = page.getByTestId('poi-list').locator('article');
  await expect(cards).toHaveCount(8);
  for (let i = 0; i < 8; i++) {
    const c = cards.nth(i);
    const name = (await c.getByRole('heading', { level: 2 }).innerText()).trim();
    await expect(c.locator('.chip', { hasText: /Sul percorso|Richiede deviazione/ }), `${name}: tipo`).toBeVisible();
    await expect(c.locator('.badge'), `${name}: stato`).toBeVisible();
    await expect(c, `${name}: verifica`).toContainText(/Verificato il 2026-/);
    await expect(c, `${name}: foto`).toContainText('Suggerimenti fotografici');
    await expect(c, `${name}: immagini`).toContainText('Nessuna fotografia inclusa');
    await expect(c.locator('summary', { hasText: /Fonti \(\d+\)/ }), `${name}: fonti`).toHaveCount(1);
    await expect(c.getByRole('button', { name: /\d{2}\.\d{5}, \d{1,2}\.\d{5}/ }).first(), `${name}: coordinate`).toBeVisible();
  }
  await page.getByRole('button', { name: 'Sul percorso' }).click();
  const on = await cards.count();
  await page.getByRole('button', { name: 'Con deviazione' }).click();
  const off = await cards.count();
  expect(on + off).toBe(8);
  expect(on).toBeGreaterThan(0);
  expect(off).toBeGreaterThan(0);
});

test('Oggi: dichiara che la traccia deriva da OpenStreetMap, non è verificata sul campo, e mostra lo stato incerto del rifugio', async ({ page }) => {
  await openApp(page);
  await expect(page.getByText(/Traccia da OpenStreetMap — non verificata sul campo/)).toBeVisible();
  await expect(page.getByText(/Ultima modifica OSM/)).toBeVisible();
  await expect(page.getByTestId('hut-card')).toContainText('apertura da confermare');
  // il programma è dichiarato come stima
  await expect(page.getByRole('region', { name: 'Programma' })).toContainText(/stima|prudenziale/);
});

test('Sicurezza: guida di emergenza, checklist persistente, limiti dell’app e limitazioni iOS dichiarate', async ({ page }) => {
  await openApp(page);
  await tab(page, 'sicurezza');
  await openFold(page, 'sec-emerg');
  await expect(page.getByText(/Senza copertura la chiamata può non partire/)).toBeVisible();
  await expect(page.getByTestId('call-112')).toHaveAttribute('href', 'tel:112');
  await expect(page.getByText(/Numeri da verificare PRIMA di partire/)).toBeVisible();

  await openFold(page, 'sec-check');
  const boxes = page.locator('details#sec-check input[type=checkbox]');
  expect(await boxes.count()).toBeGreaterThanOrEqual(15);
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await page.waitForTimeout(500);
  await page.reload();
  await openApp(page);
  await tab(page, 'sicurezza');
  await openFold(page, 'sec-check');
  await expect(page.locator('details#sec-check input[type=checkbox]').nth(0)).toBeChecked();
  await expect(page.locator('details#sec-check input[type=checkbox]').nth(2)).not.toBeChecked();

  await openFold(page, 'sec-limits');
  const limits = page.locator('details#sec-limits');
  await expect(limits).toContainText(/iPhone|iOS/);
  await expect(limits).toContainText(/schermo bloccato|secondo piano/);
  await expect(limits).toContainText(/112 non funziona dove non c’è alcuna rete/);
  await expect(limits).toContainText(/GPS/);
});
