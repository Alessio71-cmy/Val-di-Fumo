import { expect, test, type Page } from '@playwright/test';
import { openApp, pointAtChain, setGeo, tab } from './helpers';

/**
 * SIMULAZIONI su Chromium: gli eventi di orientamento sono SINTETICI (nessun sensore reale, nessun iPhone). Provano la logica
 * dell'app (permesso a richiesta, lettura dei due formati, freccia che ruota, messaggi). Non provano la precisione del
 * magnetometro di un telefono né il comportamento di iOS: vedi docs/TEST-REPORT.md.
 */
test.use({ permissions: ['geolocation'] });

async function mapWithFix(page: Page, ctx: Parameters<typeof setGeo>[0]) {
  await setGeo(ctx, pointAtChain(500), 8);
  await openApp(page);
  await tab(page, 'mappa');
  await page.getByTestId('gps-toggle').click();
  await expect(page.locator('#hud-where')).toContainText(/Sulla traccia|dalla traccia/, { timeout: 20_000 });
}

const androidEvent = (page: Page, alpha: number) =>
  page.evaluate((a) => window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha: a, beta: 90, gamma: 0, absolute: true })), alpha);
const iosEvent = (page: Page, h: number) =>
  page.evaluate((v) => window.dispatchEvent(Object.assign(new Event('deviceorientation'), { webkitCompassHeading: v, alpha: 0, beta: 90, gamma: 0 })), h);

test('selettori in ordine Leno → Andata → Ritorno; la variante sull’altra sponda non compare finché non serve', async ({ page }) => {
  await openApp(page);
  await tab(page, 'mappa');
  const chips = page.getByRole('group', { name: 'Percorso mostrato' }).getByRole('button');
  await expect(chips.nth(0)).toHaveText('Leno');
  await expect(chips.nth(1)).toHaveText('Andata');
  await expect(chips.nth(2)).toHaveText('Ritorno');
  await expect(page.getByRole('button', { name: 'Sponda opposta' })).toHaveCount(0);
});

test('bussola spenta di default; accesa a richiesta la freccia ruota verso dove punta il telefono (Android: angoli assoluti)', async ({ page, context }) => {
  await mapWithFix(page, context);
  const dot = page.locator('.user-dot');
  await expect(dot).not.toHaveClass(/has-heading/);
  await page.getByTestId('compass-toggle').click();
  await expect(page.getByTestId('compass-toggle')).toHaveAttribute('aria-pressed', 'true');
  await androidEvent(page, 0); // in piedi, rivolto a nord
  await expect(dot).toHaveAttribute('data-heading', '0');
  await expect(dot).toHaveAttribute('aria-label', /nord/);
  await androidEvent(page, 90); // alpha antiorario: 90 = ovest
  await expect.poll(async () => Number(await dot.getAttribute('data-heading')), { timeout: 8000 }).toBeGreaterThan(300); // la media mobile arriva per gradi
  for (let i = 0; i < 30; i++) {
    await androidEvent(page, 90);
    await page.waitForTimeout(110);
  }
  await expect(dot).toHaveAttribute('data-heading', '270');
  await expect(dot).toHaveAttribute('aria-label', /ovest/);
  // la freccia è disegnata davvero (non solo l'attributo)
  const cone = await page.locator('.user-dot .user-heading').evaluate((el) => ({ display: getComputedStyle(el).display, transform: getComputedStyle(el).transform }));
  expect(cone.display).toBe('block');
  expect(cone.transform).not.toBe('none');
  // spegnendo la bussola la freccia sparisce e resta il punto di posizione
  await page.getByTestId('compass-toggle').click();
  await expect(dot).not.toHaveClass(/has-heading/);
  await expect(dot).toHaveAttribute('aria-label', 'La tua posizione');
});

test('iPhone (simulato): permesso chiesto solo al tocco; con "consenti" legge la direzione di iOS', async ({ page, context }) => {
  await page.addInitScript(() => {
    (window as unknown as { __perm: number }).__perm = 0;
    (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission = async () => {
      (window as unknown as { __perm: number }).__perm++;
      return 'granted';
    };
  });
  await mapWithFix(page, context);
  expect(await page.evaluate(() => (window as unknown as { __perm: number }).__perm), 'permesso chiesto senza tocco').toBe(0);
  await page.getByTestId('compass-toggle').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __perm: number }).__perm)).toBe(1);
  await iosEvent(page, 135);
  await expect(page.locator('.user-dot')).toHaveAttribute('data-heading', '135');
  await expect(page.locator('.user-dot')).toHaveAttribute('aria-label', /sud-est/);
});

test('iPhone (simulato): permesso negato → messaggio chiaro, nessuna freccia, la posizione resta', async ({ page, context }) => {
  await page.addInitScript(() => {
    (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission = async () => 'denied';
  });
  await mapWithFix(page, context);
  await page.getByTestId('compass-toggle').click();
  await expect(page.getByTestId('compass-denied')).toBeVisible();
  await expect(page.getByTestId('compass-toggle')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.user-dot')).not.toHaveClass(/has-heading/);
  await expect(page.locator('#hud-where')).toContainText(/Sulla traccia|dalla traccia/);
});

test('nessun dato dal sensore (es. computer o browser senza bussola): messaggio dopo pochi secondi, nessuna direzione inventata', async ({ page, context }) => {
  await mapWithFix(page, context);
  await page.getByTestId('compass-toggle').click();
  await androidEvent(page, 0).catch(() => {});
  // un evento con angoli relativi (senza riferimento al nord) non vale come direzione
  await page.evaluate(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 40, beta: 90, gamma: 0, absolute: false })));
  await expect(page.locator('.user-dot')).toHaveAttribute('data-heading', '0');
  // ripartiamo da spenta e senza alcun evento
  await page.getByTestId('compass-toggle').click();
  await page.getByTestId('compass-toggle').click();
  await expect(page.getByTestId('compass-unsupported')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('.user-dot')).not.toHaveClass(/has-heading/);
});

test('mappa schematica (senza WebGL): la freccia di direzione compare e ruota', async ({ page, context }) => {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (/webgl/i.test(type)) return null;
      return (orig as (...a: unknown[]) => unknown).call(this, type, ...rest) as never;
    } as typeof orig;
  });
  await mapWithFix(page, context);
  await expect(page.getByTestId('map-screen')).toHaveAttribute('data-mode', 'svg');
  await expect(page.getByTestId('heading-cone')).toHaveCount(0);
  await page.getByTestId('compass-toggle').click();
  for (let i = 0; i < 3; i++) {
    await iosEvent(page, 90);
    await page.waitForTimeout(120);
  }
  await expect(page.getByTestId('heading-cone')).toHaveAttribute('transform', /^rotate\(90 /);
});
