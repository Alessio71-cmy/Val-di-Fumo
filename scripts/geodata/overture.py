"""Lettore minimale di Overture Maps (GeoParquet su S3 pubblico) via HTTP range request.

Licenze: i temi `base` e `transportation` derivano da OpenStreetMap (ODbL 1.0,
(c) OpenStreetMap contributors). Si usano solo feature con sources.dataset == "OpenStreetMap".

Nota operativa (ambiente di sviluppo con proxy di egress): alcune connessioni *nuove* a S3 restituiscono
404 NoSuchBucket in modo intermittente; con connessione persistente le risposte sono stabili.
Per questo, a ogni errore la sessione HTTP viene chiusa e la richiesta ripetuta su connessione nuova.
"""
from __future__ import annotations

import io
import sys
import threading
import time
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

import config

_local = threading.local()


def _session() -> requests.Session:
    s = getattr(_local, "s", None)
    if s is None:
        s = requests.Session()
        s.mount(
            "https://",
            HTTPAdapter(
                max_retries=Retry(total=5, backoff_factor=0.8, status_forcelist=(500, 502, 503, 504), allowed_methods=None),
                pool_maxsize=8,
            ),
        )
        _local.s = s
    return s


def _reset_session() -> None:
    s = getattr(_local, "s", None)
    if s is not None:
        try:
            s.close()
        except Exception:  # noqa: BLE001
            pass
    _local.s = None


def _get(url: str, *, headers=None, params=None, ok=(200, 206), attempts=10) -> requests.Response:
    last = None
    for attempt in range(attempts):
        try:
            r = _session().get(url, headers=headers, params=params, timeout=180)
            if r.status_code in ok:
                return r
            last = f"HTTP {r.status_code}"
        except Exception as e:  # noqa: BLE001
            last = repr(e)
        _reset_session()
        time.sleep(0.4 * (attempt + 1))
    raise IOError(f"{last} for {url}")


def list_files(theme: str, typ: str, release: str = config.RELEASE) -> list[tuple[str, int]]:
    prefix = f"release/{release}/theme={theme}/type={typ}/"
    keys: list[tuple[str, int]] = []
    token = None
    ns = {"s": "http://s3.amazonaws.com/doc/2006-03-01/"}
    while True:
        params = {"list-type": "2", "prefix": prefix}
        if token:
            params["continuation-token"] = token
        r = _get(config.OVERTURE_BUCKET + "/", params=params, ok=(200,))
        root = ET.fromstring(r.content)
        for c in root.findall("s:Contents", ns):
            keys.append((c.find("s:Key", ns).text, int(c.find("s:Size", ns).text)))
        nt = root.find("s:NextContinuationToken", ns)
        if nt is None:
            break
        token = nt.text
    return keys


class RangeFile(io.RawIOBase):
    BLOCK = 512 * 1024

    def __init__(self, url: str, size: int):
        self.url, self.size, self.pos = url, size, 0
        self.blocks: dict[int, bytes] = {}

    def readable(self):  # noqa: D102
        return True

    def seekable(self):  # noqa: D102
        return True

    def tell(self):  # noqa: D102
        return self.pos

    def seek(self, off, whence=0):  # noqa: D102
        self.pos = off if whence == 0 else (self.pos + off if whence == 1 else self.size + off)
        return self.pos

    def _range(self, start: int, end: int) -> bytes:  # end inclusive
        return _get(self.url, headers={"Range": f"bytes={start}-{end}"}).content

    def read(self, n=-1):  # noqa: D102
        if n is None or n < 0:
            n = self.size - self.pos
        end = min(self.pos + n, self.size)
        if end <= self.pos:
            return b""
        n = end - self.pos
        if n >= self.BLOCK:
            data = self._range(self.pos, end - 1)
        else:
            out = bytearray()
            p = self.pos
            while p < end:
                b = p // self.BLOCK
                if b not in self.blocks:
                    s = b * self.BLOCK
                    e = min(s + self.BLOCK, self.size) - 1
                    self.blocks[b] = self._range(s, e)
                blk = self.blocks[b]
                off = p - b * self.BLOCK
                take = min(end - p, len(blk) - off)
                out += blk[off : off + take]
                p += take
            data = bytes(out)
        self.pos = end
        return data

    def readinto(self, b):  # noqa: D102
        d = self.read(len(b))
        b[: len(d)] = d
        return len(d)


def _row_groups_hit(md, ix, bbox) -> list[int]:
    xmin, ymin, xmax, ymax = bbox
    hits = []
    for g in range(md.num_row_groups):
        rg = md.row_group(g)
        st = [rg.column(ix[n]).statistics for n in ("bbox.xmin", "bbox.xmax", "bbox.ymin", "bbox.ymax")]
        if any(s is None or not s.has_min_max for s in st):
            hits.append(g)
            continue
        sxmin, sxmax, symin, symax = st
        if sxmax.max >= xmin and sxmin.min <= xmax and symax.max >= ymin and symin.min <= ymax:
            hits.append(g)
    return hits


def _scan(args):
    key, size, bbox, columns, rfilter = args
    pf = pq.ParquetFile(RangeFile(f"{config.OVERTURE_BUCKET}/{key}", size), pre_buffer=True)
    md = pf.metadata
    ix = {md.schema.column(i).path: i for i in range(md.num_columns)}
    xmin, ymin, xmax, ymax = bbox
    tabs = []
    for g in _row_groups_hit(md, ix, bbox):
        t = pf.read_row_group(g, columns=columns)
        b = t.column("bbox")
        m = pc.and_(
            pc.and_(pc.greater_equal(pc.struct_field(b, "xmax"), xmin), pc.less_equal(pc.struct_field(b, "xmin"), xmax)),
            pc.and_(pc.greater_equal(pc.struct_field(b, "ymax"), ymin), pc.less_equal(pc.struct_field(b, "ymin"), ymax)),
        )
        t = t.filter(m)
        if rfilter is not None and t.num_rows:
            t = t.filter(rfilter)
        if t.num_rows:
            tabs.append(t)
    return tabs


def query(theme, typ, bbox, columns=None, release=config.RELEASE, workers=6, rfilter=None, log=sys.stderr):
    files = list_files(theme, typ, release)
    print(f"[{theme}/{typ}] {len(files)} file, release {release}", file=log, flush=True)
    out = []
    with ThreadPoolExecutor(workers) as ex:
        for tabs in ex.map(_scan, [(k, s, bbox, columns, rfilter) for k, s in files]):
            out.extend(tabs)
    n = sum(t.num_rows for t in out)
    print(f"[{theme}/{typ}] righe nel bbox: {n}", file=log, flush=True)
    return pa.concat_tables(out, promote_options="permissive") if out else None
