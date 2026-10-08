"""Configurazione della pipeline geodati. Nessuna coordinata di itinerario va scritta a mano:
i punti sono selezionati per ID OSM dalle estrazioni Overture (vedi build_routes.py)."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
CACHE = os.path.join(HERE, ".cache")
SRC_DIR = os.path.join(ROOT, "data", "source")
OUT_DIR = os.path.join(ROOT, "public", "data")

# Release Overture Maps usata per l'estrazione (i dati base/transportation derivano da OpenStreetMap, ODbL).
# NB: le release restano su S3 per ~60 giorni; per rigenerare dopo la scadenza aggiornare RELEASE
# (i risultati possono cambiare: ricontrollare i test di integrità dei dati).
RELEASE = "2026-09-23.1"
OVERTURE_BUCKET = "https://overturemaps-us-west-2.s3.amazonaws.com"

# Area coperta dalla mappa offline (lon_min, lat_min, lon_max, lat_max).
AOI = (10.470, 45.985, 10.600, 46.097)
# Area di estrazione (poco più larga, per il contesto di routing).
FETCH_BBOX = (10.440, 45.960, 10.640, 46.130)

# Zoom Terrain Tiles (Terrarium) per DEM / ombreggiatura / curve di livello.
DEM_ZOOM = 13
DEM_BASE = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium"

DATE_RETRIEVED = "2026-10-08"
