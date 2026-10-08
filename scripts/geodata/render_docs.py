"""Riempie i blocchi generati dei documenti (<!-- BEGIN:nome --> ... <!-- END:nome -->) leggendo i JSON prodotti dalla
pipeline, cosi' le coordinate nei documenti non vengono mai ricopiate a mano. Genera anche docs/SOURCES.md dal registro
src/content/sources.json.

Uso: python render_docs.py
"""
from __future__ import annotations

import datetime as dt
import json
import math
import os
import re

import config

DOCS = os.path.join(config.ROOT, "docs")
GEO = os.path.join(config.OUT_DIR, "geo")


def load(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def md_table(head: list[str], rows: list[list]) -> str:
    out = ["| " + " | ".join(head) + " |", "|" + "|".join("---" for _ in head) + "|"]
    for r in rows:
        out.append("| " + " | ".join(str(c).replace("|", "/") for c in r) + " |")
    return "\n".join(out)


def block_points() -> str:
    pts = load(os.path.join(GEO, "points.json"))["points"]
    rows = []
    for k, p in sorted(pts.items(), key=lambda t: (t[1].get("chainOut") if t[1].get("offOutM", 9999) < 1000 else 99999, t[0])):
        on = p.get("offOutM", 9999) < 1000
        rows.append([f"`{k}`", p.get("name") or "—", f"{p['lat']:.5f}", f"{p['lon']:.5f}", (f"{p['eleDem']:.0f}" if p.get("eleDem") is not None else "—"),
                     ", ".join(f"`{o}`" for o in p["osm"][:2]), p.get("osmUpdated") or "—",
                     f"{p['chainOut']} m" if on else "—", f"{p['offOutM']} m" if on else "—"])
    return md_table(["ID", "Nome in OSM", "Lat", "Lon", "Quota DEM (m)", "ID OSM", "Ult. modifica OSM", "Progressiva andata", "Distanza dalla traccia"], rows)


def block_routes() -> str:
    R = load(os.path.join(GEO, "routes.json"))["routes"]
    rows = []
    for rid, r in R.items():
        rng = r.get("osmEditedRange") or [None, None]
        rows.append([f"`{rid}`", r["name"], f"{r['lengthM'] / 1000:.2f} km", f"+{r['ascentM']} / −{r['descentM']} m",
                     f"{r['minEleM']}–{r['maxEleM']} m", f"{round(r['toblerMin'])} min", f"{rng[0]} … {rng[1]}"])
    return md_table(["ID", "Nome", "Lunghezza", "Dislivello (stima DEM)", "Quote", "Tempo nominale (modello)", "Modifiche OSM (min … max)"], rows)


def block_validation() -> str:
    V = load(os.path.join(GEO, "validation.json"))["checks"]
    rows = []
    for c in V:
        if c["check"].startswith("snap:"):
            rows.append([c["check"], f"{c['distM']} m", f"≤ soglia", "OK" if c["ok"] else "NO", f"classe {c['edgeClass']}"])
        else:
            exp = c.get("expected")
            rows.append([c["check"], c.get("value"), f"{exp[0]:.0f}–{exp[1]:.0f}" if exp else "—", "OK" if c["ok"] else "NO", c.get("note", "")])
    return md_table(["Controllo", "Valore", "Atteso (fonti secondarie)", "Esito", "Nota"], rows)


def block_bridges() -> str:
    R = load(os.path.join(GEO, "routes.json"))
    rows = [[f"{b['fromM']} m", f"{b['lengthM']} m", f"{b['lat']:.5f}, {b['lon']:.5f}", ", ".join(b["osm"][:2])] for b in R["bridges"]]
    return md_table(["Progressiva andata", "Lunghezza", "Posizione", "ID OSM"], rows)


def block_junctions() -> str:
    R = load(os.path.join(GEO, "routes.json"))
    rows = []
    for j in R["junctions"]:
        rows.append([f"{j['chainM']} m", f"{j['lat']:.5f}, {j['lon']:.5f}",
                     "; ".join(f"{b['dir']} {b['cls']} {b['lengthM']} m" for b in j["branches"])])
    return md_table(["Progressiva andata", "Posizione", "Rami che si staccano dalla traccia (direzione, tipo, lunghezza)"], rows)


def block_sun() -> str:
    try:
        from zoneinfo import ZoneInfo

        from astral import LocationInfo, sun
    except Exception:  # noqa: BLE001
        return "_(astral non installato: blocco non rigenerato)_"
    H = load(os.path.join(GEO, "horizon.json"))["points"]
    pts = load(os.path.join(GEO, "points.json"))["points"]
    tz = ZoneInfo("Europe/Rome")
    date = dt.date(2026, 10, 9)

    def hz(p, az):
        e = p["elev"]
        i = az / p["azStepDeg"]
        i0 = int(math.floor(i)) % len(e)
        i1 = (i0 + 1) % len(e)
        f = i - math.floor(i)
        return e[i0] * (1 - f) + e[i1] * f

    names = {"park-boazzo-centrale": "Parcheggio Centrale di Boazzo (Leno)", "park-dam": "Parcheggio diga Malga Bissina",
             "malga-breguzzo": "Malga Breguzzo", "rifugio-val-di-fumo": "Rifugio Val di Fumo"}
    rows = []
    for k, p in H.items():
        obs = LocationInfo(k, "IT", "Europe/Rome", p["lat"], p["lon"]).observer
        s = sun.sun(obs, date=date, tzinfo=tz)
        dusk = sun.dusk(obs, date=date, tzinfo=tz, depression=6)
        base = dt.datetime(date.year, date.month, date.day, tzinfo=tz)
        wins, cur = [], None
        for m in range(0, 24 * 60, 2):
            t = base + dt.timedelta(minutes=m)
            el, az = sun.elevation(obs, t), sun.azimuth(obs, t)
            lit = el > 0 and el > hz(p, az)
            if lit and cur is None:
                cur = t
            if not lit and cur is not None:
                wins.append((cur, t))
                cur = None
        rows.append([names[k], f"{s['sunrise']:%H:%M}", f"{s['sunset']:%H:%M}", f"{dusk:%H:%M}",
                     ", ".join(f"{a:%H:%M}–{b:%H:%M}" for a, b in wins) or "mai"])
    return md_table(["Punto", "Alba (CEST)", "Tramonto (CEST)", "Fine crepuscolo civile", "Sole diretto stimato dal rilievo (±15–20 min)"], rows)


BLOCKS = {"points": block_points, "routes": block_routes, "validation": block_validation, "bridges": block_bridges,
          "junctions": block_junctions, "sun": block_sun}


def fill(path: str) -> None:
    with open(path, encoding="utf-8") as f:
        text = f.read()
    for name, fn in BLOCKS.items():
        pat = re.compile(rf"(<!-- BEGIN:{name} -->)\n?(.*?)\n?(<!-- END:{name} -->)", re.S)
        if pat.search(text):
            text = pat.sub(lambda m: m.group(1) + "\n" + fn() + "\n" + m.group(3), text)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    print("aggiornato", os.path.relpath(path, config.ROOT))


def render_sources() -> None:
    src = load(os.path.join(config.ROOT, "src", "content", "sources.json"))
    mode = {"direct": "letta direttamente", "search-summary": "solo sintesi dello strumento di ricerca (pagina non aperta)",
            "blocked": "NON consultabile (host bloccato dall'ambiente di sviluppo)"}
    groups = [("open-data", "Dati aperti usati direttamente"), ("computed", "Riferimenti di calcolo"),
              ("official", "Fonti ufficiali richieste dal brief"), ("secondary", "Altre fonti richieste dal brief"),
              ("secondary-search", "Fonti secondarie (lette tramite WebSearch)")]
    out = ["# Documentazione delle fonti",
           "",
           "> File **generato** da `src/content/sources.json` (`python scripts/geodata/render_docs.py`). Non modificare a mano.",
           "",
           "**Come leggere questo elenco.** Il livello di *attendibilita'* e' un giudizio editoriale (alta/media/bassa) sul tipo di fonte, non una",
           "garanzia. Le fonti marcate *sintesi di ricerca* sono state lette solo tramite il riassunto prodotto dallo strumento di ricerca: le pagine",
           "originali **non sono state aperte** e ogni dato va riverificato alla fonte. Le quattro fonti iniziali del brief erano **bloccate**",
           "dalla policy di rete dell'ambiente di sviluppo e **non sono state consultate**.",
           ""]
    for kind, title in groups:
        items = [s for s in src if s["kind"] == kind]
        if not items:
            continue
        out += [f"## {title}", ""]
        for s in items:
            out += [f"### {s['title']}",
                    f"- **ID**: `{s['id']}`  ·  **Editore**: {s['publisher']}",
                    f"- **URL**: <{s['url']}>",
                    f"- **Licenza**: {s['license']}",
                    f"- **Data di consultazione**: {s['accessedAt']}  ·  **Modalita'**: {mode[s['accessMode']]}  ·  **Attendibilita'**: {s['reliability']}",
                    f"- **Usata per**: {s['usedFor']}"]
            if s["notes"]:
                out.append(f"- **Note**: {s['notes']}")
            out.append("")
    with open(os.path.join(DOCS, "SOURCES.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    print("generato docs/SOURCES.md")


if __name__ == "__main__":
    for fn in sorted(os.listdir(DOCS)):
        if fn.endswith(".md") and fn != "SOURCES.md":
            fill(os.path.join(DOCS, fn))
    render_sources()
