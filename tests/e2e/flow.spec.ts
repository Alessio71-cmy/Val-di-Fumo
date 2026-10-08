import { expect, test, type Page } from '@playwright/test';
import { openApp, parseClock, parseDistance, rawPoint, readStoredPrefs, routeLength, tab } from './helpers';

/** Test AUTOMATICI su Chromium: programma orario, fasi della giornata, via del ritorno, navigazione stradale. */

/** "+1 h 23" → 83; "−12 min (oltre il limite)" → −12 */
function parseSigned(text: string): number {
  const neg = /^[−-]/.test(text.trim());
  const h = /(\d+)\s*h/.exec(text);
  const m = /(\d+)\s*min/.exec(text) ?? /h\s*(\d{2})/.exec(text);
  const v = (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
  return neg ? -v : v;
}

async function openSchedule(page: Page) {
  await tab(page, 'oggi');
  await page.getByRole('button', { name: /Programma completo/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Programma' })).toBeVisible();
}

const dd = (page: Page, label: string) => page.locator('dt', { hasText: label }).locator('xpath=following-sibling::dd[1]');

async function readSchedule(page: Page) {
  return {
    dep: parseClock(await page.locator('#dep-value').innerText()),
    latest: parseClock(await page.getByTestId('latest-return').innerText()),
    arrival: parseClock(await dd(page, 'Arrivo al rifugio previsto').innerText()),
    returnStart: parseClock(await dd(page, 'Inizio ritorno previsto').innerText()),
    margin: parseSigned(await page.getByTestId('margin').innerText()),
    carDeadline: parseClock(await dd(page, 'Da essere all’auto entro').innerText()),
  };
}

test('T12: l’orario di partenza (07:00–08:00) aggiorna orari previsti, margine e resta coerente', async ({ page }) => {
  await openApp(page);
  await openSchedule(page);
  const slider = page.getByTestId('departure-slider');
  await expect(slider).toHaveAttribute('min', '420');
  await expect(slider).toHaveAttribute('max', '480');
  await expect(slider).toHaveValue('450');

  const at: Record<number, Awaited<ReturnType<typeof readSchedule>>> = {};
  for (const dep of [420, 450, 480]) {
    await slider.fill(String(dep));
    await expect(page.locator('#dep-value')).toHaveText(`${String(Math.floor(dep / 60)).padStart(2, '0')}:${String(dep % 60).padStart(2, '0')}`);
    at[dep] = await readSchedule(page);
  }
  const [a, b, c] = [at[420]!, at[450]!, at[480]!];
  // l'arrivo al rifugio e l'inizio ritorno scorrono insieme alla partenza
  expect(b.arrival - a.arrival).toBe(30);
  expect(c.arrival - b.arrival).toBe(30);
  expect(c.returnStart - a.returnStart).toBe(60);
  // l'ultimo orario prudenziale dipende dal tramonto, non dalla partenza
  expect(a.latest).toBe(b.latest);
  expect(b.latest).toBe(c.latest);
  // il margine si riduce di altrettanto
  expect(a.margin - b.margin).toBe(30);
  expect(b.margin - c.margin).toBe(30);
  // coerenza interna: margine = ora limite − inizio ritorno previsto
  for (const s of [a, b, c]) expect(s.margin).toBe(s.latest - s.returnStart);
  // la partenza non esce mai dalla finestra
  expect(a.dep).toBeGreaterThanOrEqual(420);
  expect(c.dep).toBeLessThanOrEqual(480);

  // la scelta persiste dopo la ricarica (IndexedDB)
  await slider.fill('420');
  await page.waitForTimeout(600);
  await page.reload();
  await openApp(page);
  await openSchedule(page);
  await expect(page.locator('#dep-value')).toHaveText('07:00');
});

test('ritmo del gruppo e sosta al Leno modificano il programma nel verso atteso', async ({ page }) => {
  await openApp(page);
  await openSchedule(page);
  const base = await readSchedule(page);
  await page.getByRole('button', { name: 'Lento' }).click();
  const slow = await readSchedule(page);
  await page.getByRole('button', { name: 'Veloce' }).click();
  const fast = await readSchedule(page);
  expect(slow.arrival).toBeGreaterThan(base.arrival);
  expect(fast.arrival).toBeLessThan(base.arrival);
  expect(slow.margin).toBeLessThan(base.margin);
  await page.getByRole('button', { name: 'Normale' }).click();
  await page.getByLabel('Salta la sosta alla Cascata del Leno').check();
  const noLeno = await readSchedule(page);
  expect(noLeno.arrival).toBeLessThan(base.arrival);
  expect(base.arrival - noLeno.arrival).toBeGreaterThanOrEqual(20);
});

test('margine tirato o negativo: compaiono i suggerimenti per accorciare, mai promesse', async ({ page }) => {
  await openApp(page);
  await openSchedule(page);
  await page.getByTestId('departure-slider').fill('480');
  await page.getByRole('button', { name: 'Lento' }).click();
  // forzo un programma critico con tempi di guida lunghi
  await page.locator('#drive-toBoazzo').fill('200');
  await page.locator('#drive-home').fill('200');
  const s = await readSchedule(page);
  expect(s.margin).toBeLessThan(30);
  await expect(page.getByTestId('suggestions')).toBeVisible();
  await expect(page.getByTestId('suggestions')).toContainText(/Accorcia|Riduci|Salta/);
  await expect(page.getByTestId('suggestions')).toContainText(/non garanzie/);
  await expect(page.getByTestId('latest-card')).toContainText(/tirato|Non compatibile/);
});

test('giorno dell’escursione: i ritardi reali ricalcolano ora limite e margine', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-09T08:45:00+02:00') });
  await openApp(page);
  await expect(page.locator('.chip', { hasText: 'Oggi' }).first()).toBeVisible();
  await openSchedule(page);
  const before = await readSchedule(page);
  await page.getByRole('button', { name: /← Oggi/ }).click();
  await page.getByTestId('advance').click(); // "Sono partito da Pergine" alle 08:45 (orologio simulato) invece che alle 07:30
  await openSchedule(page);
  const after = await readSchedule(page);
  await expect(page.getByText(/1 h 15 di ritardo/).first()).toBeVisible();
  expect(after.arrival - before.arrival).toBeGreaterThanOrEqual(70);
  expect(after.margin).toBeLessThan(before.margin - 60);
  expect(after.latest).toBe(before.latest);
});

test('T14: fasi della giornata, pulsante principale contestuale e via del ritorno', async ({ page }) => {
  await openApp(page);
  const primary = page.getByTestId('primary-action');
  const label = page.getByTestId('phase-label');
  const expected: Array<[string, string]> = [
    ['Prima della partenza', 'Prepara il viaggio'],
    ['In auto verso Boazzo', 'Apri navigazione stradale'],
    ['Cascata del Leno', 'Visualizza percorso'],
    ['In auto verso la diga', 'Apri navigazione stradale'],
    ['Preparazione al trekking', 'Visualizza percorso'],
    ['Trekking: andata', 'Visualizza percorso'],
    ['Al rifugio', 'Valuta il ritorno'],
    ['Ritorno a piedi', 'Torna al parcheggio'],
    ['Rientro in auto', 'Apri navigazione stradale'],
  ];
  for (let i = 0; i < expected.length; i++) {
    const [ph, btn] = expected[i] as [string, string];
    await expect(label).toHaveText(ph);
    await expect(primary).toContainText(btn);
    if (i < expected.length - 1) await page.getByTestId('advance').click();
  }
  // annulla l'ultimo passaggio → torna al ritorno a piedi
  await page.getByRole('button', { name: 'Annulla l’ultimo passaggio' }).click();
  await expect(label).toHaveText('Ritorno a piedi');

  // "Torna al parcheggio" apre la Mappa sul ritorno
  await primary.click();
  await expect(page.getByTestId('map-screen')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ritorno' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#hud-left')).toContainText(new RegExp(`${(routeLength() / 1000).toFixed(2).replace('.', ',')} km`));
  await page.getByRole('button', { name: /Elenco punti/ }).click();
  const items = page.getByTestId('wp-list').locator('li');
  await expect(items.first()).toContainText('Rifugio');
  await expect(items.last()).toContainText(/parcheggio|Parcheggio/);
  // le distanze del ritorno partono da 0 al rifugio e finiscono alla lunghezza totale
  const lastDist = parseDistance(await items.last().innerText());
  expect(Math.abs(lastDist - routeLength())).toBeLessThan(5);
});

test('navigazione stradale: link con le coordinate verificate dei dati, avvertenze sul parcheggio', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('advance').click(); // verso Boazzo
  await page.getByTestId('primary-action').click();
  const dlg = page.getByRole('dialog', { name: 'Apri navigazione stradale' });
  await expect(dlg).toBeVisible();
  const p = rawPoint('park-boazzo-centrale');
  const g = await dlg.getByRole('link', { name: /Google Maps/ }).getAttribute('href');
  expect(g).toContain(`destination=${p.lat.toFixed(6)},${p.lon.toFixed(6)}`);
  const a = await dlg.getByRole('link', { name: /Apple Maps/ }).getAttribute('href');
  expect(a).toContain(`daddr=${p.lat.toFixed(6)},${p.lon.toFixed(6)}`);
  await expect(dlg).toContainText('divieto');
  await expect(dlg).toContainText('stime');
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
  // vincoli di sicurezza dei link esterni
  await page.getByTestId('primary-action').click();
  for (const l of await page.getByRole('dialog').getByRole('link', { name: /Google|Apple/ }).all()) {
    expect(await l.getAttribute('rel')).toContain('noopener');
  }
});

test('esito della verifica sul rifugio: lo stato è dichiarato dall’utente e persiste', async ({ page }) => {
  await openApp(page);
  const card = page.getByTestId('hut-card');
  await expect(card).toContainText('apertura da confermare');
  await expect(card).toContainText('Non fare affidamento sul rifugio');
  await card.getByRole('button', { name: 'Aperto' }).click();
  await expect(card).toContainText('confermato aperto');
  await expect(card).toContainText('porta pranzo, acqua e strati'); // anche se aperto, nessuna promessa di servizi
  await page.waitForTimeout(600);
  await page.reload();
  await openApp(page);
  await expect(page.getByTestId('hut-card')).toContainText('confermato aperto');
});

test('durante il trekking la Mappa mostra sempre l’ultimo orario prudenziale per iniziare il ritorno; al ritorno l’ora limite all’auto', async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId('hud-strip')).toHaveCount(0); // prima del trekking non serve
  await openSchedule(page);
  const latest = (await page.getByTestId('latest-return').innerText()).trim();
  await page.getByRole('button', { name: /← Oggi/ }).click();
  for (let i = 0; i < 5; i++) await page.getByTestId('advance').click(); // fino a "Trekking: andata"
  await expect(page.getByTestId('phase-label')).toHaveText('Trekking: andata');
  await tab(page, 'mappa');
  await expect(page.getByTestId('hud-strip')).toContainText(`Ritorno entro ${latest}`);
  await expect(page.getByTestId('hud-strip')).toContainText(/margine/);
  await tab(page, 'oggi');
  await page.getByTestId('advance').click(); // sono al rifugio
  await page.getByTestId('advance').click(); // inizio il ritorno
  await expect(page.getByTestId('phase-label')).toHaveText('Ritorno a piedi');
  await tab(page, 'mappa');
  await expect(page.getByTestId('hud-strip')).toContainText(/All’auto entro \d\d:\d\d · tramonto \d\d:\d\d/);
});

test('un orario appena registrato non va perso: salvataggio immediato quando la pagina viene nascosta', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('advance').click(); // registra "Sono partito da Pergine"
  // simula il passaggio in secondo piano/chiusura IMMEDIATAMENTE (prima dei 250 ms del salvataggio ritardato)
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect
    .poll(async () => ((await readStoredPrefs(page))?.actuals as Record<string, number> | undefined)?.departed ?? null, { timeout: 3000 })
    .toBeGreaterThan(0);
  expect((await readStoredPrefs(page))?.phase).toBe('drive-out');
});
