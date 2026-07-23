#!/usr/bin/env python3
"""OSM railway=platform → 月台板 JSON。

深度依 level/layer 標籤對映概略高程（與 rail.json 各線深度一致化）。
閉合 way → 面（擠出板）；未閉合 way → 線（管狀）。relation 取成員外環。
© OpenStreetMap contributors (ODbL)

用法: python3 convert_platforms.py <platforms_osm.json> <out.json>
"""
import json
import sys

from convert_indoor import Enu, ORIGIN_LON, ORIGIN_LAT

ENU = Enu(ORIGIN_LON, ORIGIN_LAT)

LEVEL_ELEV = {0: 0, 1: 6, -1: -6.5, -2: -9, -3: -14, -4: -16,
              -5: -19, -6: -23, -7: -26}


def depth_of(tags):
    for key in ("level", "layer"):
        v = str(tags.get(key, ""))
        try:
            n = int(float(v.split(";")[0]))
        except ValueError:
            continue
        return LEVEL_ELEV.get(n, n * 3.5)
    return 0


def geom_to_pts(geom):
    return [ENU.xy(g["lon"], g["lat"]) for g in geom if g]


def main(src, out_path):
    with open(src, encoding="utf-8") as f:
        osm = json.load(f)

    polys, lines = [], []

    def add(pts, elev):
        if len(pts) < 2:
            return
        closed = pts[0] == pts[-1] and len(pts) >= 4
        flat = [round(c, 1) for xy in (pts[:-1] if closed else pts) for c in xy]
        (polys if closed else lines).append({"p": flat, "e": elev})

    for el in osm.get("elements", []):
        tags = el.get("tags") or {}
        elev = depth_of(tags)
        if el.get("type") == "way" and "geometry" in el:
            add(geom_to_pts(el["geometry"]), elev)
        elif el.get("type") == "relation":
            for m in el.get("members", []):
                if m.get("type") == "way" and m.get("role") in ("outer", "") \
                        and "geometry" in m:
                    add(geom_to_pts(m["geometry"]), elev)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"polys": polys, "lines": lines}, f,
                  ensure_ascii=False, separators=(",", ":"))
    print(f"platform polys={len(polys)} lines={len(lines)} wrote {out_path}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
