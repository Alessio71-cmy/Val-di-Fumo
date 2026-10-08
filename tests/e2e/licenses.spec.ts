import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { openApp, openFold, tab } from './helpers';

/**
 * T16 — controllo delle licenze cartografiche. Verifiche AUTOMATICHE su attribuzioni mostrate, origine dei dati e assenza di
 * tile server di terzi. Non sono una consulenza legale: vedi docs/SOURCES.md e docs/KNOWN-LIMITS.md.
 */

const dist = path.resolve('dist');

test('attribuzioni visibili: mappa e schermata "Fonti, licenze e attribuzioni"', async ({ page }) => {
  await openApp(page);
  await tab(page, 'mappa');
  const attrib = page.locator('.map-attrib');
  await expect(attrib).toContainText('OpenStreetMap contributors');
  await expect(attrib).toContainText('ODbL');
  await expect(attrib).toContainText('EU-DEM');
  await tab(page, 'sicurezza');
  await openFold(page, 'sec-sources');
  const body = page.locator('details#sec-sources');
  for (const t of ['OpenStreetMap contributors', 'ODbL 1.0', 'Overture Maps', 'Copernicus', 'EU-DEM', 'MapLibre', 'BSD-3-Clause', 'Open-Meteo', 'CC BY 4.0']) {
    await expect(body, `manca "${t}"`).toContainText(t);
  }
  // le fonti iniziali bloccate sono dichiarate come NON consultate
  await expect(body).toContainText('NON consultata');
});

test('le tracce GPX (statiche ed esportate) riportano autore OSM e licenza ODbL e dichiarano di non essere verificate sul campo', async ({ page }) => {
  const dir = path.resolve('public/data/gpx');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.gpx'));
  expect(files.length).toBeGreaterThanOrEqual(4);
  for (const f of files) {
    const xml = fs.readFileSync(path.join(dir, f), 'utf8');
    expect(xml, f).toContain('<copyright author="OpenStreetMap contributors">');
    expect(xml, f).toContain('https://opendatacommons.org/licenses/odbl/1-0/');
    expect(xml, f).toMatch(/non rilevata sul campo|non verificat/i);
    expect(xml, f).not.toMatch(/<trkpt[^>]*>\s*<\/trkpt>/);
  }
  // esportazione dall'app
  await openApp(page);
  await tab(page, 'sicurezza');
  await openFold(page, 'sec-track');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Scarica GPX: Andata (diga → rifugio)' }).click()]);
  expect(dl.suggestedFilename()).toBe('andata-diga-rifugio.gpx');
  const xml = fs.readFileSync((await dl.path()) as string, 'utf8');
  expect(xml).toContain('<gpx');
  expect(xml).toContain('OpenStreetMap');
  expect(xml).toMatch(/ODbL|odbl/);
  const pts = (xml.match(/<trkpt /g) ?? []).length;
  const ref = fs.readFileSync(path.join(dir, 'andata-diga-rifugio.gpx'), 'utf8');
  expect(pts).toBe((ref.match(/<trkpt /g) ?? []).length);
});

test('nessun tile server né servizio cartografico di terzi: tutte le richieste restano sull’origine (meteo escluso, bloccato nel test)', async ({ page }) => {
  const hosts = new Set<string>();
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.protocol === 'http:' || u.protocol === 'https:') hosts.add(u.host);
  });
  await openApp(page);
  for (const t of ['mappa', 'percorso', 'esplora', 'sicurezza', 'oggi'] as const) {
    await tab(page, t);
    if (t === 'mappa') await expect(page.getByTestId('gl-map')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
  }
  await page.waitForTimeout(500);
  const external = [...hosts].filter((h) => h !== '127.0.0.1:4173');
  expect(external, 'host contattati').toEqual(['api.open-meteo.com']); // unica richiesta esterna: previsioni, facoltativa
});

test('il codice pubblicato non contiene indirizzi di tile server o servizi di mappe a pagamento', async () => {
  const js = fs.readdirSync(path.join(dist, 'assets')).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(dist, 'assets', f), 'utf8')).join('\n');
  for (const bad of ['tile.openstreetmap', 'tiles.openstreetmap', 'api.mapbox.com', 'api.maptiler.com', 'basemaps.cartocdn', 'stadiamaps', 'thunderforest', 'tile.opentopomap', '{z}/{x}/{y}', 'googleapis.com/maps', 'maps.googleapis']) {
    expect(js.includes(bad), `trovato "${bad}" nel codice pubblicato`).toBe(false);
  }
  // elenco chiuso dei domini citati nel codice: namespace XML, librerie, fonti consultabili con un clic, app di mappe esterne
  const sources = JSON.parse(fs.readFileSync(path.resolve('src/content/sources.json'), 'utf8')) as Array<{ url?: string }> | { sources: Array<{ url?: string }> };
  const list = Array.isArray(sources) ? sources : sources.sources;
  const sourceHosts = new Set(list.map((s) => (s.url ? new URL(s.url).host : '')).filter(Boolean));
  const allowed = new Set(['www.w3.org', 'www.topografix.com', 'maplibre.org', 'reactjs.org', 'api.open-meteo.com', 'open-meteo.com', 'www.google.com', 'maps.apple.com', 'opendatacommons.org', 'overturemaps.org', 'registry.opendata.aws', 'github.com', 'pypi.org', 'localhost', ...sourceHosts]);
  const found = new Set([...js.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((m) => (m[1] as string).toLowerCase()));
  const unexpected = [...found].filter((h) => !allowed.has(h));
  expect(unexpected, `domini non previsti nel codice: ${unexpected.join(', ')}`).toEqual([]);
});

test('i dati cartografici dichiarano origine e licenza; i file di documentazione le riportano', async () => {
  const meta = JSON.parse(fs.readFileSync(path.resolve('public/data/map/map.json'), 'utf8')) as { attribution: string[]; osmRelease: string };
  expect(meta.attribution.join(' ')).toContain('OpenStreetMap contributors');
  expect(meta.attribution.join(' ')).toContain('ODbL');
  expect(meta.attribution.join(' ')).toContain('Copernicus');
  expect(meta.osmRelease).toMatch(/^\d{4}-\d{2}-\d{2}/);
  const sources = fs.readFileSync(path.resolve('docs/SOURCES.md'), 'utf8');
  for (const t of ['ODbL', 'CC BY 4.0', 'NON CONSULTATA', 'Copernicus']) expect(sources, `docs/SOURCES.md: manca "${t}"`).toContain(t);
});
