# Fase 3 — Architettura tecnica

> Verifica di coerenza: PWA installabile da URL HTTPS, offline-first, nessuna dipendenza online nascosta, nessuna chiave, nessun server locale; cartografia **legalmente distribuibile**; separazione tra contenuti, dati geografici, GPS, calcoli, programma, UI, offline, configurazione.

## 1. Soluzione cartografica offline (scelta e motivazione)

**Scelta: mappa vettoriale/raster *prodotta da noi* da dati aperti e distribuita come file statici dell'app, resa con MapLibre GL JS.**

| Componente | Origine | Licenza | Come è nell'app |
|---|---|---|---|
| Strade, sentieri, ponti, acqua, boschi/rocce, edifici, cime | OpenStreetMap via Overture (release 2026-09-23.1) | ODbL-1.0 | GeoJSON ritagliati sull'AOI (`public/data/map/*.geojson`) |
| Rilievo | Terrain Tiles / EU-DEM (~25 m) | open, attribuzione EU-DEM | `hillshade.webp` (ombreggiatura) + curve di livello 20 m (`contours.geojson`) |
| Motore di rendering | `maplibre-gl` (BSD-3) | BSD-3-Clause | bundle locale; nessuno stile/tile/glyph remoto |

Alternative scartate:
- **Tile raster OSM/OpenTopoMap scaricate in massa**: vietato dalle policy d'uso dei server pubblici (e bloccato dalla rete di sviluppo).
- **PMTiles/vector tiles Protomaps**: i server non sono raggiungibili da qui e non includerebbero comunque i tag necessari; avrebbero richiesto font (glyph) remoti.
- **Etichette con glyph PBF**: evitate. I toponimi e i punti sono **elementi DOM** accessibili (pulsanti con `aria-label`), quindi nessun font remoto.

Copertura limitata all'area necessaria (**≈ 9,9 × 12,5 km**, ≈ 2,1 MB di mappa e 3,6 MB in tutto con l'app) per un uso consapevole dello spazio. Tutti i file sono caricati dal thread principale e passati a MapLibre come oggetti (`data`), così **nessuna richiesta di rete** parte dai worker. Un `transformRequest` blocca ogni URL fuori origine.

**Fallback senza WebGL / senza pacchetto mappa**: mappa schematica SVG (stessi GeoJSON, stesso rilievo se presente), elenco testuale delle tappe, GPX.

## 2. Stack

Vite · React 18 · TypeScript (strict) · MapLibre GL JS · CSS con design token · Service Worker scritto a mano (poche righe, controllo totale della verifica offline) · IndexedDB (wrapper di ~60 righe, nessuna libreria) · GeoJSON/GPX · Vitest (unit) · Playwright (E2E, Chromium).

Niente routing library, niente state manager esterno: stato in `useState` + context (`src/state/AppState.tsx`); navigazione a schede con hash (`#/oggi`, `#/mappa`, …).

## 3. Struttura del repository

```
src/
  domain/        tipi (Trip, Stage, Waypoint, Route, RouteVariant, Parking, PointOfInterest,
                 SafetyNotice, Source, OfflinePackage, GPSPosition, ScheduleEntry) e politica di validazione
  content/       testi dell'itinerario (IT) + registro fonti; le coordinate NON sono qui
  geo/           distanze, proiezione sulla traccia, avvisi di allontanamento, GPX, sole/orizzonte
  gps/           stato della geolocalizzazione (consenso, qualità, età del fix)
  schedule/      motore del programma (partenza → rientro) e suggerimenti di abbreviazione
  offline/       registro risorse, download verificato, stato "pronto offline", aggiornamenti
  storage/       IndexedDB (preferenze, registro orari, ultima posizione, meteo, tracce importate)
  ui/            schermate e componenti (Oggi, Mappa, Percorso, Esplora, Sicurezza)
  config/        configurazione dell'escursione (data, finestra di partenza, durate, soglie)
public/
  data/          dati generati dalla pipeline (geo, map, gpx) + manifest/icone + sw.js
scripts/geodata/ pipeline Python riproducibile (Overture → grafo → percorsi → DEM → file statici)
data/source/     estratti OSM tracciabili (ID way/node/relation) della release usata
tests/           unit, E2E e fixture di riferimento
docs/            documentazione
```

## 4. Modello dati (sintesi)

Ogni elemento geografico ha: **ID stabile**, **nome**, **coordinate** (lette dai dati generati), **tipo**, **descrizione**, **fonte** (`sourceIds`), **stato di validazione**, **data dell'ultima verifica**, **ultima modifica del dato OSM** quando nota. Ogni percorso ha: identificativo, nome, geometria `[lon, lat, quota, progressiva]`, direzione, lunghezza **calcolata**, dislivello (stima DEM), segnavia, fonte della traccia, difficoltà, avvertenze, varianti. Dettagli in `src/domain/types.ts`.

Le coordinate non compaiono mai nei testi: `src/content` fa riferimento ai punti per **chiave** (`park-dam`, `rifugio-val-di-fumo`…) e la risoluzione avviene da `public/data/geo/points.json`; un test verifica che ogni chiave esista, che abbia ID OSM e che cada nell'AOI.

## 5. Strategia PWA e offline

**Due gruppi di risorse, entrambi verificati:**

1. **core** (installato dal service worker alla prima visita): `index.html`, JS/CSS, icone, manifest, **testi dell'itinerario e guida di emergenza (nel bundle)**, `routes.json`, `points.json`, `horizon.json`, `drive.json`, GPX. Garantisce che l'app **si apra** offline e che le funzioni essenziali (testo, waypoint, traccia, emergenza) funzionino senza mappa.
2. **map** (scaricato esplicitamente da **Prepara il viaggio**): ombreggiatura, curve, aree, trasporti, torrenti, ponti, etichette.

**Download verificato**: l'app scarica ogni risorsa del manifest (`precache-manifest.json`, generato in build con dimensione e SHA-256), la salva in Cache Storage, la **rilegge** e confronta dimensione e hash. Solo se *tutte* le risorse indispensabili risultano presenti e integre, e il service worker controlla la pagina, appare **"Pronto per l'uso offline"** con data/ora e versione. Lo stato è **per dispositivo** (IndexedDB locale) e viene **rivalutato a ogni avvio** (se la cache è stata svuotata dal sistema lo stato torna "non pronto"). Un link condiviso **non** è prova di installazione né di preparazione offline.

**Aggiornamenti**: il service worker nuovo resta in attesa (`waiting`): l'utente decide *Aggiorna ora* (non si sostituisce il codice a metà escursione). Versioni: `BUILD_ID` (shell) e `PACK_VERSION` (dati).

**Richieste di rete consentite**: solo (a) meteo Open-Meteo, con timeout, mai bloccante, risultato memorizzato con ora; (b) link esterni aperti dall'utente (navigatore stradale). Un test E2E verifica che, offline dopo la preparazione, **nessuna** richiesta indispensabile fallisca.

**Persistenza**: `navigator.storage.persist()` richiesto e il risultato mostrato (su iOS non garantito; le PWA aggiunte alla Home sono meno soggette allo sfratto della cache).

## 6. Distribuzione

Build statica (`npm run build` → `dist/`), `base: './'` (funziona in qualsiasi sottocartella), workflow GitHub Pages incluso (`.github/workflows/pages.yml`, richiede di abilitare Pages con sorgente *GitHub Actions*) e istruzioni per hosting equivalenti (Netlify, Vercel, Cloudflare Pages). HTTPS è indispensabile per service worker e geolocalizzazione.

## 7. Rischi tecnici noti

- **WebGL su iOS**: possibile perdita di contesto con poca memoria → fallback SVG automatico.
- **Eviction della cache** (iOS): mitigata da installazione in Home, `persist()` e ricontrollo a ogni avvio.
- **Background**: iOS sospende la geolocalizzazione ad app non in primo piano → dichiarato nell'interfaccia.
- **Quote DEM** ±20–30 m; **orizzonte** ±15–20 min: sempre etichettati come stime.
