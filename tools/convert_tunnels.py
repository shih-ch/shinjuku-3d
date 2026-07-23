#!/usr/bin/env python3
"""OSM 行人地下通道（tunnel=yes 等）→ 補完圖層 JSON。

只保留正規地下道標籤（tunnel / layer<0 / location=underground）的
highway=footway|pedestrian|corridor|steps 線形——站內細節由屋內地圖涵蓋，不重複。
© OpenStreetMap contributors (ODbL)

用法: python3 convert_tunnels.py <tunnels_osm.json> <out.json>
"""
import json
import math
import sys

from convert_indoor import Enu, ORIGIN_LON, ORIGIN_LAT

ENU = Enu(ORIGIN_LON, ORIGIN_LAT)

HIGHWAYS = {"footway", "pedestrian", "corridor", "steps"}


def depth_of(tags):
    """layer / level 標籤 → 概略深度。"""
    for key in ("level", "layer"):
        v = tags.get(key, "")
        try:
            n = float(v.split(";")[0])
        except ValueError:
            continue
        if n <= -2:
            return -13.5
        if n < 0:
            return -6.5
    return -6.5


def way_len(pts):
    return sum(math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
               for i in range(1, len(pts)))


def main(src, out_path):
    with open(src, encoding="utf-8") as f:
        osm = json.load(f)

    seen = set()
    ways = []
    areas = []  # 站廳等室內面（level<0 的 indoor=corridor|area 閉合面）
    name_best = {}  # name → (length, midpoint, depth) 取最長的一段放標籤
    for el in osm.get("elements", []):
        if el.get("type") != "way" or "geometry" not in el or el["id"] in seen:
            continue
        seen.add(el["id"])
        tags = el.get("tags") or {}
        if tags.get("highway") not in HIGHWAYS:
            if tags.get("indoor") in ("corridor", "area"):
                pts = [ENU.xy(g["lon"], g["lat"]) for g in el["geometry"]]
                if len(pts) >= 4 and pts[0] == pts[-1]:
                    areas.append({
                        "p": [round(c, 1) for xy in pts[:-1] for c in xy],
                        "e": depth_of(tags),
                    })
            continue
        is_tunnel = (
            tags.get("tunnel") in ("yes", "building_passage")
            or tags.get("location") == "underground"
            or (tags.get("layer", "").startswith("-"))
        )
        if not is_tunnel:
            continue
        pts = [ENU.xy(g["lon"], g["lat"]) for g in el["geometry"]]
        if len(pts) < 2:
            continue
        d = depth_of(tags)
        ways.append({"p": [round(c, 1) for xy in pts for c in xy], "e": d})
        name = tags.get("name", "")
        if name:
            length = way_len(pts)
            mid = pts[len(pts) // 2]
            if name not in name_best or name_best[name][0] < length:
                name_best[name] = (length, mid, d)

    def label_ok(name):
        # 排除月台／站內樓層等雜訊，只留通道名
        if ";" in name or "ホーム" in name or "番線" in name:
            return False
        if name.endswith("駅"):
            return False
        return True

    labels = [
        {"t": name, "x": round(mid[0], 1), "n": round(mid[1], 1), "e": d}
        for name, (length, mid, d) in name_best.items()
        if length >= 80 and label_ok(name)
    ]
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"ways": ways, "areas": areas, "labels": labels}, f,
                  ensure_ascii=False, separators=(",", ":"))
    print(f"tunnel ways={len(ways)} areas={len(areas)} labels={len(labels)}")
    for l in labels:
        print(f"  label: {l['t']}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
