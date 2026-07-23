#!/usr/bin/env python3
"""歩行空間ネットワークデータ（新宿駅周辺 2020年3月版）→ 流動動畫用 JSON。

node.floor（-1, -0.5, 0, 0.5, 1）對映高度；link 兩端樓層不同時視為垂直移動
（樓梯/電扶梯/電梯），沿線內插高度。輸出座標為 ENU（東, 北），高度另存。

用法: python3 convert_network.py <link.geojson> <node.geojson> <out.json>
"""
import json
import math
import sys

from convert_indoor import Enu, ORIGIN_LON, ORIGIN_LAT

ENU = Enu(ORIGIN_LON, ORIGIN_LAT)

# 網路資料 floor → 場景高度（公尺）；0=屋外地上、±0.5=夾層
FLOOR_ELEV = {-1.0: -6.5, -0.5: -3.0, 0.0: -0.1, 0.5: 3.0, 1.0: 0.6}


def main(link_path, node_path, out_path):
    with open(node_path, encoding="utf-8") as f:
        nodes = json.load(f)
    floor_of = {}
    for ft in nodes["features"]:
        p = ft["properties"]
        floor_of[p["node_id"]] = FLOOR_ELEV.get(p.get("floor"), 0.0)

    with open(link_path, encoding="utf-8") as f:
        links = json.load(f)

    out = []
    n_vert = 0
    for ft in links["features"]:
        geom = ft.get("geometry")
        if not geom:
            continue
        if geom["type"] == "LineString":
            coords = geom["coordinates"]
        elif geom["type"] == "MultiLineString":
            coords = [c for part in geom["coordinates"] for c in part]
        else:
            continue
        if len(coords) < 2:
            continue
        p = ft["properties"]
        e0 = floor_of.get(p.get("start_id"), 0.0)
        e1 = floor_of.get(p.get("end_id"), 0.0)
        pts = [ENU.xy(lon, lat) for lon, lat in coords]
        # 沿線累積距離 → 高度內插比例
        dists = [0.0]
        for i in range(1, len(pts)):
            dx = pts[i][0] - pts[i - 1][0]
            dy = pts[i][1] - pts[i - 1][1]
            dists.append(dists[-1] + math.hypot(dx, dy))
        total = dists[-1] or 1.0
        vertical = abs(e1 - e0) > 1.0
        if vertical:
            n_vert += 1
        out.append({
            "p": [round(c, 1) for xy in pts for c in xy],
            "e": [round(e0 + (e1 - e0) * d / total, 2) for d in dists],
            "d": [round(d, 1) for d in dists],
            "v": 1 if vertical else 0,
        })

    data = {"links": out}
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"links={len(out)} vertical={n_vert} wrote {out_path}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3])
