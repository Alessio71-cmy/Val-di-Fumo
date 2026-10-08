"""Tratti in auto: distanza stradale (da rete OSM) e tempo STIMATO.

Il tempo e' un modello (distanza / velocita' media per classe di strada), NON un dato rilevato e non include traffico,
cantieri, code, soste. Va sempre riverificato con il navigatore stradale (il pulsante 'Apri navigazione stradale' dell'app).

Output: public/data/geo/drive.json
Uso:    python build_drive.py        (richiede rete verso S3/Overture)
"""
from __future__ import annotations

import heapq
import json
import math
import os
from collections import defaultdict
from datetime import datetime, timezone

import pyarrow.compute as pc
from shapely import wkb
from shapely.ops import substring

import config
import netgraph as ng
import overture

OUT = os.path.join(config.OUT_DIR, "geo")
CLASSES = ["motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential", "living_street", "service"]
# velocita' medie ASSUNTE (km/h) lungo il percorso, comprensive di curve, centri abitati e rallentamenti ordinari
AVG_KMH = {"motorway": 90, "trunk": 70, "primary": 55, "secondary": 50, "tertiary": 38, "unclassified": 28, "residential": 22,
           "living_street": 12, "service": 18}
BBOX = (10.48, 45.88, 11.30, 46.12)


def main() -> None:
    cols = ["id", "names", "subtype", "class", "connectors", "routes", "geometry", "bbox"]
    flt = (pc.field("subtype") == "road") & pc.field("class").isin(CLASSES)
    t = overture.query("transportation", "segment", BBOX, columns=cols, rfilter=flt)
    edges = []
    adj = defaultdict(list)
    pos = {}
    for r in t.to_pylist():
        g = wkb.loads(r["geometry"])
        conns = sorted(r["connectors"] or [], key=lambda c: c["at"])
        if len(conns) < 2:
            continue
        ref = next((rt["ref"] for rt in (r.get("routes") or []) if rt.get("ref")), None)
        nm = ((r.get("names") or {}) or {}).get("primary")
        utm = ng.LineString([ng.to_utm(x, y) for x, y in g.coords])
        for a, b in zip(conns[:-1], conns[1:]):
            if b["at"] <= a["at"]:
                continue
            sub = substring(utm, a["at"], b["at"], normalized=True)
            if sub.geom_type != "LineString":
                continue
            i = len(edges)
            edges.append({"u": a["connector_id"], "v": b["connector_id"], "len": sub.length, "cls": r["class"], "label": ref or nm or f"({r['class']})"})
            adj[a["connector_id"]].append((b["connector_id"], i))
            adj[b["connector_id"]].append((a["connector_id"], i))
            pos.setdefault(a["connector_id"], sub.coords[0])
            pos.setdefault(b["connector_id"], sub.coords[-1])
    print(f"rete stradale: {len(edges)} edge, {len(pos)} nodi")

    def nearest(lon, lat):
        px, py = ng.to_utm(lon, lat)
        best, bd = None, 1e18
        for n, (x, y) in pos.items():
            d = (x - px) ** 2 + (y - py) ** 2
            if d < bd:
                best, bd = n, d
        return best, math.sqrt(bd)

    def route(s, tn):
        dist = {s: 0.0}
        prev = {}
        q = [(0.0, s)]
        while q:
            d, u = heapq.heappop(q)
            if u == tn:
                break
            if d > dist.get(u, 1e18):
                continue
            for v, ei in adj[u]:
                e = edges[ei]
                nd = d + e["len"] / (AVG_KMH[e["cls"]] / 3.6)
                if nd < dist.get(v, 1e18):
                    dist[v] = nd
                    prev[v] = (u, ei)
                    heapq.heappush(q, (nd, v))
        path = []
        n = tn
        while n != s:
            u, ei = prev[n]
            path.append(ei)
            n = u
        return path[::-1]

    pts = json.load(open(os.path.join(OUT, "points.json"), encoding="utf-8"))["points"]
    legs_def = {
        "pergine-boazzo": ("pergine", "park-boazzo-centrale"),
        "boazzo-dam": ("park-boazzo-centrale", "park-dam"),
        "dam-pergine": ("park-dam", "pergine"),
    }
    legs = {}
    for lid, (a, b) in legs_def.items():
        na, da = nearest(pts[a]["lon"], pts[a]["lat"])
        nb, db = nearest(pts[b]["lon"], pts[b]["lat"])
        path = route(na, nb)
        dist = sum(edges[i]["len"] for i in path)
        secs = sum(edges[i]["len"] / (AVG_KMH[edges[i]["cls"]] / 3.6) for i in path)
        roads: list[list] = []
        for i in path:
            lab = edges[i]["label"]
            if roads and roads[-1][0] == lab:
                roads[-1][1] += edges[i]["len"]
            else:
                roads.append([lab, edges[i]["len"]])
        roads = [{"label": l, "km": round(L / 1000, 1)} for l, L in roads if L >= 1500]
        mins = secs / 60.0
        legs[lid] = {"from": a, "to": b, "snapM": [round(da), round(db)], "distanceKm": round(dist / 1000, 1),
                     "modelMinutes": round(mins), "roads": roads}
        print(f"{lid:16s} {dist / 1000:5.1f} km  modello {mins:5.0f} min  snap {da:.0f}/{db:.0f} m  {[(r['label'], r['km']) for r in roads]}")

    # tempo nominale prudenziale: modello +10% (partenza mattutina, traffico urbano, passaggi lenti) arrotondato a 5 min,
    # con intervallo -15% / +30%
    for lg in legs.values():
        nom = int(math.ceil(lg["modelMinutes"] * 1.10 / 5.0) * 5)
        lg["nominalMinutes"] = nom
        lg["rangeMinutes"] = [int(math.floor(nom * 0.85 / 5.0) * 5), int(math.ceil(nom * 1.30 / 5.0) * 5)]
        lg["basis"] = "estimated"

    with open(os.path.join(OUT, "drive.json"), "w", encoding="utf-8") as f:
        json.dump({"meta": {"generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "osmRelease": config.RELEASE,
                            "avgKmhAssumed": AVG_KMH,
                            "note": "Stime da modello: distanza OSM / velocita' media per classe. Non include traffico. Verificare con il navigatore."},
                   "legs": legs}, f, ensure_ascii=False, indent=1)
    print("OK drive.json")


if __name__ == "__main__":
    main()
