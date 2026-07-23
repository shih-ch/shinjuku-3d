#!/usr/bin/env python3
"""OSM 地鐵/車站出入口節點 → 出入口編號標籤 JSON。

© OpenStreetMap contributors (ODbL)
用法: python3 convert_exits.py <exits_osm.json> <out.json>
"""
import json
import sys

from convert_indoor import Enu, ORIGIN_LON, ORIGIN_LAT

ENU = Enu(ORIGIN_LON, ORIGIN_LAT)


def main(src, out_path):
    with open(src, encoding="utf-8") as f:
        osm = json.load(f)
    exits = []
    for el in osm.get("elements", []):
        if el.get("type") != "node":
            continue
        tags = el.get("tags") or {}
        ref = tags.get("ref", "").strip()
        if not ref or "閉鎖" in ref:
            continue
        x, n = ENU.xy(el["lon"], el["lat"])
        exits.append({"r": ref, "x": x, "n": n})
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"exits": exits}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"exits={len(exits)}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
