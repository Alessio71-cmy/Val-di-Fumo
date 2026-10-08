import { expect, test, type Page } from '@playwright/test';
import { offset, openApp, parseDistance, pointAtChain, rawPoint, readStoredPrefs, routeLength, setGeo, tab } from './helpers';

/**
 * SIMULAZIONI su Chromium con geolocalizzazione emulata (BrowserContext.setGeolocation / permessi / override di navigator.geolocation).
 * Provano la logica dell'app (consenso, errori, soglie, avvisi). Non provano il ricevitore GPS di un telefono, né il
 * comportamento di iOS con lo schermo bloccato: vedi docs/TEST-REPORT.md.
 */
test.use({ permissions: [] });

const injectCounter = () => {
  const w = window as unknown as { __geoCalls: number };
  w.__geoCalls = 0;
  const g = navigator.geolocation as unknown as Record<string, (...a: unknown[]) => unknown> | undefined;
  if (!g) return;
  for (const k of ['watchPosition', 'getCurrentPosition']) {
    const orig = (g[k] as (...a: unknown[]) => unknown).bind(navigator.geolocation);
    g[k] = (...args: unknown[]) => {
      w.__geoCalls++;
      return orig(...args);
    };
  }
};

const geoCalls = (page: Page) => page.evaluate(() => (window as unknown as { __geoCalls: number }).__geoCalls);

async function goMap(page: Page) {
  await tab(page, 'mappa');
  await expect(page.getByTestId('map-screen')).toBeVisible();
}

test('nessuna lettura della posizione prima del consenso esplicito', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']); // il permesso del browser c'è, ma l'app NON deve usarlo senza un gesto dell'utente
  await setGeo(context, pointAtChain(500), 10);
  await page.addInitScript(injectCounter);
  await openApp(page);
  for (const t of ['mappa', 'percorso', 'esplora', 'sicurezza', 'oggi'] as const) {
    await tab(page, t);
    await page.waitForTimeout(300);
  }
  expect(await geoCalls(page), 'la geolocalizzazione è stata interrogata senza consenso').toBe(0);
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
  // nessuna posizione salvata prima del consenso
  const before = await readStoredPrefs(page);
  expect(before === null || before.lastPosition === null || before.lastPosition === undefined).toBe(true);

  await goMap(page);
  await expect(page.locator('#hud-where')).toContainText('GPS spento');
  await page.getByTestId('gps-toggle').click();
  await expect.poll(() => geoCalls(page)).toBeGreaterThan(0);
  await expect(page.locator('#hud-where')).toContainText(/Sulla traccia|dalla traccia/, { timeout: 20_000 });
  await tab(page, 'oggi'); // il GPS resta attivo cambiando scheda e lo stato compare nella barra superiore
  await expect(page.getByTestId('chip-gps')).toContainText(/±\d+ m/);

  // dopo il consenso l'ultima posizione nota viene salvata SOLO sul dispositivo (IndexedDB), e si può cancellare
  await expect
    .poll(async () => ((await readStoredPrefs(page))?.lastPosition as { lat: number } | null | undefined)?.lat ?? null, { timeout: 10_000 })
    .toBeCloseTo(pointAtChain(500).lat, 4);
  await tab(page, 'sicurezza');
  await page.getByText('Stato GPS e posizione').click();
  await expect(page.getByTestId('gps-last')).toContainText('±');
  await page.getByRole('button', { name: /Cancella posizione, orari e preferenze/ }).click();
  await expect.poll(async () => (await readStoredPrefs(page))?.lastPosition ?? null).toBeNull();
});

test('permesso negato: messaggio chiaro, nessuna posizione inventata, app utilizzabile', async ({ page }) => {
  await openApp(page);
  await goMap(page);
  await page.getByTestId('gps-toggle').click();
  const alert = page.getByRole('alert').filter({ hasText: 'Permesso di posizione negato' });
  await expect(alert).toBeVisible({ timeout: 15_000 });
  await expect(alert).toContainText('Consenti');
  await expect(page.locator('#hud-where')).toContainText('GPS non attivo');
  // distanza residua = lunghezza totale (nessuna stima di posizione)
  await expect(page.locator('#hud-left')).toContainText('lunghezza totale');
  await expect(page.locator('.user-dot')).toHaveCount(0);
  // il resto dell'app funziona e la barra superiore riporta lo stato
  await tab(page, 'oggi');
  await expect(page.getByTestId('chip-gps')).toContainText('non attivo');
  await tab(page, 'percorso');
  await expect(page.getByTestId('timeline')).toBeVisible();
});

test('GPS non disponibile (POSITION_UNAVAILABLE): avviso, nessun dato fittizio', async ({ page }) => {
  await page.addInitScript(() => {
    const err = { code: 2, message: 'unavailable', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };
    (navigator.geolocation as unknown as { watchPosition: unknown }).watchPosition = (_ok: unknown, bad?: (e: unknown) => void) => {
      setTimeout(() => bad?.(err), 50);
      return 7;
    };
  });
  await openApp(page);
  await goMap(page);
  await page.getByTestId('gps-toggle').click();
  const alert = page.getByRole('alert').filter({ hasText: 'Posizione non disponibile' });
  await expect(alert).toBeVisible({ timeout: 10_000 });
  await expect(alert).toContainText('all’aperto');
  await expect(page.locator('#hud-where')).toContainText('GPS non attivo');
  await expect(page.locator('.user-dot')).toHaveCount(0);
});

test('timeout del GPS (nessun primo segnale): avviso di attesa, nessun dato fittizio', async ({ page }) => {
  await page.addInitScript(() => {
    const err = { code: 3, message: 'timeout', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };
    (navigator.geolocation as unknown as { watchPosition: unknown }).watchPosition = (_ok: unknown, bad?: (e: unknown) => void) => {
      setTimeout(() => bad?.(err), 50);
      return 8;
    };
  });
  await openApp(page);
  await goMap(page);
  await page.getByTestId('gps-toggle').click();
  await expect(page.getByTestId('gps-warning')).toContainText('Ancora nessun segnale GPS', { timeout: 10_000 });
  await expect(page.locator('#hud-where')).toContainText('In attesa');
  await expect(page.locator('.user-dot')).toHaveCount(0);
});

test('geolocalizzazione assente nel browser: messaggio dedicato', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true });
  });
  await openApp(page);
  await goMap(page);
  await page.getByTestId('gps-toggle').click();
  await expect(page.getByRole('alert').filter({ hasText: 'non offre la geolocalizzazione' })).toBeVisible();
});

test('precisione scarsa: distanza e avvisi sospesi, nessun falso "fuori percorso"', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  const far = offset(pointAtChain(1500), pointAtChain(1500).bearing + 90, 250);
  await setGeo(context, far, 160); // ±160 m: oltre la soglia di affidabilità
  await openApp(page);
  await goMap(page);
  await page.getByTestId('gps-toggle').click();
  await expect(page.getByTestId('gps-poor')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('gps-poor')).toContainText(/imprecisa|scarsa|sospes/);
  await expect(page.locator('#hud-where')).toContainText('imprecisa');
  await expect(page.locator('#hud-left')).toContainText('lunghezza totale'); // niente progresso da una posizione inaffidabile
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('off-route')).toHaveCount(0);
});

test('posizione obsoleta (oltre 120 s senza aggiornamenti): progresso e avvisi sospesi', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await page.clock.install({ time: new Date() });
  await setGeo(context, pointAtChain(2000), 6);
  await openApp(page);
  await goMap(page);
  await page.getByTestId('gps-toggle').click();
  await expect(page.locator('#hud-where')).toContainText(/Sulla traccia|dalla traccia/, { timeout: 20_000 });
  await page.clock.fastForward('03:00'); // tre minuti senza nuovi fix
  await expect(page.getByTestId('gps-poor')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('gps-poor')).toContainText(/non aggiornata|Obsoleta|obsoleta/i);
  await expect(page.locator('#hud-where')).toContainText('obsoleta');
  await expect(page.locator('#hud-left')).toContainText('lunghezza totale');
});

test('fuori percorso: avviso sobrio solo con fix preciso e persistente; sparisce al rientro; disattivabile', async ({ page, context }) => {
  test.setTimeout(150_000);
  await context.grantPermissions(['geolocation']);
  const base = pointAtChain(1500);
  const on = (i: number) => ({ lat: base.lat + i * 1e-6, lon: base.lon });
  const off = (i: number) => {
    const p = offset(base, base.bearing + 90, 200);
    return { lat: p.lat + i * 1e-6, lon: p.lon };
  };

  await setGeo(context, on(0), 8);
  await openApp(page);
  await goMap(page);
  await page.getByTestId('gps-toggle').click();
  await expect(page.locator('#hud-where')).toContainText('Sulla traccia', { timeout: 20_000 });

  // 200 m fuori dalla traccia, precisione ±8 m: un singolo fix NON basta
  await setGeo(context, off(0), 8);
  await expect(page.locator('#hud-where')).toContainText(/\d+ m dalla traccia/, { timeout: 15_000 });
  const d = parseDistance(await page.locator('#hud-where .v').innerText());
  expect(d).toBeGreaterThan(150);
  expect(d).toBeLessThan(260);
  await expect(page.getByTestId('off-route')).toHaveCount(0);

  // altri fix per oltre 30 s
  for (let i = 1; i <= 3; i++) {
    await page.waitForTimeout(11_500);
    await setGeo(context, off(i), 8);
  }
  const banner = page.getByTestId('off-route');
  await expect(banner).toBeVisible({ timeout: 15_000 });
  await expect(banner).toContainText('Possibile allontanamento');
  await expect(banner).toContainText('Nessun allarme');
  await expect(banner).toContainText('OpenStreetMap'); // dichiara che la traccia può differire dal sentiero reale
  expect(await banner.getAttribute('role')).toBe('status'); // non invasivo: nessun role=alert

  // rientro sulla traccia
  await setGeo(context, on(1), 8);
  await page.waitForTimeout(1200);
  await setGeo(context, on(2), 8);
  await expect(page.getByTestId('off-route')).toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator('#hud-where')).toContainText('Sulla traccia');

  // disattivando gli avvisi il banner non compare più
  await tab(page, 'sicurezza');
  await page.getByText('Stato GPS e posizione').click();
  await page.getByLabel(/Avviso di possibile allontanamento/).uncheck();
  await tab(page, 'mappa');
  await setGeo(context, off(5), 8);
  await expect(page.locator('#hud-where')).toContainText(/dalla traccia/, { timeout: 15_000 });
  await page.waitForTimeout(500);
  await expect(page.getByTestId('off-route')).toHaveCount(0);
});

test('distanze lungo il GPX in vari punti del percorso (confronto con i dati della pipeline)', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await setGeo(context, pointAtChain(200), 6);
  await openApp(page);
  await goMap(page);
  await page.getByTestId('gps-toggle').click();
  await expect(page.locator('#hud-where')).toContainText('Sulla traccia', { timeout: 20_000 });

  const total = routeLength();
  const breguzzo = rawPoint('malga-breguzzo').chainOut;
  for (const chain of [200, 1200, 2600, 3300, 3700, 4800, 5900]) {
    await setGeo(context, pointAtChain(chain), 6);
    await expect
      .poll(async () => Math.abs(parseDistance(await page.locator('#hud-left .v').innerText()) - (total - chain)), { timeout: 15_000, message: `residuo a ${chain} m` })
      .toBeLessThan(35);
    // il "prossimo punto" è il primo waypoint oltre la posizione, con distanza LUNGO la traccia
    const nextText = await page.locator('#hud-next').innerText();
    if (chain < breguzzo - 15) {
      expect(nextText).toContain('Malga Breguzzo');
      expect(Math.abs(parseDistance(await page.locator('#hud-next .s').innerText()) - (breguzzo - chain))).toBeLessThan(35);
    }
  }
  // all'arrivo
  await setGeo(context, pointAtChain(total), 6);
  await expect.poll(async () => parseDistance(await page.locator('#hud-left .v').innerText()), { timeout: 15_000 }).toBeLessThan(35);
});
