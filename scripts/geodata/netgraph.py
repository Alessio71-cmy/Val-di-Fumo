"""Grafo pedonale/stradale costruito dai segmenti OSM (Overture) con:
  - snap di un punto sul tratto piu' vicino (nodi virtuali, non solo connettori);
  - Dijkstra con pesi configurabili e tratti vietati;
  - K percorsi semplici piu' brevi (Yen) per individuare varianti (es. sponda opposta del torrente).

Tutte le lunghezze sono calcolate in UTM 32N (EPSG:32632): errore trascurabile alla scala dell'area (< 0.1 %).
"""
from __future__ import annotations

import heapq
import json
import math
from collections import defaultdict
from dataclasses import dataclass, field

from pyproj import Transformer
from shapely.geometry import LineString, Point, shape
from shapely.ops import substring
from shapely.strtree import STRtree

_TO_UTM = Transformer.from_crs(4326, 32632, always_xy=True)
_TO_LL = Transformer.from_crs(32632, 4326, always_xy=True)

WALKABLE = {"path", "footway", "steps", "pedestrian", "track", "service", "cycleway", "unclassified", "residential",
            "living_street", "tertiary", "unknown", "secondary", "primary"}


def to_utm(lon: float, lat: float) -> tuple[float, float]:
    return _TO_UTM.transform(lon, lat)


def to_ll(x: float, y: float) -> tuple[float, float]:
    return _TO_LL.transform(x, y)


STRUCT_FLAGS = ("is_bridge", "is_tunnel")


def iter_pieces(feat: dict):
    """Spezza un segmento Overture in tratti elementari: ai connettori (nodi di rete) e agli estremi degli
    intervalli dei flag strutturali (ponte/galleria), cosi' ogni tratto ha flag e fondo corretti.
    Restituisce dict(a, b, geom(UTM), flags, surface, t0, t1)."""
    p = feat["properties"]
    coords = [to_utm(x, y) for x, y in feat["geometry"]["coordinates"]]
    if len(coords) < 2:
        return
    line = LineString(coords)
    conns = sorted(p.get("conn") or [], key=lambda c: c[1])
    if len(conns) < 2:
        return
    nodes: dict[float, str] = {round(at, 6): cid for cid, at in conns}
    fr = p.get("fr") or []
    for v, t0, t1 in fr:
        if v in STRUCT_FLAGS:
            for t in (t0, t1):
                if t is not None and 0.0 < t < 1.0 and round(t, 6) not in nodes:
                    nodes[round(t, 6)] = f"{p['id']}#{round(t, 6)}"
    ts = sorted(nodes)
    for ta, tb in zip(ts[:-1], ts[1:]):
        if tb <= ta:
            continue
        sub = substring(line, ta, tb, normalized=True)
        if sub.geom_type != "LineString" or len(sub.coords) < 2:
            continue
        m = (ta + tb) / 2
        flags = sorted({v for v, t0, t1 in fr if t0 is None or (t0 - 1e-9 <= m <= t1 + 1e-9)})
        surf = sorted({v for v, t0, t1 in (p.get("sr") or []) if t0 is None or (t0 - 1e-9 <= m <= t1 + 1e-9)})
        yield {"a": nodes[ta], "b": nodes[tb], "geom": sub, "flags": flags, "surface": surf, "t0": ta, "t1": tb}


@dataclass
class Edge:
    u: str
    v: str
    length: float
    geom: LineString  # UTM
    cls: str
    osm: list[str]
    flags: list[str]
    surface: list[str]
    name: str | None
    seg: str
    access: list | None = None
    virtual: bool = False
    parent: int | None = None  # indice dell'edge originale (per edge virtuali)


@dataclass
class Snap:
    edge: int
    d: float  # distanza (m) dal nodo u lungo l'edge
    dist: float  # distanza (m) tra il punto richiesto e l'edge
    x: float
    y: float
    name: str = ""


class Graph:
    def __init__(self) -> None:
        self.edges: list[Edge] = []
        self.adj: dict[str, list[tuple[str, int]]] = defaultdict(list)

    def add(self, e: Edge) -> int:
        i = len(self.edges)
        self.edges.append(e)
        self.adj[e.u].append((e.v, i))
        self.adj[e.v].append((e.u, i))
        return i

    def copy(self) -> "Graph":
        g = Graph()
        g.edges = list(self.edges)
        g.adj = defaultdict(list, {k: list(v) for k, v in self.adj.items()})
        return g

    # -- costruzione ------------------------------------------------------------------------------
    @staticmethod
    def from_segments(path: str, classes: set[str] = WALKABLE) -> "Graph":
        with open(path, encoding="utf-8") as f:
            fc = json.load(f)
        g = Graph()
        for feat in fc["features"]:
            p = feat["properties"]
            if p["cls"] not in classes:
                continue
            for piece in iter_pieces(feat):
                g.add(Edge(piece["a"], piece["b"], piece["geom"].length, piece["geom"], p["cls"], p.get("osm", []), piece["flags"],
                           piece["surface"], p.get("name"), p["id"], p.get("access")))
        return g

    # -- snap ---------------------------------------------------------------------------------------
    def snapper(self) -> "Snapper":
        return Snapper(self)

    def with_snaps(self, snaps: list[Snap]) -> tuple["Graph", dict[int, str]]:
        """Copia del grafo in cui gli edge agganciati sono spezzati in nodi virtuali "v<k>"."""
        g = self.copy()
        vnode: dict[int, str] = {}
        by_edge: dict[int, list[tuple[int, Snap]]] = defaultdict(list)
        for k, s in enumerate(snaps):
            by_edge[s.edge].append((k, s))
            vnode[k] = f"v{k}"
        for ei, lst in by_edge.items():
            e = self.edges[ei]
            g.adj[e.u] = [(v, i) for v, i in g.adj[e.u] if i != ei]
            g.adj[e.v] = [(v, i) for v, i in g.adj[e.v] if i != ei]
            lst.sort(key=lambda t: t[1].d)
            stops = [(e.u, 0.0)] + [(f"v{k}", min(max(s.d, 0.0), e.length)) for k, s in lst] + [(e.v, e.length)]
            for (na, da), (nb, db) in zip(stops[:-1], stops[1:]):
                if db - da > 1e-9:
                    geom = substring(e.geom, da, db)
                else:  # nodo virtuale coincidente con un estremo: edge di lunghezza zero
                    p = e.geom.interpolate(da)
                    geom = LineString([(p.x, p.y), (p.x, p.y)])
                g.add(Edge(na, nb, max(db - da, 0.0), geom, e.cls, e.osm, e.flags, e.surface, e.name, e.seg, e.access, True, ei))
        return g, vnode

    # -- algoritmi ----------------------------------------------------------------------------------
    def dijkstra(self, src: str, dst: str, weight=None, banned: frozenset[int] = frozenset()):
        weight = weight or (lambda e: e.length)
        dist = {src: 0.0}
        prev: dict[str, tuple[str, int]] = {}
        q = [(0.0, src)]
        while q:
            d, u = heapq.heappop(q)
            if u == dst:
                break
            if d > dist.get(u, math.inf):
                continue
            for v, ei in self.adj.get(u, []):
                if ei in banned:
                    continue
                w = weight(self.edges[ei])
                if w is None:
                    continue
                nd = d + w
                if nd < dist.get(v, math.inf):
                    dist[v] = nd
                    prev[v] = (u, ei)
                    heapq.heappush(q, (nd, v))
        if src != dst and dst not in prev:
            return None
        path: list[tuple[int, str, str]] = []  # (edge, from, to)
        n = dst
        while n != src:
            u, ei = prev[n]
            path.append((ei, u, n))
            n = u
        path.reverse()
        return path, dist[dst]

    def yen(self, src: str, dst: str, k: int = 8, weight=None):
        first = self.dijkstra(src, dst, weight)
        if not first:
            return []
        A = [first]
        B: list[tuple[float, int, list]] = []
        cnt = 0
        wf = weight or (lambda e: e.length)
        for _ in range(1, k):
            prev_path, _ = A[-1]
            nodes = [src] + [t for _, _, t in prev_path]
            for i in range(len(prev_path)):
                spur = nodes[i]
                root = prev_path[:i]
                banned: set[int] = set()
                for p, _ in A:
                    if p[:i] == root and len(p) > i:
                        banned.add(p[i][0])
                for n in nodes[:i]:
                    for _, ei in self.adj.get(n, []):
                        banned.add(ei)
                res = self.dijkstra(spur, dst, weight, frozenset(banned))
                if res:
                    tot = root + res[0]
                    L = sum(wf(self.edges[ei]) or 0 for ei, _, _ in tot)
                    if all(tot != p for p, _ in A) and all(tot != b[2] for b in B):
                        cnt += 1
                        heapq.heappush(B, (L, cnt, tot))
            if not B:
                break
            L, _, tot = heapq.heappop(B)
            A.append((tot, L))
        return A

    def path_coords(self, path: list[tuple[int, str, str]]) -> list[tuple[float, float]]:
        """Coordinate UTM concatenate nell'ordine di percorrenza."""
        pts: list[tuple[float, float]] = []
        for ei, a, b in path:
            e = self.edges[ei]
            c = list(e.geom.coords)
            if e.u != a:  # percorso inverso
                c.reverse()
            if pts and math.dist(pts[-1], c[0]) < 1e-6:
                c = c[1:]
            pts.extend((x, y) for x, y in c)
        return pts


class Snapper:
    def __init__(self, g: Graph):
        self.g = g
        self.geoms = [e.geom for e in g.edges]
        self.tree = STRtree(self.geoms)

    def snap(self, lon: float, lat: float, name: str = "", max_dist: float = 200.0, classes: set[str] | None = None) -> Snap:
        x, y = to_utm(lon, lat)
        p = Point(x, y)
        idx = self.tree.query(p.buffer(max_dist))
        best = None
        for i in idx:
            e = self.g.edges[int(i)]
            if classes and e.cls not in classes:
                continue
            d = e.geom.distance(p)
            if best is None or d < best[0]:
                best = (d, int(i))
        if best is None:
            raise ValueError(f"nessun tratto entro {max_dist} m da {name or (lon, lat)}")
        d, i = best
        e = self.g.edges[i]
        along = e.geom.project(p)
        q = e.geom.interpolate(along)
        return Snap(i, along, d, q.x, q.y, name)
