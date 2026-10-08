"""DEM da Terrain Tiles (formato Terrarium) su AWS Open Data.

Fonte quote in Europa: EU-DEM (Copernicus), ~25 m; incertezza verticale tipica di alcuni metri in pianura e
di decine di metri su versanti ripidi. Le quote derivate da qui sono STIME, mai misure.
Attribuzione richiesta: "Produced using Copernicus data and information funded by the European Union - EU-DEM layers."
(vedi https://github.com/tilezen/joerd/blob/master/docs/attribution.md)
"""
from __future__ import annotations

import io
import math
import os

import numpy as np
from PIL import Image

import config
import overture

Z = config.DEM_ZOOM


def lonlat_to_tilef(lon: float, lat: float, z: int = Z) -> tuple[float, float]:
    n = 2**z
    x = (lon + 180.0) / 360.0 * n
    y = (1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n
    return x, y


def tilef_to_lonlat(x: float, y: float, z: int = Z) -> tuple[float, float]:
    n = 2**z
    lon = x / n * 360.0 - 180.0
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    return lon, lat


def tilef_to_lonlat_np(x, y, z: int = Z):
    n = 2**z
    lon = np.asarray(x) / n * 360.0 - 180.0
    lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * np.asarray(y) / n))))
    return lon, lat


def _fetch(z: int, x: int, y: int) -> bytes:
    os.makedirs(config.CACHE, exist_ok=True)
    p = os.path.join(config.CACHE, f"terrarium_{z}_{x}_{y}.png")
    if os.path.exists(p) and os.path.getsize(p) > 100:
        with open(p, "rb") as f:
            return f.read()
    data = overture._get(f"{config.DEM_BASE}/{z}/{x}/{y}.png", ok=(200,)).content  # noqa: SLF001
    with open(p, "wb") as f:
        f.write(data)
    return data


class Dem:
    """Mosaico di quote in pixel Web Mercator (zoom Z). Il pixel (0,0) e' l'angolo NO della tile (tx0, ty0)."""

    def __init__(self, bbox: tuple[float, float, float, float], margin_px: int = 2):
        x0f, y1f = lonlat_to_tilef(bbox[0], bbox[1])  # ovest, sud
        x1f, y0f = lonlat_to_tilef(bbox[2], bbox[3])  # est, nord
        self.tx0, self.tx1 = int(math.floor(x0f - margin_px / 256)), int(math.floor(x1f + margin_px / 256))
        self.ty0, self.ty1 = int(math.floor(y0f - margin_px / 256)), int(math.floor(y1f + margin_px / 256))
        w = (self.tx1 - self.tx0 + 1) * 256
        h = (self.ty1 - self.ty0 + 1) * 256
        arr = np.zeros((h, w), dtype=np.float32)
        for tx in range(self.tx0, self.tx1 + 1):
            for ty in range(self.ty0, self.ty1 + 1):
                im = np.asarray(Image.open(io.BytesIO(_fetch(Z, tx, ty))).convert("RGB"), dtype=np.float32)
                arr[(ty - self.ty0) * 256 : (ty - self.ty0 + 1) * 256, (tx - self.tx0) * 256 : (tx - self.tx0 + 1) * 256] = (
                    im[..., 0] * 256.0 + im[..., 1] + im[..., 2] / 256.0 - 32768.0
                )
        self.arr = arr
        self.tiles = (self.tx1 - self.tx0 + 1) * (self.ty1 - self.ty0 + 1)

    # coordinate pixel <-> lon/lat
    def to_px(self, lon: float, lat: float) -> tuple[float, float]:
        fx, fy = lonlat_to_tilef(lon, lat)
        return (fx - self.tx0) * 256.0, (fy - self.ty0) * 256.0

    def to_lonlat(self, px: float, py: float) -> tuple[float, float]:
        return tilef_to_lonlat(self.tx0 + px / 256.0, self.ty0 + py / 256.0)

    def sample(self, lon: float, lat: float) -> float:
        """Quota (m) per interpolazione bilineare; i centri pixel sono a +0.5."""
        px, py = self.to_px(lon, lat)
        px -= 0.5
        py -= 0.5
        x0, y0 = int(math.floor(px)), int(math.floor(py))
        dx, dy = px - x0, py - y0
        a = self.arr[y0, x0]
        b = self.arr[y0, x0 + 1]
        c = self.arr[y0 + 1, x0]
        d = self.arr[y0 + 1, x0 + 1]
        return float((a * (1 - dx) + b * dx) * (1 - dy) + (c * (1 - dx) + d * dx) * dy)

    def ground_px_m(self, lat: float) -> float:
        """Dimensione a terra (m) di un pixel Mercator allo zoom Z alla latitudine lat."""
        return 156543.03392804097 * math.cos(math.radians(lat)) / (2**Z)
