# Licenze e attribuzioni dei dati e delle librerie

> Questo documento descrive le licenze **come le intende chi ha costruito l'app**. **Non è una consulenza legale.** Se pubblichi o ridistribuisci l'app su larga scala, fai verificare condizioni e attribuzioni.

## Dati cartografici e dell'itinerario

| Componente | Origine | Licenza | Attribuzione richiesta |
|---|---|---|---|
| `public/data/geo/*.json`, `public/data/gpx/*.gpx`, `public/data/map/*.geojson`, `labels.json`, `data/source/**` | **OpenStreetMap**, estratto tramite **Overture Maps Foundation** (release 2026-09-23.1, snapshot OSM planet 2026-09-09). Contengono geometrie, ID e date di modifica OSM. | **ODbL 1.0** (Open Database License) — <https://opendatacommons.org/licenses/odbl/1-0/> | **© OpenStreetMap contributors** (mostrata in app, nella mappa e nei metadati dei GPX). I file sono un *database derivato*: vanno ridistribuiti con la stessa licenza e con l'attribuzione. |
| `public/data/map/hillshade.webp`, curve di livello (`contours.geojson`), quote di punti e tracce, profilo dell'orizzonte | **EU-DEM** (Copernicus) tramite *Terrain Tiles* su AWS Open Data | Dati Copernicus, uso libero con attribuzione | *"Produced using Copernicus data and information funded by the European Union - EU-DEM layers."* (mostrata in app e nella mappa) |
| Alba/tramonto | Calcolo locale (algoritmo NOAA), verificato con la libreria `astral` solo nei test | — | — |

I tempi di guida, i tempi di cammino e il sole diretto sono **elaborazioni dell'app** (stime), non dati di terzi.

**Fonti consultate come sintesi di ricerca** (testi descrittivi, nessun contenuto copiato): elenco e licenza in [docs/SOURCES.md](docs/SOURCES.md). Le quattro fonti iniziali del brief **non sono state lette**.

## Meteo

**Open-Meteo** — <https://open-meteo.com/> — **CC BY 4.0** (uso non commerciale per l'API gratuita). Richiesto a runtime dal dispositivo (non dal repository) e mostrato con data/ora; attribuzione presente in app (*Fonti, licenze e attribuzioni*). Il servizio non ha potuto essere provato dal vivo in sviluppo.

## Librerie

| Libreria | Licenza |
|---|---|
| MapLibre GL JS 4.7.1 | BSD-3-Clause |
| React / React DOM 18.3.1 | MIT |
| Vite, Vitest, Playwright, axe-core, TypeScript (solo sviluppo) | MIT / Apache-2.0 / ISC secondo il pacchetto |

Nessun font, immagine, icona o tile di terzi è caricato a runtime. Le icone dell'app sono disegnate nel repository (`scripts/make-icons.py`, `src/ui/components/Icon.tsx`).

## Codice sorgente dell'app

**Nessuna licenza è stata scelta.** Finché il titolare non ne aggiunge una (file `LICENSE`), valgono i diritti d'autore predefiniti: altri non hanno il permesso di riutilizzare il codice. I dati OSM derivati restano comunque soggetti all'ODbL come indicato sopra.

## Fotografie

Nessuna fotografia è inclusa. Quando se ne aggiungeranno, riportare per ciascuna autore, licenza e origine.
