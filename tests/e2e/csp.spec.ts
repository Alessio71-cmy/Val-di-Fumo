import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { prepareTrip, serveDir, tab, waitForSwControl } from './helpers';

/**
 * Politica di sicurezza dei contenuti (CSP) consigliata in public/_headers, applicata davvero da un server di prova:
 * dimostra che l'app non ha dipendenze online nascoste (script, stili, font, immagini, connessioni) oltre al meteo.
 */
function cspFromHeadersFile(): string {
  const txt = fs.readFileSync(path.resolve('public/_headers'), 'utf8');
  const m = /Content-Security-Policy:\s*(.+)/.exec(txt);
  if (!m) throw new Error('CSP non trovata in public/_headers');
  // CSP_NEGATIVE=1: controprova (toglie blob: dalle immagini) per verificare che il test sappia rilevare una violazione
  const csp = (m[1] as string).trim();
  return process.env.CSP_NEGATIVE ? csp.replace("img-src 'self' blob: data:", "img-src 'self'") : csp;
}

test('con la CSP restrittiva l’app funziona per intero (mappa WebGL, download offline, GPS) e non viola alcuna regola', async ({ browser }) => {
  test.setTimeout(120_000);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vdf-csp-'));
  fs.cpSync(path.resolve('dist'), tmp, { recursive: true });
  const srv = await serveDir(tmp, { 'Content-Security-Policy': cspFromHeadersFile(), 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  const ctx = await browser.newContext({ baseURL: srv.url, serviceWorkers: 'allow', permissions: ['geolocation'], geolocation: { latitude: 46.0521, longitude: 10.5134, accuracy: 8 } });
  const page = await ctx.newPage();
  const violations: string[] = [];
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.log(`CSPVIOLATION ${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  page.on('console', (m) => {
    if (m.text().startsWith('CSPVIOLATION')) violations.push(m.text());
    if (/Content Security Policy|violates the following/i.test(m.text())) violations.push(m.text());
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(srv.url);
    await expect(page.getByTestId('primary-action')).toBeVisible();
    await waitForSwControl(page);
    await prepareTrip(page);
    await tab(page, 'mappa');
    await expect(page.getByTestId('gl-map')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
    await page.getByTestId('gps-toggle').click();
    await expect(page.locator('.user-dot')).toBeVisible({ timeout: 20_000 });
    for (const t of ['percorso', 'esplora', 'sicurezza', 'oggi'] as const) await tab(page, t);
    await page.getByRole('button', { name: /Programma completo/ }).click();
    await expect(page.getByTestId('latest-return')).toBeVisible();
    expect(violations, violations.join('\n')).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await ctx.close();
    await srv.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
