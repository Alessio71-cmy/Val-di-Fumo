import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { openApp, tab } from './helpers';

/**
 * T17 — leggibilità su schermi piccoli. Test AUTOMATICI su Chromium con viewport emulati: misurano overflow, dimensione dei bersagli
 * di tocco e del testo. Non sostituiscono la prova su telefoni reali (resa dei font, luce solare, guanti, dita bagnate).
 */
const SIZES = [
  { name: 'iPhone SE (320×568)', width: 320, height: 568 },
  { name: 'Android piccolo (360×640)', width: 360, height: 640 },
  { name: 'iPhone 8 (375×667)', width: 375, height: 667 },
  { name: 'iPhone 14 (390×844)', width: 390, height: 844 },
  { name: 'telefono in orizzontale (667×375)', width: 667, height: 375 },
] as const;

const SHOTS = path.resolve('test-results', 'screens');

async function audit(page: Page, label: string) {
  return page.evaluate((lbl) => {
    const problems: string[] = [];
    const vw = document.documentElement.clientWidth;
    const over = document.documentElement.scrollWidth - vw;
    if (over > 0) problems.push(`${lbl}: overflow orizzontale di ${over}px`);
    // bersagli di tocco
    const sel = 'button, a[href], summary, select, input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea';
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (el.classList.contains('skip-link')) continue;
      if (el.tagName === 'A' && cs.display === 'inline') continue; // collegamenti dentro un paragrafo
      const marker = el.classList.contains('wp');
      const min = marker ? 28 : 44; // i marker della mappa hanno un'area di tocco estesa di 9 px per lato (::after)
      if (r.width < min - 0.5 || r.height < min - 0.5) problems.push(`${lbl}: bersaglio ${Math.round(r.width)}×${Math.round(r.height)} < ${min}: ${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`);
    }
    // dimensione minima del testo
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const small = new Set<string>();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = (n.textContent ?? '').trim();
      const parent = n.parentElement;
      if (!t || !parent) continue;
      const cs = getComputedStyle(parent);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = parent.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (parseFloat(cs.fontSize) < 11) small.add(`${parseFloat(cs.fontSize).toFixed(1)}px "${t.slice(0, 30)}"`);
    }
    for (const s of small) problems.push(`${lbl}: testo troppo piccolo ${s}`);
    // testi troncati (puntini di sospensione) = informazione persa
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('.title, h1, h2, h3, .btn, .chip'))) {
      if (!el.closest('.sr-only') && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible') problems.push(`${lbl}: testo troncato in <${el.tagName.toLowerCase()}> "${(el.textContent || '').trim().slice(0, 40)}"`);
    }
    return problems;
  }, label);
}

for (const size of SIZES) {
  test(`${size.name}: nessun overflow, bersagli ≥ 44 px, testo ≥ 11 px, niente testo troncato`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await openApp(page);
    fs.mkdirSync(SHOTS, { recursive: true });
    const all: string[] = [];
    for (const t of ['oggi', 'mappa', 'percorso', 'esplora', 'sicurezza'] as const) {
      await tab(page, t);
      if (t === 'mappa') await expect(page.getByTestId('gl-map')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
      if (t === 'sicurezza') await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
      await page.waitForTimeout(150);
      all.push(...(await audit(page, `${size.name} / ${t}`)));
      await page.screenshot({ path: path.join(SHOTS, `${size.width}x${size.height}-${t}.png`), fullPage: false });
    }
    expect(all, all.join('\n')).toEqual([]);
  });
}

test('320×568: l’azione principale di "Oggi" è visibile senza scorrere e i tre indicatori della mappa non si sovrappongono', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openApp(page);
  const box = await page.getByTestId('primary-action').boundingBox();
  const tab0 = await page.locator('.tabbar').boundingBox();
  expect(box).not.toBeNull();
  expect((box as { y: number; height: number }).y + (box as { height: number }).height).toBeLessThanOrEqual((tab0 as { y: number }).y);
  await tab(page, 'mappa');
  const hud = await Promise.all(['#hud-where', '#hud-next', '#hud-left'].map((s) => page.locator(s).boundingBox()));
  for (let i = 0; i < hud.length - 1; i++) {
    const a = hud[i] as { x: number; width: number };
    const b = hud[i + 1] as { x: number };
    expect(a.x + a.width).toBeLessThanOrEqual(b.x + 0.5);
  }
  // il pulsante GPS e le scorciatoie della mappa non sono coperti dalla barra delle schede
  const gps = await page.getByTestId('gps-toggle').boundingBox();
  expect((gps as { y: number; height: number }).y + (gps as { height: number }).height).toBeLessThanOrEqual((tab0 as { y: number }).y);
});
