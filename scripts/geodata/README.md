# Pipeline dei dati geografici

L'app **non usa Python a runtime**: questi script producono i file statici in `public/data/` (e gli estratti tracciabili in `data/source/`). I risultati sono già committati; si rieseguono solo per aggiornare o controllare i dati.

## Principi

- **Nessuna coordinata scritta a mano.** I punti dell'itinerario sono scelti **per ID OSM** (`way`/`node`/`relation`) in `build_routes.py`; se un ID non esiste più nella release usata, la pipeline **si ferma** invece di sostituirlo.
- **Nessun tile scaricato in massa** da server pubblici: i livelli della mappa sono prodotti da dati aperti (OpenStreetMap via Overture Maps, ODbL; EU-DEM via Terrain Tiles) e distribuiti con l'app.
- Tutte le quote sono **stime da DEM (~25 m)**; i tempi di guida sono un **modello**; l'orizzonte e il sole diretto sono una **stima**.

## Requisiti

```bash
python3 -m venv scripts/geodata/.venv && . scripts/geodata/.venv/bin/activate
pip install -r scripts/geodata/requirements.txt   # pyarrow, numpy, shapely, pyproj, pillow, contourpy, requests, astral
```

Rete verso `overturemaps-us-west-2.s3.amazonaws.com` (dati OSM/Overture) e `s3.amazonaws.com/elevation-tiles-prod` (DEM). Le release Overture restano su S3 per circa 60 giorni: dopo la scadenza va aggiornata `RELEASE` in `config.py` (i risultati possono cambiare: rieseguire i test di integrità).

## Ordine di esecuzione

| # | Script | Produce |
|---|---|---|
| 1 | `fetch_overture.py` | `data/source/overture-<release>/{segments,features,areas}.geojson`, `SOURCE.json` (con ID OSM e date di modifica) |
| 2 | `build_map_layers.py` | `public/data/map/*` (ombreggiatura, curve di livello 20 m, acqua, sentieri, etichette, `map.json` con attribuzioni) |
| 3 | `build_routes.py` | `public/data/geo/{routes,points,validation}.json` e le tracce `public/data/gpx/*.gpx`; esegue i **controlli di coerenza** (lunghezze, quote, snap) e si ferma se falliscono |
| 4 | `build_horizon.py` | `public/data/geo/horizon.json` (orizzonte dal DEM per il sole diretto) |
| 5 | `build_drive.py` | `public/data/geo/drive.json` (distanze stradali e tempi stimati) |
| 6 | `render_docs.py` | riempie i blocchi generati di `docs/01-research-report.md` e genera `docs/SOURCES.md` da `src/content/sources.json` |

Poi, dalla radice del repository: `npm run docs:itinerary` (ITINERARIO, EMERGENCY, waypoints.csv) e `npm run test:all`.

## Dopo ogni rigenerazione

1. `npm run test:all` (i test confrontano l'app con questi dati: lunghezze, chiavi dei luoghi, ID OSM, area della mappa).
2. Verificare in `public/data/geo/validation.json` che tutti i controlli siano `ok`.
3. Aggiornare `DATE_RETRIEVED` in `config.py` e i testi in `docs/` se cambia qualcosa di sostanziale.
4. Ricostruire e ripubblicare l'app: ogni modifica ai dati cambia l'ID di versione e obbliga i telefoni a ripetere *Prepara il viaggio*.

## Come sostituire la traccia con una ufficiale (non ancora automatizzato)

Oggi l'app **importa** un GPX solo per **confrontarlo** con la traccia incorporata (Sicurezza → Traccia GPX). Per adottare una traccia ufficiale con provenienza nota servirebbe estendere `build_routes.py` perché legga il GPX e ne ricavi geometria e progressive; poi portare lo stato della traccia a `official-verified` (vedi `docs/01-research-report.md` §1.3) e aggiornare `src/content/sources.json`.
