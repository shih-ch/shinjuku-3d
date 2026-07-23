#!/usr/bin/env python3
"""OSM building:levels:underground → 建物地下量體（推定）JSON。

深度＝地下層數 × 3.5m（推定值；OSM 標註為部分建物，非全數）。
© OpenStreetMap contributors (ODbL)

用法: python3 convert_basements.py <bsmt_osm.json> <out.json>
"""
import json
import sys

from convert_indoor import Enu, ORIGIN_LON, ORIGIN_LAT

ENU = Enu(ORIGIN_LON, ORIGIN_LAT)
FLOOR_H = 3.5


def main(src, out_path):
    with open(src, encoding="utf-8") as f:
        osm = json.load(f)
    polys = []
    for el in osm.get("elements", []):
        if el.get("type") != "way" or "geometry" not in el:
            continue
        tags = el.get("tags") or {}
        try:
            levels = float(tags.get("building:levels:underground", "0"))
        except ValueError:
            continue
        if levels <= 0:
            continue
        pts = [ENU.xy(g["lon"], g["lat"]) for g in el["geometry"]]
        if len(pts) < 4 or pts[0] != pts[-1]:
            continue
        polys.append({
            "p": [round(c, 1) for xy in pts[:-1] for c in xy],
            "d": round(levels * FLOOR_H, 1),
        })
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"polys": polys}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"basement polys={len(polys)}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
