"""Fase 3/6 — livelli della mappa offline (tutti locali, nessun tile scaricato da server pubblici):

  public/data/map/hillshade.webp   ombreggiatura del rilievo (da DEM Terrain Tiles / EU-DEM)
  public/data/map/map.json         bounds dell'immagine, metadati, attribuzioni
  public/data/map/contours.geojson curve di livello (20 m, indice ogni 100 m) — STIME da DEM ~25 m
  public/data/map/areas.geojson    poligoni acqua/copertura del suolo (OSM) ritagliati sull'AOI
  public/data/map/waterlines.geojson torrenti (OSM)
  public/data/map/transport.geojson  strade e sentieri (OSM) ritagliati sull'AOI
  public/data/map/labels.json      toponimi per le etichette (cime, laghi, malghe, ...)

Uso:  python build_map_layers.py
"""
from __future__ import annotations

import json
import math
import os

import contourpy
import numpy as np
from PIL import Image
from shapely.geometry import LineString, MultiLineString, box, mapping, shape
from shapely.geometry.base import BaseGeometry

import config
import netgraph as ng
from dem import Dem, tilef_to_lonlat_np

SRC = os.path.join(config.SRC_DIR, f"overture-{config.RELEASE}")
OUT = os.path.join(config.OUT_DIR, "map")
os.makedirs(OUT, exist_ok=True)

CONTOUR_STEP = 20
MAJOR_EVERY = 100
SIMPLIFY_DEG = 4e-5  # ~4 m


def rnd(x, nd=5):
    if isinstance(x, (int, float)):
        return round(x, nd)
    return [rnd(v, nd) for v in x]


def gauss(a: np.ndarray, sigma: float) -> np.ndarray:
    r = int(math.ceil(3 * sigma))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    pad = np.pad(a, r, mode="edge")
    tmp = np.apply_along_axis(lambda m: np.convolve(m, k, mode="valid"), 1, pad)
    return np.apply_along_axis(lambda m: np.convolve(m, k, mode="valid"), 0, tmp)[: a.shape[0], : a.shape[1]]


def hillshade(z: np.ndarray, cell_m: float, az_deg: float, alt_deg: float, exag: float) -> np.ndarray:
    dzdy, dzdx = np.gradient(z * exag, cell_m)
    slope = np.arctan(np.hypot(dzdx, dzdy))
    aspect = np.arctan2(dzdy, -dzdx)  # nord = su (y cresce verso sud)
    az = math.radians(360.0 - az_deg + 90.0)
    alt = math.radians(alt_deg)
    shade = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
    return np.clip(shade, 0.0, 1.0)


def main() -> None:
    w, s, e, n = config.AOI
    dem = Dem(config.AOI)
    print(f"DEM: {dem.tiles} tile, matrice {dem.arr.shape}, quote {dem.arr.min():.0f}..{dem.arr.max():.0f} m")

    # ritaglio sui confini pixel dell'AOI
    pxw, pyn = dem.to_px(w, n)
    pxe, pys = dem.to_px(e, s)
    x0, x1 = int(math.floor(pxw)), int(math.ceil(pxe))
    y0, y1 = int(math.floor(pyn)), int(math.ceil(pys))
    crop = dem.arr[y0:y1, x0:x1].copy()
    H, W = crop.shape
    lon_nw, lat_nw = dem.to_lonlat(x0, y0)
    lon_se, lat_se = dem.to_lonlat(x1, y1)
    lon_ne, lat_ne = dem.to_lonlat(x1, y0)
    lon_sw, lat_sw = dem.to_lonlat(x0, y1)
    print(f"ritaglio {W}x{H}px  NW=({lat_nw:.5f},{lon_nw:.5f})  SE=({lat_se:.5f},{lon_se:.5f})")
    clip_box = box(lon_nw, lat_se, lon_se, lat_nw)
    mid_lat = (lat_nw + lat_se) / 2

    # ---- ombreggiatura (x2 per un aspetto piu' morbido; nessuna informazione aggiuntiva) ----
    pad = 6
    big = np.pad(dem.arr[y0 - pad : y1 + pad, x0 - pad : x1 + pad], 0)
    big = gauss(big, 0.7)
    up = np.asarray(Image.fromarray(big.astype(np.float32), mode="F").resize((big.shape[1] * 2, big.shape[0] * 2), Image.BICUBIC))
    cell = dem.ground_px_m(mid_lat) / 2.0
    s_main = hillshade(up, cell, 315, 38, 1.5)
    s_fill = hillshade(up, cell, 45, 38, 1.5)
    shade = (0.7 * s_main + 0.3 * s_fill)[pad * 2 : pad * 2 + H * 2, pad * 2 : pad * 2 + W * 2]
    s0 = math.sin(math.radians(38))  # valore su terreno piano
    dark = np.clip((s0 - shade) / s0, 0, 1) ** 0.9
    light = np.clip((shade - s0) / (1 - s0), 0, 1)
    rgba = np.zeros((H * 2, W * 2, 4), dtype=np.uint8)
    a_dark = (dark * 0.78 * 255).astype(np.uint8)
    a_light = (light * 0.55 * 255).astype(np.uint8)
    use_light = a_light > a_dark
    rgba[..., :3] = np.where(use_light[..., None], 255, 20).astype(np.uint8)
    rgba[..., 3] = np.where(use_light, a_light, a_dark)
    img = Image.fromarray(rgba, "RGBA")
    p = os.path.join(OUT, "hillshade.webp")
    img.save(p, "WEBP", quality=68, method=6)
    print(f"hillshade.webp {img.size} {os.path.getsize(p) / 1024:.0f} KiB")

    # ---- curve di livello ----
    sm = gauss(crop, 1.1)
    xs = np.arange(W) + 0.5
    ys = np.arange(H) + 0.5
    gen = contourpy.contour_generator(xs, ys, sm, name="serial", line_type=contourpy.LineType.Separate)
    feats = []
    lo = int(math.floor(sm.min() / CONTOUR_STEP) * CONTOUR_STEP)
    hi = int(math.ceil(sm.max() / CONTOUR_STEP) * CONTOUR_STEP)
    for lvl in range(lo, hi + 1, CONTOUR_STEP):
        for line in gen.lines(lvl):
            if len(line) < 4:
                continue
            lon, lat = tilef_to_lonlat_np(dem.tx0 + (x0 + line[:, 0]) / 256.0, dem.ty0 + (y0 + line[:, 1]) / 256.0)
            coords = list(zip(lon.tolist(), lat.tolist()))
            ls = LineString(coords).simplify(SIMPLIFY_DEG, preserve_topology=False)
            ls = ls.intersection(clip_box)
            if ls.is_empty:
                continue
            parts = list(ls.geoms) if isinstance(ls, MultiLineString) else [ls]
            for part in parts:
                if part.geom_type != "LineString" or len(part.coords) < 2:
                    continue
                # lunghezza approssimata in metri
                length_m = part.length * 111_000 * 0.8
                if length_m < 70:
                    continue
                feats.append({"type": "Feature", "geometry": {"type": "LineString", "coordinates": rnd(list(part.coords))},
                              "properties": {"ele": lvl, "major": 1 if lvl % MAJOR_EVERY == 0 else 0}})
    feats.sort(key=lambda f: (f["properties"]["ele"], f["geometry"]["coordinates"][0]))
    p = os.path.join(OUT, "contours.geojson")
    with open(p, "w") as f:
        json.dump({"type": "FeatureCollection", "features": feats}, f, separators=(",", ":"))
    print(f"contours.geojson {len(feats)} linee {os.path.getsize(p) / 1024:.0f} KiB")

    # ---- aree / acqua ----
    with open(os.path.join(SRC, "areas.geojson")) as f:
        areas = json.load(f)["features"]
    out_areas, out_wl = [], []
    for ft in areas:
        pr = ft["properties"]
        g: BaseGeometry = shape(ft["geometry"])
        g = g.intersection(clip_box)
        if g.is_empty:
            continue
        g = g.simplify(6e-5, preserve_topology=True)
        if g.is_empty:
            continue
        if pr["kind"] == "waterline":
            out_wl.append({"type": "Feature", "geometry": {"type": g.geom_type, "coordinates": rnd(mapping(g)["coordinates"])},
                           "properties": {"cls": pr["cls"], **({"name": pr["name"]} if pr.get("name") else {})}})
        else:
            if g.geom_type in ("Polygon", "MultiPolygon") and g.area < 3e-8:
                continue
            out_areas.append({"type": "Feature", "geometry": {"type": g.geom_type, "coordinates": rnd(mapping(g)["coordinates"])},
                              "properties": {"kind": pr["kind"], "cls": pr["cls"], **({"name": pr["name"]} if pr.get("name") else {})}})
    for name, feats_ in (("areas.geojson", out_areas), ("waterlines.geojson", out_wl)):
        p = os.path.join(OUT, name)
        with open(p, "w") as f:
            json.dump({"type": "FeatureCollection", "features": feats_}, f, ensure_ascii=False, separators=(",", ":"))
        print(f"{name} {len(feats_)} feature {os.path.getsize(p) / 1024:.0f} KiB")

    # ---- trasporti ----
    with open(os.path.join(SRC, "segments.geojson")) as f:
        segs = json.load(f)["features"]
    out_tr, out_br = [], []
    for ft in segs:
        pr = ft["properties"]
        g = shape(ft["geometry"]).intersection(clip_box)
        if g.is_empty:
            continue
        g = g.simplify(2e-5, preserve_topology=False)
        parts = list(g.geoms) if g.geom_type == "MultiLineString" else [g]
        for part in parts:
            if part.geom_type != "LineString" or len(part.coords) < 2:
                continue
            props = {"cls": pr["cls"]}
            if pr.get("name") and pr["cls"] in ("tertiary", "secondary", "primary"):
                props["name"] = pr["name"]
            out_tr.append({"type": "Feature", "geometry": {"type": "LineString", "coordinates": rnd(list(part.coords))}, "properties": props})
        # tratti-ponte (solo gli intervalli realmente marcati come ponte)
        for piece in ng.iter_pieces(ft):
            if "is_bridge" in piece["flags"]:
                ll = [ng.to_ll(x, y) for x, y in piece["geom"].coords]
                if clip_box.intersects(LineString(ll)):
                    out_br.append({"type": "Feature", "geometry": {"type": "LineString", "coordinates": rnd(ll)},
                                   "properties": {"cls": pr["cls"], "osm": pr["osm"][0]}})
    for name, feats_ in (("transport.geojson", out_tr), ("bridges.geojson", out_br)):
        p = os.path.join(OUT, name)
        with open(p, "w") as f:
            json.dump({"type": "FeatureCollection", "features": feats_}, f, ensure_ascii=False, separators=(",", ":"))
        print(f"{name} {len(feats_)} linee {os.path.getsize(p) / 1024:.0f} KiB")

    # ---- etichette (toponimi) ----
    with open(os.path.join(SRC, "features.geojson")) as f:
        feats_src = json.load(f)["features"]
    labels = []
    for ft in feats_src:
        pr = ft["properties"]
        nm = pr.get("name")
        if not nm:
            continue
        lon_, lat_ = ft["geometry"]["coordinates"][:2]
        if not clip_box.contains(shape(ft["geometry"])):
            continue
        k = pr["kind"]
        cls = pr.get("cls")
        if k == "land" and cls == "peak" and (pr.get("ele") or 0) >= 2300:
            labels.append({"n": nm, "t": "peak", "x": round(lon_, 5), "y": round(lat_, 5), "e": pr.get("ele"), "osm": pr["osm"][0]})
        elif k == "land" and cls == "saddle" and (pr.get("ele") or 0) >= 2000:
            labels.append({"n": nm, "t": "saddle", "x": round(lon_, 5), "y": round(lat_, 5), "e": pr.get("ele"), "osm": pr["osm"][0]})
        elif k == "building":
            labels.append({"n": nm, "t": "hut", "x": round(lon_, 5), "y": round(lat_, 5), "osm": pr["osm"][0]})
        elif k == "infra" and cls in ("information", "dam"):
            labels.append({"n": nm, "t": cls, "x": round(lon_, 5), "y": round(lat_, 5), "osm": pr["osm"][0]})
    # laghi (poligoni)
    for ft in out_areas:
        if ft["properties"]["kind"] == "water" and ft["properties"].get("name") and ft["properties"]["cls"] in ("lake", "reservoir"):
            c = shape(ft["geometry"]).representative_point()
            labels.append({"n": ft["properties"]["name"], "t": "lake", "x": round(c.x, 5), "y": round(c.y, 5)})
    # de-duplica per (nome, tipo)
    seen, uniq = set(), []
    for l in labels:
        key = (l["n"], l["t"])
        if key in seen:
            continue
        seen.add(key)
        uniq.append(l)
    p = os.path.join(OUT, "labels.json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(uniq, f, ensure_ascii=False, separators=(",", ":"))
    print(f"labels.json {len(uniq)} etichette")

    meta = {
        "image": "hillshade.webp",
        "imageSize": [W * 2, H * 2],
        "coordinates": [[lon_nw, lat_nw], [lon_ne, lat_ne], [lon_se, lat_se], [lon_sw, lat_sw]],
        "bounds": [lon_nw, lat_se, lon_se, lat_nw],
        "contourStepM": CONTOUR_STEP,
        "demZoom": config.DEM_ZOOM,
        "demPixelGroundM": round(dem.ground_px_m(mid_lat), 2),
        "elevationRangeM": [float(dem.arr[y0:y1, x0:x1].min()), float(dem.arr[y0:y1, x0:x1].max())],
        "osmRelease": config.RELEASE,
        "retrievedAt": config.DATE_RETRIEVED,
        "attribution": [
            "Dati cartografici: © OpenStreetMap contributors (ODbL 1.0), via Overture Maps Foundation.",
            "Rilievo: Produced using Copernicus data and information funded by the European Union - EU-DEM layers (Terrain Tiles su AWS Open Data).",
        ],
    }
    with open(os.path.join(OUT, "map.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    print("OK map.json")


if __name__ == "__main__":
    main()
