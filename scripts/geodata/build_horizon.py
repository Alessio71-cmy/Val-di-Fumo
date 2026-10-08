"""Orizzonte del rilievo dai punti chiave (ray-marching sul DEM) per stimare quando il sole diretto
scompare dietro le creste.

ATTENZIONE: e' una STIMA da DEM ~25 m (EU-DEM). Non considera alberi, edifici ne' l'effettivo profilo delle creste
inferiori alla risoluzione del DEM. Va letta come ordine di grandezza (+-15-20 minuti), mai come garanzia.

Output: public/data/geo/horizon.json  { points: { <id>: { lon, lat, eleDem, az: [..], elev: [..] } } }
Uso: python build_horizon.py
"""
from __future__ import annotations

import json
import math
import os

import numpy as np

import config
import netgraph as ng
from dem import Dem

OUT = os.path.join(config.OUT_DIR, "geo")
KEYS = ["park-boazzo-centrale", "park-dam", "malga-breguzzo", "rifugio-val-di-fumo"]
MAX_DIST = 15000.0
STEP = 40.0
EYE = 1.7
REFRACTION_K = 0.13
AZ_STEP = 2


def main() -> None:
    with open(os.path.join(OUT, "points.json"), encoding="utf-8") as f:
        pts = json.load(f)["points"]
    big = (10.28, 45.90, 10.80, 46.30)  # DEM esteso per i raggi (~15 km)
    dem = Dem(big)
    print(f"DEM esteso: {dem.tiles} tile, {dem.arr.shape}")
    ds = np.arange(STEP, MAX_DIST + STEP, STEP)
    azs = np.arange(0, 360, AZ_STEP)
    out = {}
    for k in KEYS:
        p = pts[k]
        x0, y0 = ng.to_utm(p["lon"], p["lat"])
        z0 = dem.sample(p["lon"], p["lat"]) + EYE
        hz = []
        for az in azs:
            a = math.radians(az)
            xs = x0 + ds * math.sin(a)
            ys = y0 + ds * math.cos(a)
            lo, la = ng._TO_LL.transform(xs, ys)  # noqa: SLF001
            z = dem.sample_many(lo, la)
            drop = ds**2 / (2 * 6371000.0) * (1 - REFRACTION_K)
            ang = np.degrees(np.arctan2(z - z0 - drop, ds))
            ang = np.where(np.isnan(ang), -90, ang)
            hz.append(float(ang.max()))
        out[k] = {"lon": p["lon"], "lat": p["lat"], "eleDem": round(z0 - EYE), "azStepDeg": AZ_STEP,
                  "elev": [round(h, 1) for h in hz]}
        w = [h for a, h in zip(azs, hz) if 200 <= a <= 290]
        print(f"{k:22s} z={z0 - EYE:6.0f} m  orizzonte O-SO (200-290 deg): max {max(w):5.1f}  media {np.mean(w):5.1f}")
    with open(os.path.join(OUT, "horizon.json"), "w", encoding="utf-8") as f:
        json.dump({"method": "ray-marching DEM Terrarium z13 (EU-DEM ~25 m), 40 m/passo fino a 15 km, rifrazione k=0.13, occhio +1.7 m",
                   "note": "Stima: non considera vegetazione/edifici; incertezza tipica +-15-20 min sull'ora di scomparsa del sole.",
                   "points": out}, f, ensure_ascii=False, separators=(",", ":"))
    print("OK horizon.json")


if __name__ == "__main__":
    main()
