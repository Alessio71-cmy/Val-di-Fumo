"""Fase 1/5 — calcolo dei percorsi e dei punti dell'itinerario a partire dai dati OSM (Overture).

REGOLA: nessuna coordinata e' scritta a mano. I punti sono scelti per ID OSM (way/node/relation) tra le
feature estratte da fetch_overture.py; se un ID non esiste piu' (deriva della release) la pipeline si ferma.

Output:
  public/data/geo/routes.json     percorsi (geometria [lon,lat,quota,progressiva]), statistiche, profilo, tratti
  public/data/geo/points.json     punti (parcheggi, malghe, cascate, ponti, ...) con ID OSM, quota DEM, progressiva
  public/data/geo/validation.json controlli di coerenza eseguiti (lunghezze, quote, snap) con esito
  public/data/gpx/*.gpx           tracce GPX (con avvertenza: tracce derivate da OSM, non rilevate sul campo)

Uso:  python build_routes.py
"""
from __future__ import annotations

import json
import math
import os
from collections import defaultdict
from datetime import datetime, timezone

import numpy as np
from shapely.geometry import LineString, Point

import config
import netgraph as ng
from dem import Dem

SRC = os.path.join(config.SRC_DIR, f"overture-{config.RELEASE}")
OUT_GEO = os.path.join(config.OUT_DIR, "geo")
OUT_GPX = os.path.join(config.OUT_DIR, "gpx")
os.makedirs(OUT_GEO, exist_ok=True)
os.makedirs(OUT_GPX, exist_ok=True)

# -------------------------------------------------------------------------------------------------
# Punti dell'itinerario, SCELTI PER ID OSM (la coordinata viene letta dall'estrazione, mai digitata).
# -------------------------------------------------------------------------------------------------
KEY = {
    "park-dam": "w82897607",          # parcheggio presso il Bar alla Diga (Malga Bissina) — area OSM
    "park-dam-alt": "w82897614",      # secondo parcheggio piu' in alto (area OSM)
    "toilets-dam": "w506258604",      # servizi igienici presso la diga
    "dam-bissina": "r4557683",        # Diga di Malga Bissina
    "fall-lakeside": "n1111843019",   # piccola cascata sul rio che sfocia nel lago (presso il ponte)
    "malga-breguzzo": "w60145454",    # Malga Breguzzo (edificio)
    "sign-breguzzo": "n5000770915",   # punto informativo 'Malga di Breguzzo'
    "fall-chiese": "n965276885",      # cascata (senza nome in OSM) subito a monte di Malga Breguzzo
    "malga-val-di-fumo": "n5000770909",  # punto informativo 'Malga Val di Fumo'
    "rifugio-val-di-fumo": "w82967465",  # Rifugio Val di Fumo (edificio)
    "fountain-rifugio": "n5000770906",   # punto acqua presso il rifugio
    "piana-val-di-fumo": "n5035244590",  # punto informativo 'Piana della Val di Fumo'
    "park-boazzo-centrale": "n3759967757",  # parcheggio presso la Centrale di Boazzo (sponda ovest del lago)
    "park-boazzo-nord": "n2989519691",      # parcheggio a nord del lago di Boazzo
    "fall-leno": "n3011054285",       # Cascata del Leno
    "view-leno": "n2371177775",       # punto panoramico presso la cascata del Leno
    "dam-boazzo": "r4557593",         # Diga di Malga Boazzo
    "water-boazzo": "n2376443057",    # punto acqua presso Boazzo
}

LAKES = {"lake-bissina": "r4557684", "lake-boazzo": "r3953956"}  # relazioni OSM (poligoni) in areas.geojson


# Calibrazione del passo: Tobler grezzo (~84 min per l'andata) vs fonti secondarie (78-120 min, mediana ~100):
# fattore 1.2 = passo di gruppo con soste brevi. E' una STIMA nominale, non una garanzia.
PACE_FACTOR = 1.2


def walk_weight(e: ng.Edge):
    f = {"path": 1.0, "footway": 1.0, "steps": 1.1, "pedestrian": 1.0, "track": 1.0, "cycleway": 1.0,
         "service": 1.15, "unclassified": 1.5, "residential": 1.5, "living_street": 1.5}.get(e.cls, 3.0)
    return e.length * f


def load_json(name: str):
    with open(os.path.join(SRC, name), encoding="utf-8") as f:
        return json.load(f)


def base_id(rid: str) -> str:
    return rid.split("@")[0]


def index_features() -> dict[str, dict]:
    idx: dict[str, dict] = {}
    for src in ("features.geojson", "areas.geojson"):
        for ft in load_json(src)["features"]:
            for rid in ft["properties"].get("osm", []):
                idx.setdefault(base_id(rid), ft)
    return idx


def feature_lonlat(ft: dict) -> tuple[float, float]:
    g = ft["geometry"]
    if g["type"] == "Point":
        return g["coordinates"][0], g["coordinates"][1]
    from shapely.geometry import shape
    p = shape(g).representative_point()
    return p.x, p.y


def tobler_minutes(chain: np.ndarray, ele: np.ndarray) -> np.ndarray:
    """Minuti cumulati con la funzione di Tobler (km/h = 6 e^{-3.5|s+0.05|}) su profilo gia' lisciato."""
    d = np.diff(chain)
    dz = np.diff(ele)
    s = np.divide(dz, d, out=np.zeros_like(dz), where=d > 0)
    v = 6.0 * np.exp(-3.5 * np.abs(s + 0.05))  # km/h
    mins = d / 1000.0 / np.maximum(v, 0.5) * 60.0
    return np.concatenate([[0.0], np.cumsum(mins)])


def ascent_descent(ele: np.ndarray, hysteresis: float = 5.0) -> tuple[float, float]:
    up = down = 0.0
    ref = ele[0]
    for z in ele[1:]:
        if z - ref >= hysteresis:
            up += z - ref
            ref = z
        elif ref - z >= hysteresis:
            down += ref - z
            ref = z
    return up, down


def resample(line: LineString, step: float) -> list[tuple[float, float]]:
    L = line.length
    n = max(2, int(math.ceil(L / step)) + 1)
    return [line.interpolate(i * L / (n - 1)).coords[0] for i in range(n)]


def build_route(g: ng.Graph, path, dem: Dem, name: str, rid: str, direction: str, extra=None) -> dict:
    """Costruisce la struttura del percorso (geometria con quota/progressiva e statistiche)."""
    pts_utm = g.path_coords(path)
    # rimuove punti consecutivi identici
    clean = [pts_utm[0]]
    for p in pts_utm[1:]:
        if math.dist(p, clean[-1]) > 0.05:
            clean.append(p)
    line = LineString(clean)
    L = line.length
    # geometria fedele (vertici OSM), con progressiva
    chain = [0.0]
    for a, b in zip(clean[:-1], clean[1:]):
        chain.append(chain[-1] + math.dist(a, b))
    lonlat = [ng.to_ll(x, y) for x, y in clean]
    ele_v = [dem.sample(lo, la) for lo, la in lonlat]
    # profilo regolare ogni 10 m per statistiche e tempi
    rs = resample(line, 10.0)
    rs_ll = [ng.to_ll(x, y) for x, y in rs]
    rs_ele = np.array([dem.sample(lo, la) for lo, la in rs_ll])
    rs_chain = np.linspace(0, L, len(rs))
    k = np.ones(7) / 7.0  # media mobile su ~70 m: riduce il rumore del DEM (~25 m)
    sm = np.convolve(np.pad(rs_ele, 3, mode="edge"), k, mode="valid")
    up, down = ascent_descent(sm)
    tob = tobler_minutes(rs_chain, sm) * PACE_FACTOR
    tob_rev = tobler_minutes(rs_chain, sm[::-1]) * PACE_FACTOR  # cumulato lungo il verso opposto (indice i = progressiva i del verso opposto)
    # tratti per classe/ponte con progressiva
    segs = []
    cum = 0.0
    for ei, a, b in path:
        e = g.edges[ei]
        if e.length <= 0:
            continue
        segs.append({"from": round(cum), "to": round(cum + e.length), "cls": e.cls, "osm": e.osm,
                     "bridge": "is_bridge" in e.flags, "surface": e.surface})
        cum += e.length
    # unisci tratti consecutivi con stessa classe/ponte/osm
    merged = []
    for s in segs:
        if merged and merged[-1]["cls"] == s["cls"] and merged[-1]["bridge"] == s["bridge"] and merged[-1]["osm"] == s["osm"]:
            merged[-1]["to"] = s["to"]
        else:
            merged.append(dict(s))
    prof_n = min(160, len(rs))
    idxs = np.linspace(0, len(rs) - 1, prof_n).astype(int)
    route = {
        "id": rid,
        "name": name,
        "direction": direction,
        "lengthM": round(L, 1),
        "ascentM": round(up),
        "descentM": round(down),
        "minEleM": round(float(sm.min())),
        "maxEleM": round(float(sm.max())),
        "paceFactor": PACE_FACTOR,
        "toblerMin": round(float(tob[-1]), 1),
        "toblerMinRev": round(float(tob_rev[-1]), 1),
        "toblerRev": [[round(float(rs_chain[i])), round(float(tob_rev[i]), 2)] for i in idxs],
        "coords": [[round(lo, 6), round(la, 6), round(z), round(c)] for (lo, la), z, c in zip(lonlat, ele_v, chain)],
        "profile": [[round(float(rs_chain[i])), round(float(sm[i]), 1)] for i in idxs],
        "tobler": [[round(float(rs_chain[i])), round(float(tob[i]), 2)] for i in idxs],
        "segments": merged,
    }
    if extra:
        route.update(extra)
    return route


def reverse_route(r: dict, rid: str, name: str, direction: str, dem: Dem) -> dict:
    coords = r["coords"][::-1]
    L = r["lengthM"]
    new = []
    for lo, la, z, c in coords:
        new.append([lo, la, z, round(L - c)])
    segs = [{"from": round(L - s["to"]), "to": round(L - s["from"]), "cls": s["cls"], "osm": s["osm"], "bridge": s["bridge"],
             "surface": s["surface"]} for s in r["segments"][::-1]]
    prof = [[round(L - c), z] for c, z in r["profile"][::-1]]
    out = dict(r)
    out.update({"id": rid, "name": name, "direction": direction, "coords": new, "profile": prof, "segments": segs,
                "ascentM": r["descentM"], "descentM": r["ascentM"],
                "tobler": r["toblerRev"], "toblerRev": r["tobler"],
                "toblerMin": r["toblerMinRev"], "toblerMinRev": r["toblerMin"]})
    return out


def project_point(line_utm: LineString, lon: float, lat: float) -> tuple[float, float]:
    x, y = ng.to_utm(lon, lat)
    p = Point(x, y)
    return line_utm.project(p), line_utm.distance(p)


def route_line_utm(r: dict) -> LineString:
    return LineString([ng.to_utm(c[0], c[1]) for c in r["coords"]])


def bearing(a, b) -> float:
    return (math.degrees(math.atan2(b[0] - a[0], b[1] - a[1])) + 360) % 360


def compass(deg: float) -> str:
    return ["N", "NE", "E", "SE", "S", "SO", "O", "NO"][int((deg + 22.5) // 45) % 8]


def write_gpx(path: str, name: str, desc: str, route: dict, wpts: list[dict]) -> None:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    def esc(s):
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<gpx version="1.1" creator="Val di Fumo Trail Companion" xmlns="http://www.topografix.com/GPX/1/1">',
             "<metadata>", f"<name>{esc(name)}</name>", f"<desc>{esc(desc)}</desc>",
             '<copyright author="OpenStreetMap contributors"><year>2026</year>'
             "<license>https://opendatacommons.org/licenses/odbl/1-0/</license></copyright>",
             f"<time>{now}</time>", "</metadata>"]
    for w in wpts:
        lines.append(f'<wpt lat="{w["lat"]:.6f}" lon="{w["lon"]:.6f}">')
        if w.get("ele") is not None:
            lines.append(f"<ele>{w['ele']:.0f}</ele>")
        lines.append(f"<name>{esc(w['name'])}</name>")
        if w.get("desc"):
            lines.append(f"<desc>{esc(w['desc'])}</desc>")
        lines.append("</wpt>")
    lines.append(f"<trk><name>{esc(name)}</name><desc>{esc(desc)}</desc><trkseg>")
    for lo, la, z, _ in route["coords"]:
        lines.append(f'<trkpt lat="{la:.6f}" lon="{lo:.6f}"><ele>{z}</ele></trkpt>')
    lines.append("</trkseg></trk></gpx>")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def main() -> None:
    graph = ng.Graph.from_segments(os.path.join(SRC, "segments.geojson"))
    print(f"grafo: {len(graph.edges)} edge")
    idx = index_features()
    dem = Dem(config.AOI)

    # ---- risoluzione dei punti per ID OSM ----
    pts: dict[str, dict] = {}
    for key, rid in KEY.items():
        ft = idx.get(rid)
        if ft is None:
            raise SystemExit(f"ID OSM {rid} ('{key}') non trovato nell'estrazione: la release e' cambiata? Verificare.")
        lon, lat = feature_lonlat(ft)
        pr = ft["properties"]
        pts[key] = {"id": key, "osm": pr["osm"], "name": pr.get("name"), "cls": pr.get("cls"), "kind": pr.get("kind"),
                    "lon": round(lon, 6), "lat": round(lat, 6), "eleDem": round(dem.sample(lon, lat), 0)}
    for key, rid in LAKES.items():
        ft = idx.get(rid)
        if ft is None:
            raise SystemExit(f"ID OSM {rid} ('{key}') non trovato")
        lon, lat = feature_lonlat(ft)
        pts[key] = {"id": key, "osm": ft["properties"]["osm"], "name": ft["properties"].get("name"), "cls": ft["properties"].get("cls"),
                    "kind": "water", "lon": round(lon, 6), "lat": round(lat, 6), "eleDem": round(dem.sample(lon, lat), 0)}

    snapper = graph.snapper()
    check: list[dict] = []

    def snap(key: str, max_dist=150.0, classes=None) -> ng.Snap:
        p = pts[key]
        s = snapper.snap(p["lon"], p["lat"], key, max_dist=max_dist, classes=classes)
        e = graph.edges[s.edge]
        check.append({"check": f"snap:{key}", "distM": round(s.dist, 1), "edgeClass": e.cls, "osm": e.osm,
                      "ok": s.dist <= max_dist})
        return s

    TRAILS = {"path", "footway", "steps", "track", "pedestrian", "service", "cycleway"}
    s_park = snap("park-dam", 120, TRAILS)
    s_breg = snap("malga-breguzzo", 60, TRAILS)
    s_hut = snap("rifugio-val-di-fumo", 60, TRAILS)

    # ---- andata principale: parcheggio diga -> Malga Breguzzo -> Rifugio ----
    g2, vn = graph.with_snaps([s_park, s_breg, s_hut])
    A = g2.dijkstra(vn[0], vn[1], walk_weight)
    B = g2.dijkstra(vn[1], vn[2], walk_weight)
    assert A and B, "percorso non trovato"
    path_main = A[0] + B[0]
    r_out = build_route(g2, path_main, dem, "Andata: parcheggio diga → Malga Breguzzo → Rifugio Val di Fumo", "route-out", "outbound",
                        {"kind": "main"})
    # sezione A (diga -> Breguzzo) e B (Breguzzo -> rifugio) in metri
    len_A = sum(g2.edges[ei].length for ei, _, _ in A[0])
    len_B = sum(g2.edges[ei].length for ei, _, _ in B[0])

    # ---- variante: sponda opposta del Chiese tra Malga Breguzzo e il rifugio (Yen, sovrapposizione < 25 %) ----
    alts = g2.yen(vn[1], vn[2], k=12, weight=walk_weight)
    base_edges = {ei for ei, _, _ in B[0]}
    chosen = None
    cands = []
    for p, w in alts[1:]:
        L = sum(g2.edges[ei].length for ei, _, _ in p)
        shared = sum(g2.edges[ei].length for ei, _, _ in p if ei in base_edges)
        cands.append((L, shared / max(L, 1)))
        if chosen is None and shared / max(L, 1) < 0.25 and L < len_B * 1.2:
            chosen = (p, L, shared / L)
    assert chosen, f"nessuna variante di sponda trovata: {cands}"
    path_var = A[0] + chosen[0]
    r_out_var = build_route(g2, path_var, dem, "Variante andata: sponda opposta del Chiese (Breguzzo → ponte di Malga Val di Fumo)",
                            "route-out-bank", "outbound", {"kind": "variant", "replaces": {"from": "malga-breguzzo", "to": "rifugio-val-di-fumo"},
                                                           "overlapWithMain": round(chosen[2], 2)})

    # ---- ritorno: stessa traccia (semplice, gia' vista) + variante per la sponda opposta ----
    r_back = reverse_route(r_out, "route-back", "Ritorno: Rifugio Val di Fumo → parcheggio diga (stessa traccia)", "return", dem)
    r_back["kind"] = "main"
    r_back_var = reverse_route(r_out_var, "route-back-bank", "Variante ritorno: sponda opposta del Chiese (rifugio → Malga Breguzzo → diga)",
                               "return", dem)
    r_back_var["kind"] = "variant"
    r_back_var["replaces"] = {"from": "rifugio-val-di-fumo", "to": "malga-breguzzo"}

    # ---- Cascata del Leno ----
    # Il nodo OSM della cascata e' nella parte ALTA (quota DEM ~1430 m, ~230 m sopra il lago): non e' una passeggiata
    # da 5 minuti. La sosta fotografica e' prevista al PONTE alla base (tratto marcato is_bridge piu' vicino al nodo
    # della cascata), vista dal basso; la salita ripida fino al nodo resta una estensione facoltativa NON guidata.
    fx, fy = ng.to_utm(pts["fall-leno"]["lon"], pts["fall-leno"]["lat"])
    best_b = None
    for ei, e in enumerate(graph.edges):
        if "is_bridge" in e.flags and e.cls in ("track", "path", "footway", "steps"):
            d = e.geom.distance(Point(fx, fy))
            if d < 450 and (best_b is None or d < best_b[0]):
                best_b = (d, ei)
    assert best_b, "ponte alla base della cascata del Leno non individuato"
    be = graph.edges[best_b[1]]
    bm = be.geom.interpolate(be.length / 2)
    blon, blat = ng.to_ll(bm.x, bm.y)
    pts["bridge-leno"] = {"id": "bridge-leno", "osm": be.osm, "name": None, "cls": "bridge", "kind": "infra", "lon": round(blon, 6),
                          "lat": round(blat, 6), "eleDem": round(dem.sample(blon, blat), 0),
                          "distFromFallNodeM": round(best_b[0])}
    check.append({"check": "ponte Leno: distanza dal nodo cascata (m)", "value": round(best_b[0]), "expected": [0, 450], "ok": True,
                  "note": "Ponte alla base scelto come tratto is_bridge piu' vicino al nodo OSM della cascata"})
    leno = {}
    s_bridge = snapper.snap(blon, blat, "bridge-leno", max_dist=40)
    for pk, rid, nm in (("park-boazzo-centrale", "walk-leno", "Passeggiata al ponte alla base della Cascata del Leno (da parcheggio Centrale di Boazzo)"),
                        ("park-boazzo-nord", "walk-leno-nord", "Passeggiata al ponte alla base della Cascata del Leno (da parcheggio nord)")):
        s_a = snap(pk, 80, TRAILS | {"tertiary"})
        g3, vn3 = graph.with_snaps([s_a, s_bridge])
        res = g3.dijkstra(vn3[0], vn3[1], walk_weight)
        if res:
            leno[rid] = build_route(g3, res[0], dem, nm, rid, "outbound", {"kind": "walk", "from": pk, "to": "bridge-leno"})
    s_a = snap("park-boazzo-centrale", 80, TRAILS | {"tertiary"})
    s_top = snap("fall-leno", 120, TRAILS)
    g4, vn4 = graph.with_snaps([s_a, s_top])
    res = g4.dijkstra(vn4[0], vn4[1], walk_weight)
    leno["walk-leno-top"] = build_route(g4, res[0], dem, "Estensione ripida (facoltativa, NON guidata): fino al nodo OSM alla sommita' della cascata",
                                        "walk-leno-top", "outbound", {"kind": "optional-steep", "from": "park-boazzo-centrale", "to": "fall-leno"})
    assert "walk-leno" in leno, "passeggiata al Leno non calcolata"

    routes = {r["id"]: r for r in [r_out, r_out_var, r_back, r_back_var, *leno.values()]}

    # ---- progressive e distanza dalla traccia per tutti i punti ----
    line_out = route_line_utm(r_out)
    line_var = route_line_utm(r_out_var)
    line_leno = route_line_utm(leno["walk-leno"])
    for k, p in pts.items():
        a, d = project_point(line_out, p["lon"], p["lat"])
        p["chainOut"] = round(a)
        p["offOutM"] = round(d)
        a2, d2 = project_point(line_var, p["lon"], p["lat"])
        p["chainOutBank"] = round(a2)
        p["offOutBankM"] = round(d2)
        a3, d3 = project_point(line_leno, p["lon"], p["lat"])
        p["chainLeno"] = round(a3)
        p["offLenoM"] = round(d3)

    # ---- ponti e punti di attenzione lungo l'andata ----
    bridges = []
    for s in r_out["segments"]:
        if s["bridge"]:
            mid = (s["from"] + s["to"]) / 2
            ll = line_out.interpolate(mid)
            lo, la = ng.to_ll(ll.x, ll.y)
            bridges.append({"fromM": s["from"], "toM": s["to"], "lon": round(lo, 6), "lat": round(la, 6), "osm": s["osm"],
                            "lengthM": s["to"] - s["from"]})

    # bivi: nodi del percorso principale con rami alternativi significativi (>= 120 m o track/path >= 60 m)
    on_route_nodes = []
    cum = 0.0
    node_chain = {}
    for ei, a, b in path_main:
        e = g2.edges[ei]
        node_chain.setdefault(a, cum)
        cum += e.length
        node_chain.setdefault(b, cum)
    used_edges = {ei for ei, _, _ in path_main}
    junctions = []
    for node, ch in sorted(node_chain.items(), key=lambda t: t[1]):
        if node.startswith("v"):
            continue
        branches = []
        for v, ei in g2.adj.get(node, []):
            if ei in used_edges:
                continue
            e = g2.edges[ei]
            if e.length < 60 and e.cls not in ("path", "track"):
                continue
            if e.length < 25:
                continue
            c = list(e.geom.coords)
            if e.u != node:
                c.reverse()
            tgt = c[min(len(c) - 1, 3)]
            b_deg = bearing(c[0], tgt)
            branches.append({"cls": e.cls, "lengthM": round(e.length), "bearing": round(b_deg), "dir": compass(b_deg), "osm": e.osm[:2],
                             "bridge": "is_bridge" in e.flags})
        if branches:
            x, y = None, None
            for ei, a, b in path_main:
                ee = g2.edges[ei]
                if a == node:
                    x, y = ee.geom.coords[0] if ee.u == a else ee.geom.coords[-1]
                    break
                if b == node:
                    x, y = ee.geom.coords[-1] if ee.u == a else ee.geom.coords[0]
                    break
            if x is None:
                continue
            lo, la = ng.to_ll(x, y)
            junctions.append({"chainM": round(ch), "lon": round(lo, 6), "lat": round(la, 6), "branches": branches})
    # accorpa bivi a meno di 25 m uno dall'altro
    merged_j = []
    for j in junctions:
        if merged_j and j["chainM"] - merged_j[-1]["chainM"] < 25:
            merged_j[-1]["branches"].extend(j["branches"])
        else:
            merged_j.append(j)

    # ---- controlli di coerenza (confronto con le fonti secondarie raccolte il 2026-10-08) ----
    def chk(name, value, lo, hi, note):
        check.append({"check": name, "value": round(value, 1), "expected": [lo, hi], "ok": lo <= value <= hi, "note": note})

    chk("lunghezza andata (m)", r_out["lengthM"], 5500, 6600,
        "Fonti secondarie: ~6 km a senso unico; 12,3 km a/r (portale Trentino); 3,5 km pista del lago fino a Malga Breguzzo")
    chk("pista lago fino a Malga Breguzzo (m)", len_A, 3000, 3900, "Fonte secondaria: ~3,5 km")
    chk("tempo andata modello Tobler (min)", r_out["toblerMin"], 70, 120,
        "Fonti secondarie: 1,3 h (78') / 1,5-1,75 h / 1h45 / 1,5-2 h per diga->rifugio")
    chk("dislivello positivo andata (m)", r_out["ascentM"], 60, 220, "Fonti secondarie: 95-170 m")
    chk("quota rifugio da DEM (m)", pts["rifugio-val-di-fumo"]["eleDem"], 1870, 1940, "Fonti secondarie: 1887 / 1918 m")
    chk("quota Malga Breguzzo da DEM (m)", pts["malga-breguzzo"]["eleDem"], 1790, 1850, "Fonte secondaria: 1826 m")
    chk("quota parcheggio diga da DEM (m)", pts["park-dam"]["eleDem"], 1780, 1870, "Fonti secondarie: 1790-1847 m")
    chk("distanza cascata Chiese dal percorso (m)", pts["fall-chiese"]["offOutM"], 0, 80, "Attesa vicino a Malga Breguzzo")
    chk("lunghezza passeggiata Leno al ponte (m)", leno["walk-leno"]["lengthM"], 150, 700, "Fonte secondaria: ~5 min a piedi dal parcheggio al ponte alla base")
    chk("lunghezza totale tratti-ponte sull'andata (m)", sum(s["to"] - s["from"] for s in r_out["segments"] if s["bridge"]), 0, 200,
        "I ponti sono brevi: un valore alto indicherebbe l'errore dei flag senza intervallo")
    chk("lunghezza variante sponda (m)", r_out_var["lengthM"], r_out["lengthM"] * 0.9, r_out["lengthM"] * 1.2, "Sponda opposta, lunghezza simile")

    # ---- scrittura ----
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    meta = {"generatedAt": now, "osmRelease": config.RELEASE, "demZoom": config.DEM_ZOOM, "retrievedAt": config.DATE_RETRIEVED}
    with open(os.path.join(OUT_GEO, "routes.json"), "w", encoding="utf-8") as f:
        json.dump({"meta": meta, "routes": routes, "bridges": bridges, "junctions": merged_j,
                   "sections": {"damToBreguzzoM": round(len_A, 1), "breguzzoToRifugioM": round(len_B, 1)}}, f, ensure_ascii=False,
                  separators=(",", ":"))
    with open(os.path.join(OUT_GEO, "points.json"), "w", encoding="utf-8") as f:
        json.dump({"meta": meta, "points": pts}, f, ensure_ascii=False, indent=1, sort_keys=True)
    with open(os.path.join(OUT_GEO, "validation.json"), "w", encoding="utf-8") as f:
        json.dump({"meta": meta, "checks": check}, f, ensure_ascii=False, indent=1)

    # GPX
    def wp(key, name, desc=""):
        p = pts[key]
        return {"lat": p["lat"], "lon": p["lon"], "ele": p["eleDem"], "name": name, "desc": desc}

    disc = ("Traccia DERIVATA da OpenStreetMap (ODbL), non rilevata sul campo ne' confrontata con la traccia ufficiale SAT. "
            "Quote da DEM (stime).")
    wp_main = [wp("park-dam", "Parcheggio diga Malga Bissina"), wp("malga-breguzzo", "Malga Breguzzo"),
               wp("fall-chiese", "Cascata sul Chiese (nodo OSM)"), wp("malga-val-di-fumo", "Malga Val di Fumo"),
               wp("rifugio-val-di-fumo", "Rifugio Val di Fumo")]
    write_gpx(os.path.join(OUT_GPX, "andata-diga-rifugio.gpx"), "Andata diga Malga Bissina → Rifugio Val di Fumo", disc, r_out, wp_main)
    write_gpx(os.path.join(OUT_GPX, "ritorno-rifugio-diga.gpx"), "Ritorno Rifugio Val di Fumo → diga Malga Bissina", disc, r_back, wp_main[::-1])
    write_gpx(os.path.join(OUT_GPX, "variante-sponda-opposta.gpx"), "Variante sponda opposta del Chiese", disc, r_out_var, wp_main)
    write_gpx(os.path.join(OUT_GPX, "cascata-del-leno.gpx"), "Passeggiata alla Cascata del Leno", disc, leno["walk-leno"],
              [wp("park-boazzo-centrale", "Parcheggio Centrale di Boazzo"), wp("fall-leno", "Cascata del Leno (nodo OSM)")])

    print("\n=== PERCORSI ===")
    for r in routes.values():
        print(f"{r['id']:16s} {r['lengthM']:7.0f} m  +{r['ascentM']:3d}/-{r['descentM']:3d} m  quota {r['minEleM']}..{r['maxEleM']}  Tobler {r['toblerMin']:5.1f} min  {len(r['coords'])} vertici")
    print(f"\nsezioni: diga→Breguzzo {len_A:.0f} m, Breguzzo→rifugio {len_B:.0f} m; variante sovrapposizione {chosen[2]:.0%}")
    print("\n=== PUNTI (progressiva sull'andata, distanza dal tracciato) ===")
    for k, p in sorted(pts.items(), key=lambda t: t[1]["chainOut"]):
        print(f"{k:22s} lat={p['lat']:.5f} lon={p['lon']:.5f} ele~{p['eleDem']:.0f}  chain={p['chainOut']:5d} m  off={p['offOutM']:4d} m  {p['osm']}")
    print("\nPonti sull'andata:", [(b['fromM'], b['lengthM'], b['osm']) for b in bridges])
    print(f"Bivi: {len(merged_j)}")
    for j in merged_j:
        print("  ", j["chainM"], [(b["dir"], b["cls"], b["lengthM"]) for b in j["branches"]])
    print("\n=== CONTROLLI ===")
    for c in check:
        flag = "OK " if c["ok"] else "XX "
        print(flag, {k: v for k, v in c.items() if k != "ok"})


if __name__ == "__main__":
    main()
