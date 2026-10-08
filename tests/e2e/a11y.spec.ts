import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openApp, tab } from './helpers';

/**
 * T18 — accessibilità. Test AUTOMATICI (axe-core, WCAG 2.2 A/AA) e controlli di tastiera/ARIA su Chromium.
 * Non sostituiscono la prova con VoiceOver/TalkBack su telefono né una valutazione da parte di persone con disabilità.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function axe(page: Page, label: string, opts: { exclude?: string[] } = {}) {
  let b = new AxeBuilder({ page }).withTags(TAGS);
  for (const e of opts.exclude ?? []) b = b.exclude(e);
  const { violations } = await b.analyze();
  const summary = violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} elementi — ${v.help}\n   ${v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' → ' + (n.failureSummary ?? '').split('\n').slice(1, 2).join(' ')).join('\n   ')}`).join('\n');
  expect(violations, `${label}: violazioni WCAG\n${summary}`).toEqual([]);
}

async function setTheme(page: Page, name: 'Automatico' | 'Chiaro' | 'Scuro' | 'Alto contrasto') {
  await tab(page, 'sicurezza');
  const fold = page.locator('details#sec-look');
  if (!(await fold.evaluate((d: HTMLDetailsElement) => d.open))) await fold.locator('summary').click();
  await fold.getByRole('button', { name, exact: true }).click();
}

async function openAllFolds(page: Page) {
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
}

for (const theme of ['Chiaro', 'Scuro', 'Alto contrasto'] as const) {
  test(`axe: tutte le sezioni, tema "${theme}"`, async ({ page }) => {
    await openApp(page);
    await setTheme(page, theme);
    for (const t of ['oggi', 'percorso', 'esplora', 'sicurezza'] as const) {
      await tab(page, t);
      if (t === 'sicurezza') await openAllFolds(page);
      await axe(page, `${t} / ${theme}`);
    }
    await tab(page, 'mappa');
    await expect(page.getByTestId('gl-map')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
    // il canvas WebGL non ha alternative interne: il contenuto equivalente è l'"Elenco punti" testuale
    await axe(page, `mappa / ${theme}`, { exclude: ['.maplibregl-canvas'] });
  });
}

test('axe: finestre di dialogo e dettagli (preparazione, navigazione, tappa, elenco punti, scheda POI)', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('primary-action').click();
  await axe(page, 'sheet Prepara il viaggio');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Programma completo e orario di partenza' }).click();
  await openAllFolds(page);
  await axe(page, 'Programma');
  await tab(page, 'percorso');
  await page.getByTestId('timeline').getByRole('button').nth(3).click();
  await axe(page, 'sheet tappa');
  await page.keyboard.press('Escape');
  await tab(page, 'mappa');
  await page.getByRole('button', { name: /Elenco punti/ }).click();
  await axe(page, 'Elenco punti');
});

test('tastiera: link "Vai al contenuto", ordine del focus, focus visibile, Esc chiude i dialoghi e restituisce il focus', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Vai al contenuto' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#main')).toBeFocused();

  // ogni elemento che riceve il focus mostra un indicatore visibile
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const cs = getComputedStyle(el);
      return { w: parseFloat(cs.outlineWidth), style: cs.outlineStyle, tag: el.tagName };
    });
    expect(outline.style, `elemento senza outline: ${outline.tag}`).not.toBe('none');
    expect(outline.w).toBeGreaterThanOrEqual(2);
  }

  // dialogo: il focus entra, resta intrappolato, Esc chiude e il focus torna al pulsante
  const trigger = page.getByTestId('primary-action');
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dlg = page.getByRole('dialog', { name: 'Prepara il viaggio' });
  await expect(dlg).toBeFocused();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await dlg.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('struttura: un solo main, nav con nome, intestazioni coerenti, lingua italiana, nessun ID duplicato', async ({ page }) => {
  await openApp(page);
  for (const t of ['oggi', 'mappa', 'percorso', 'esplora', 'sicurezza'] as const) {
    await tab(page, t);
    expect(await page.locator('main').count()).toBe(1);
    expect(await page.getByRole('navigation', { name: 'Sezioni dell’app' }).count()).toBe(1);
    expect(await page.getByRole('banner').count()).toBe(1);
    expect(await page.getByRole('heading', { level: 1 }).count(), `${t}: serve un titolo di primo livello`).toBeGreaterThanOrEqual(1);
    const dups = await page.evaluate(() => {
      const ids = Array.from(document.querySelectorAll('[id]')).map((e) => e.id);
      return ids.filter((id, i) => ids.indexOf(id) !== i);
    });
    expect(dups, `${t}: ID duplicati`).toEqual([]);
    // il tab corrente è indicato con aria-current
    await expect(page.getByTestId(`tab-${t}`)).toHaveAttribute('aria-current', 'page');
  }
});

test('movimento ridotto: nessuna transizione se il sistema lo chiede; informazioni mai affidate al solo colore', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openApp(page);
  const dur = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    return Math.max(0, ...all.map((e) => parseFloat(getComputedStyle(e).transitionDuration) || 0));
  });
  expect(dur).toBe(0);
  // gli stati di validazione hanno sempre testo oltre al colore
  await tab(page, 'percorso');
  const badges = page.locator('.badge');
  const n = await badges.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) expect((await badges.nth(i).innerText()).trim().length).toBeGreaterThan(2);
});

test('dimensione del testo "molto grande" (130 %) con font diversi: nessun overflow orizzontale su 320 px e barre di navigazione non tagliate', async ({ page }) => {
  // Il font di sistema cambia da macchina a macchina (sul runner di GitHub `system-ui` è più largo che sul mio ambiente): si provano più famiglie,
  // anche molto larghe, per non dipendere da quella disponibile. Se una famiglia manca il browser ripiega su un'altra: il test resta valido.
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 320, height: 568 });
  await openApp(page);
  await tab(page, 'sicurezza');
  await page.locator('details#sec-look summary').click();
  await page.getByRole('button', { name: 'Molto grande' }).click();
  const problems: string[] = [];
  for (const font of [null, 'DejaVu Sans', 'DejaVu Serif', 'DejaVu Sans Mono', 'Liberation Sans']) {
    await page.evaluate((f) => {
      if (f) document.documentElement.style.setProperty('--font', `"${f}", sans-serif`);
      else document.documentElement.style.removeProperty('--font');
    }, font);
    for (const t of ['oggi', 'percorso', 'esplora', 'sicurezza'] as const) {
      await tab(page, t);
      if (t === 'sicurezza') await openAllFolds(page);
      const r = await page.evaluate(() => {
        const doc = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        const bar = document.querySelector('.tabbar') as HTMLElement;
        const top = document.querySelector('.topbar') as HTMLElement;
        const labels = Array.from(bar.querySelectorAll('button')).filter((b) => b.scrollWidth > b.clientWidth + 0.5).map((b) => b.textContent);
        const vw = document.documentElement.clientWidth;
        const wide = Array.from(document.querySelectorAll<HTMLElement>('main *'))
          .filter((el) => !el.closest('.maplibregl-canvas') && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().right > vw + 0.5)
          .slice(0, 3)
          .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 24)} "${(el.textContent ?? '').trim().slice(0, 28)}"`);
        return { doc, tabbar: bar.scrollWidth - bar.clientWidth, topbar: top.scrollWidth - top.clientWidth, labels, wide };
      });
      if (r.doc > 0 || r.tabbar > 0 || r.topbar > 0 || r.labels.length) problems.push(`${font ?? 'font di sistema'} / ${t}: documento +${r.doc}px, barra schede +${r.tabbar}px, barra alta +${r.topbar}px, etichette tagliate [${r.labels.join(', ')}], elementi oltre il bordo [${r.wide.join(' | ')}]`);
    }
  }
  expect(problems, problems.join('\n')).toEqual([]);
});
