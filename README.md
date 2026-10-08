# Val di Fumo — Trail Companion

App web installabile (PWA), **mobile-first e offline-first**, per accompagnare un gruppo di amici nell'escursione del **9 ottobre 2026** in Val Daone (Trentino):

Pergine Valsugana → Cascata del Leno (Lago di Boazzo) → parcheggio della diga di Malga Bissina → pista lungo il Lago di Malga Bissina → Malga Breguzzo → cascata sul torrente Chiese → **Rifugio Val di Fumo** → ritorno alla diga → rientro a Pergine.

Cinque sezioni: **Oggi** (dashboard e pulsante contestuale), **Mappa** (carta topografica locale, GPS, distanze lungo la traccia), **Percorso** (tappe con fonti), **Esplora** (punti d'interesse), **Sicurezza e offline** (stato GPS e offline, emergenze, checklist, GPX).

> ## Stato onesto del progetto (leggere prima di fidarsi)
>
> - **Tutta la geometria dell'itinerario è derivata da OpenStreetMap** (via Overture Maps, release 2026-09-23.1) e **non è stata verificata sul campo**. Le fonti ufficiali richieste dal brief (SAT, Parco Adamello Brenta, Visit Trentino, Iter Edizioni) **non sono state lette**: erano bloccate dall'ambiente di sviluppo. Nessuna traccia GPX ufficiale è stata consultata.
> - **Non esistono prove su dispositivi fisici**: nessun iPhone, nessun secondo telefono, nessuna vera modalità aereo, nessun GPS reale. I test automatici girano su **Chromium** con geolocalizzazione e rete **simulate**. Il report distingue le tre categorie: [docs/TEST-REPORT.md](docs/TEST-REPORT.md).
> - **Da confermare per telefono prima di partire:** apertura del Rifugio Val di Fumo il 9/10 (le fonti sono discordanti), accesso/parcheggio alla diga, meteo. Elenco completo: [docs/FIELD-CHECKLIST.md](docs/FIELD-CHECKLIST.md).
> - Il meteo (Open-Meteo) non ha potuto essere provato dal vivo in sviluppo (host bloccato); la risposta è stata simulata nei test.
> - **Nessuna fotografia** è inclusa (nessuna immagine con licenza verificabile era raggiungibile).
>
> L'app **riduce l'incertezza, non la elimina**: non è una guida né una garanzia di sicurezza.

## Per chi deve solo usarla

1. [docs/INSTALL.md](docs/INSTALL.md) — installazione su iPhone e Android (con l'avviso importante sulle app installate da Safari).
2. [docs/OFFLINE.md](docs/OFFLINE.md) — come preparare e **verificare** l'uso senza rete. Ogni persona deve farlo sul proprio telefono: un link condiviso non prova nulla.
3. [docs/EMERGENCY.md](docs/EMERGENCY.md) — guida di emergenza da stampare (è anche nell'app, offline).

## Per chi sviluppa

```bash
npm ci                   # dipendenze (Node ≥ 20)
npm run dev              # sviluppo (le funzioni offline sono disattivate in dev)
npm run build            # typecheck + build in dist/ (con service worker e manifest di precache)
npm run preview          # serve dist/ su http://127.0.0.1:4173 (ambiente identico alla produzione)
npm test                 # test unitari (Vitest)
npm run test:e2e         # build + test end-to-end su Chromium (Playwright)
npm run test:all         # typecheck + unitari + E2E
npm run docs:itinerary   # rigenera docs/ITINERARIO.md, docs/EMERGENCY.md, docs/waypoints.csv dai dati dell'app
```

Per i test E2E serve Chromium di Playwright (`npx playwright install chromium`; nell'ambiente di sviluppo era già presente).

### Struttura

```
src/
  domain/      tipi (Trip, Stage, Waypoint, Route, RouteVariant, Parking, PointOfInterest, SafetyNotice, Source,
               OfflinePackage, GPSPosition, ScheduleEntry) e politica di validazione
  content/     testi dell'itinerario, luoghi, sicurezza; registro delle fonti (sources.json). Nessuna coordinata
  data/        caricamento e validazione dei JSON geografici; assemblaggio del Trip
  geo/         distanze, proiezione sulla traccia, avvisi di allontanamento, GPX, sole e orizzonte
  gps/         consenso, qualità del fix, età della posizione
  schedule/    motore del programma orario e suggerimenti di abbreviazione
  offline/     manifest di precache, download verificato (SHA-256), stato "pronto", service worker, installazione
  storage/     IndexedDB (preferenze, orari effettivi, ultima posizione) con ripiego in memoria
  weather/     Open-Meteo (solo a runtime sul dispositivo, con cache e data dell'ultimo aggiornamento)
  state/       stato applicativo (React context)
  ui/          schermate, componenti, mappa (MapLibre + ripiego SVG), stili con design token
  config/      configurazione dell'escursione (data, finestra di partenza, durate, soglie)
public/        sw.js, manifest, icone e dati generati (data/geo, data/map, data/gpx)
scripts/geodata/  pipeline Python riproducibile (Overture → grafo → percorsi → DEM → file statici)
data/source/   estratti OSM tracciabili (ID way/node/relation)
tests/         unit/ (Vitest) e e2e/ (Playwright)
tools/         plugin di build (manifest di precache), generatori dei documenti
docs/          documentazione (vedi sotto)
```

### Documentazione

| Documento | Contenuto |
|---|---|
| [docs/01-research-report.md](docs/01-research-report.md) | Fase 1: ricerca, fonti, discordanze, verifiche una per una |
| [docs/02-product-spec.md](docs/02-product-spec.md) | Fase 2: user flow, schermate, priorità |
| [docs/03-architecture.md](docs/03-architecture.md) | Fase 3: mappa offline legale, modello dati, strategia PWA |
| [docs/ITINERARIO.md](docs/ITINERARIO.md) | Itinerario documentato, programma d'esempio, database dei waypoint (generato) |
| [docs/waypoints.csv](docs/waypoints.csv) | Database dei waypoint (generato) |
| [docs/SOURCES.md](docs/SOURCES.md) | Registro delle fonti con stato di accesso e licenza (generato) |
| [docs/INSTALL.md](docs/INSTALL.md) | Installazione iPhone e Android |
| [docs/OFFLINE.md](docs/OFFLINE.md) | Preparazione e verifica offline |
| [docs/EMERGENCY.md](docs/EMERGENCY.md) | Guida di emergenza, checklist (generato) |
| [docs/KNOWN-LIMITS.md](docs/KNOWN-LIMITS.md) | Limiti noti, senza abbellimenti |
| [docs/FIELD-CHECKLIST.md](docs/FIELD-CHECKLIST.md) | Verifiche ancora da fare sul territorio e per telefono |
| [docs/TEST-REPORT.md](docs/TEST-REPORT.md) | Test eseguiti: automatici, simulati, su dispositivo (**non eseguiti**) |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Pubblicazione su hosting HTTPS e condivisione del link |
| [DATA-LICENSE.md](DATA-LICENSE.md) | Licenze e attribuzioni dei dati e delle librerie |

### Principi di progetto (verificati dai test)

- **Nessuna coordinata inventata.** Ogni punto ha ID OSM; i testi fanno riferimento ai punti per chiave. La pipeline si ferma se un ID sparisce.
- **Nessuna istruzione di svolta** ricavata dalla polilinea. Distanze **lungo la traccia**, mai in linea d'aria.
- **Stati di validazione espliciti** (`field-verified` … `unverified`): un dato non verificabile non guida automaticamente.
- **Consenso esplicito per il GPS**: nessuna posizione letta prima del tocco su "Attiva GPS" (test automatico). Nessun dato lascia il telefono.
- **"Pronto per l'uso offline" solo dopo verifica reale** (dimensione + SHA-256 riletti dalla cache, service worker attivo) e per dispositivo.
- **Nessuna dipendenza online nascosta**: unico dominio esterno contattato è Open-Meteo (facoltativo); una CSP restrittiva è provata dai test.
- **Mappa legale**: livelli prodotti da dati aperti (ODbL, EU-DEM) e distribuiti con l'app; nessun download massivo da tile server pubblici.

### Dati e licenze

I dati geografici in `public/data` e `data/source` derivano da **OpenStreetMap (© contributori OpenStreetMap, ODbL 1.0)** e dal rilievo **EU-DEM (Copernicus)**; vedi [DATA-LICENSE.md](DATA-LICENSE.md). **Il codice sorgente non ha ancora una licenza scelta**: va decisa dal titolare del repository.

### Pubblicazione

Build statica con `base: './'` (funziona in qualsiasi sottocartella). **Pubblicata su Vercel: https://val-di-fumo.vercel.app** — non provata dal vivo dall'ambiente di sviluppo (rete bloccata): vedi i controlli in [docs/DEPLOY.md](docs/DEPLOY.md). Il workflow GitHub Pages in `.github/workflows/pages.yml` è incluso come alternativa ma non è mai stato eseguito.
