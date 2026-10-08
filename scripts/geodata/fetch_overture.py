"""Fase 1 — estrazione dei dati geografici di base da Overture Maps (derivati da OpenStreetMap).

Output (committato in data/source/overture-<release>/ per poter rigenerare e controllare l'itinerario
senza rete):
  segments.geojson  rete stradale/sentieristica (road): id, classe, nome, ID OSM, connettori
  features.geojson  punti/linee puntuali: infrastrutture (ponti, parcheggi, fontane, punti panoramici,
                    bacheche/cartelli), acqua (cascate, torrenti, laghi), rilievi (cime, selle), edifici con nome
  areas.geojson     poligoni acqua e copertura del suolo semplificati (per lo stile della mappa)
  SOURCE.json       metadati (release, data di estrazione, licenza, bbox)

Uso:  python fetch_overture.py
"""
from __future__ import annotations

import json
import os

import pyarrow.compute as pc
from shapely import wkb
from shapely.geometry import mapping

import config
import overture

OUT = os.path.join(config.SRC_DIR, f"overture-{config.RELEASE}")
os.makedirs(OUT, exist_ok=True)


def osm_ids(sources) -> list[str]:
    return sorted({s["record_id"] for s in (sources or []) if s.get("dataset") == "OpenStreetMap" and s.get("record_id")})


def osm_upd(sources) -> str | None:
    """Data (YYYY-MM-DD) dell'ultima modifica OSM tra le sorgenti OSM della feature."""
    ds = [s.get("update_time") for s in (sources or []) if s.get("dataset") == "OpenStreetMap" and s.get("update_time")]
    return max(ds)[:10] if ds else None


def planet_version(sources) -> str | None:
    vs = [s.get("version") for s in (sources or []) if s.get("dataset") == "OpenStreetMap" and s.get("version")]
    return max(vs) if vs else None


def primary_name(names) -> str | None:
    return (names or {}).get("primary") if names else None


def flag_ranges(row) -> list[list]:
    """[[valore, t0|None, t1|None], ...]: i flag (es. is_bridge) valgono solo nell'intervallo `between` del segmento."""
    out = []
    for f in row.get("road_flags") or []:
        b = f.get("between")
        for v in f.get("values") or []:
            out.append([v, round(b[0], 6) if b else None, round(b[1], 6) if b else None])
    return out


def surface_ranges(row) -> list[list]:
    out = []
    for sv in row.get("road_surface") or []:
        b = sv.get("between")
        if sv.get("value"):
            out.append([sv["value"], round(b[0], 6) if b else None, round(b[1], 6) if b else None])
    return out


def rnd(coords, nd=6):
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], nd), round(coords[1], nd)]
    return [rnd(c, nd) for c in coords]


def feature(geom, props) -> dict:
    g = mapping(geom)
    g["coordinates"] = rnd(g["coordinates"])
    return {"type": "Feature", "geometry": g, "properties": {k: v for k, v in props.items() if v not in (None, [], "")}}


def write(name: str, features: list[dict]) -> None:
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  {name}: {len(features)} feature, {os.path.getsize(path) / 1024:.0f} KiB")


def main() -> None:
    bbox = config.FETCH_BBOX

    # --- segmenti (strade + sentieri) ---
    cols = ["id", "names", "subtype", "class", "subclass", "connectors", "road_surface", "road_flags",
            "access_restrictions", "sources", "geometry", "bbox"]
    t = overture.query("transportation", "segment", bbox, columns=cols, rfilter=pc.field("subtype") == "road")
    segs = []
    planet_versions: set = set()
    for r in t.to_pylist():
        ids = osm_ids(r["sources"])
        if not ids:
            continue
        g = wkb.loads(r["geometry"])
        conns = [[c["connector_id"], round(c["at"], 6)] for c in sorted(r["connectors"] or [], key=lambda c: c["at"])]
        acc = None
        if r.get("access_restrictions"):
            acc = [{"type": a.get("access_type"), "when": (a.get("when") or {}).get("mode") or (a.get("when") or {}).get("using")}
                   for a in r["access_restrictions"]]
        segs.append(feature(g, {"id": r["id"], "cls": r["class"], "sub": r["subclass"], "name": primary_name(r["names"]),
                                "osm": ids, "upd": osm_upd(r["sources"]), "fr": flag_ranges(r), "sr": surface_ranges(r), "conn": conns, "access": acc}))
        planet_versions.add(planet_version(r["sources"]))
    segs.sort(key=lambda f: f["properties"]["id"])
    write("segments.geojson", segs)

    # --- features puntuali / lineari ---
    feats: list[dict] = []

    infra = overture.query("base", "infrastructure", bbox)
    keep = {"bridge", "parking", "drinking_water", "viewpoint", "toilets", "information", "dam", "substation",
            "cable_car", "picnic_site", "shelter", "bus_stop", "guidepost", "emergency_phone"}
    for r in infra.to_pylist():
        ids = osm_ids(r["sources"])
        if not ids or r["class"] not in keep:
            continue
        g = wkb.loads(r["geometry"])
        pt = g if g.geom_type == "Point" else g.representative_point()
        feats.append(feature(pt, {"kind": "infra", "cls": r["class"], "sub": r["subtype"], "name": primary_name(r["names"]),
                                  "osm": ids, "upd": osm_upd(r["sources"]), "geomType": g.geom_type, "id": r["id"]}))

    water = overture.query("base", "water", bbox)
    for r in water.to_pylist():
        ids = osm_ids(r["sources"])
        if not ids:
            continue
        g = wkb.loads(r["geometry"])
        if r["class"] == "waterfall":
            feats.append(feature(g, {"kind": "water", "cls": "waterfall", "name": primary_name(r["names"]), "osm": ids, "upd": osm_upd(r["sources"]), "id": r["id"]}))

    land = overture.query("base", "land", bbox)
    for r in land.to_pylist():
        ids = osm_ids(r["sources"])
        if not ids:
            continue
        g = wkb.loads(r["geometry"])
        if r["class"] in ("peak", "saddle", "cave_entrance") and g.geom_type == "Point":
            feats.append(feature(g, {"kind": "land", "cls": r["class"], "name": primary_name(r["names"]), "osm": ids, "upd": osm_upd(r["sources"]),
                                     "ele": r.get("elevation"), "id": r["id"]}))

    bld = overture.query("buildings", "building", bbox)
    for r in bld.to_pylist():
        ids = osm_ids(r["sources"])
        nm = primary_name(r["names"])
        if not ids or not (nm or r.get("class") in ("shelter", "hut", "cabin")):
            continue
        g = wkb.loads(r["geometry"])
        feats.append(feature(g.representative_point(), {"kind": "building", "cls": r.get("class"), "name": nm, "osm": ids,
                                                          "upd": osm_upd(r["sources"]), "id": r["id"]}))

    # localita' di partenza (Pergine Valsugana): punto di etichetta OSM della citta'
    div = overture.query("divisions", "division", (11.20, 46.03, 11.28, 46.09))
    for r in div.to_pylist():
        ids = osm_ids(r["sources"])
        if ids and primary_name(r["names"]) == "Pergine Valsugana" and r.get("subtype") == "locality":
            feats.append(feature(wkb.loads(r["geometry"]), {"kind": "locality", "cls": r.get("class"), "name": "Pergine Valsugana",
                                                              "osm": ids, "upd": osm_upd(r["sources"]), "id": r["id"]}))

    feats.sort(key=lambda f: (f["properties"]["kind"], f["properties"].get("id", "")))
    write("features.geojson", feats)

    # --- aree (stile mappa) ---
    areas: list[dict] = []
    tol = 3e-5  # ~3 m
    for r in water.to_pylist():
        ids = osm_ids(r["sources"])
        g = wkb.loads(r["geometry"])
        if not ids:
            continue
        if g.geom_type in ("Polygon", "MultiPolygon") and r["class"] in ("lake", "reservoir", "water", "pond", "river", "stream"):
            if g.area < 1e-9:
                continue
            areas.append(feature(g.simplify(tol, preserve_topology=True),
                                 {"kind": "water", "cls": r["class"], "name": primary_name(r["names"]), "osm": ids, "id": r["id"]}))
        elif g.geom_type == "LineString" and r["class"] in ("stream", "river", "canal"):
            areas.append(feature(g.simplify(tol, preserve_topology=True),
                                 {"kind": "waterline", "cls": r["class"], "name": primary_name(r["names"]), "osm": ids, "id": r["id"]}))
    for r in land.to_pylist():
        ids = osm_ids(r["sources"])
        g = wkb.loads(r["geometry"])
        if not ids or g.geom_type not in ("Polygon", "MultiPolygon"):
            continue
        if r["class"] in ("forest", "scrub", "grassland", "scree", "bare_rock", "glacier", "wetland", "rock", "grass"):
            if g.area < 2e-8:  # scarta frammenti minuscoli (< ~200 m^2)
                continue
            areas.append(feature(g.simplify(tol, preserve_topology=True),
                                 {"kind": "land", "cls": r["class"], "name": primary_name(r["names"]), "osm": ids, "id": r["id"]}))
    areas.sort(key=lambda f: (f["properties"]["kind"], f["properties"]["id"]))
    write("areas.geojson", areas)

    with open(os.path.join(OUT, "SOURCE.json"), "w", encoding="utf-8") as f:
        json.dump({
            "dataset": "Overture Maps Foundation",
            "release": config.RELEASE,
            "bucket": config.OVERTURE_BUCKET,
            "themes": ["transportation/segment", "base/infrastructure", "base/water", "base/land", "buildings/building", "divisions/division"],
            "filter": "solo feature con sources.dataset == 'OpenStreetMap'",
            "retrievedAt": config.DATE_RETRIEVED,
            "osmPlanetVersion": max(v for v in planet_versions if v),
            "bbox": list(bbox),
            "license": "Open Database License (ODbL) 1.0 — (c) OpenStreetMap contributors; Overture Maps Foundation",
            "attribution": "Contiene dati di OpenStreetMap (c) OpenStreetMap contributors, ODbL 1.0, tramite Overture Maps Foundation.",
        }, f, ensure_ascii=False, indent=2)
    print("OK ->", OUT)


if __name__ == "__main__":
    main()
