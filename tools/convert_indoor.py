#!/usr/bin/env python3
"""新宿駅周辺屋内地図オープンデータ (Shapefile, JGD2011 經緯度) → 局部 ENU 座標 JSON。

原點 (ORIGIN_LON, ORIGIN_LAT) 與 webapp 中 3D Tiles 的 ENU 對齊原點相同，
兩邊都以 WGS84 橢球 ECEF→ENU 轉換，確保站內模型與 PLATEAU 模型對位。

用法: python3 convert_indoor.py <shapefile_dir> <out_json>
"""
import json
import math
import sys

import shapefile  # pyshp

ORIGIN_LON = 139.7005
ORIGIN_LAT = 35.6900

# WGS84
A = 6378137.0
E2 = 6.69437999014e-3

LEVELS = [
    # (檔名前綴, 顯示名, 排序用 ordinal, 是否屋外)
    ("B3", "地下3階", -3, False),
    ("B2", "地下2階", -2, False),
    ("B1", "地下1階", -1, False),
    ("0", "1F屋外", 0, True),
    ("1", "1階", 0, False),
    ("2", "2階", 1, False),
    ("2out", "2F屋外デッキ", 1, True),
    ("3", "3階", 2, False),
    ("3out", "3F屋外デッキ", 2, True),
    ("4", "4階", 3, False),
    ("4out", "4F屋外デッキ", 3, True),
]


def ecef(lon, lat, h=0.0):
    lam, phi = math.radians(lon), math.radians(lat)
    sp, cp = math.sin(phi), math.cos(phi)
    n = A / math.sqrt(1 - E2 * sp * sp)
    return (
        (n + h) * cp * math.cos(lam),
        (n + h) * cp * math.sin(lam),
        (n * (1 - E2) + h) * sp,
    )


class Enu:
    def __init__(self, lon0, lat0):
        self.o = ecef(lon0, lat0)
        lam, phi = math.radians(lon0), math.radians(lat0)
        sl, cl = math.sin(lam), math.cos(lam)
        sp, cp = math.sin(phi), math.cos(phi)
        self.e = (-sl, cl, 0.0)
        self.n = (-sp * cl, -sp * sl, cp)

    def xy(self, lon, lat):
        p = ecef(lon, lat)
        d = (p[0] - self.o[0], p[1] - self.o[1], p[2] - self.o[2])
        east = sum(a * b for a, b in zip(self.e, d))
        north = sum(a * b for a, b in zip(self.n, d))
        return round(east, 2), round(north, 2)


ENU = Enu(ORIGIN_LON, ORIGIN_LAT)


def signed_area(ring):
    s = 0.0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]
        x2, y2 = ring[i + 1]
        s += x1 * y2 - x2 * y1
    return s / 2.0


def point_in_ring(pt, ring):
    x, y = pt
    inside = False
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]
        x2, y2 = ring[i + 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def shape_to_polys(shape):
    """ESRI polygon → [[exterior, hole, ...], ...]，座標轉 ENU。"""
    pts = [ENU.xy(x, y) for x, y in shape.points]
    parts = list(shape.parts) + [len(pts)]
    rings = []
    for i in range(len(parts) - 1):
        ring = pts[parts[i]:parts[i + 1]]
        if len(ring) >= 4:
            rings.append(ring)
    exteriors, holes = [], []
    for r in rings:
        (holes if signed_area(r) > 0 else exteriors).append(r)  # ESRI: 外環順時針
    if not exteriors:
        exteriors, holes = rings, []
    polys = [[ext] for ext in exteriors]
    for h in holes:
        for poly in polys:
            if point_in_ring(h[0], poly[0]):
                poly.append(h)
                break
        else:
            polys.append([h])
    # 去掉閉合重複點、攤平座標為 [x1,y1,x2,y2,...]
    out = []
    for poly in polys:
        rr = []
        for ring in poly:
            if ring[0] == ring[-1]:
                ring = ring[:-1]
            rr.append([c for xy in ring for c in xy])
        out.append(rr)
    return out


def read_layer(base, name, fields_wanted):
    try:
        r = shapefile.Reader(f"{base}_{name}", encoding="utf-8")
    except Exception:
        return []
    fields = [f[0] for f in r.fields[1:]]
    out = []
    for i in range(len(r)):
        try:
            sr = r.shapeRecord(i)
        except shapefile.ShapefileException:
            continue  # 空幾何記錄
        if sr.shape.shapeTypeName not in ("POLYGON", "POLYGONZ", "POLYLINE", "POLYLINEZ"):
            continue
        rec = dict(zip(fields, sr.record))
        if sr.shape.shapeTypeName.startswith("POLYGON"):
            geo = shape_to_polys(sr.shape)
        else:  # polyline: parts → line strings
            pts = [ENU.xy(x, y) for x, y in sr.shape.points]
            parts = list(sr.shape.parts) + [len(pts)]
            geo = [[c for xy in pts[parts[i]:parts[i + 1]] for c in xy]
                   for i in range(len(parts) - 1)]
        item = {"p": geo}
        for k_src, k_dst in fields_wanted:
            v = rec.get(k_src, "")
            if v not in ("", None):
                item[k_dst] = v
        out.append(item)
    return out


def main(src_dir, out_path):
    data = {"origin": [ORIGIN_LON, ORIGIN_LAT], "levels": []}
    for prefix, name, ordinal, outdoor in LEVELS:
        base = f"{src_dir}/ShinjukuTerminal_{prefix}"
        level = {
            "id": prefix,
            "name": name,
            "ordinal": ordinal,
            "outdoor": outdoor,
            "floors": read_layer(base, "Floor", []),
            "spaces": read_layer(base, "Space",
                                 [("category", "c"), ("toll", "t"), ("name", "n")]),
            "fixtures": read_layer(base, "Fixture", [("category", "c")]),
            "openings": read_layer(base, "Opening", [("category", "c")]),
        }
        n = {k: len(level[k]) for k in ("floors", "spaces", "fixtures", "openings")}
        print(f"{prefix:6s} {name:10s} {n}")
        data["levels"].append(level)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {out_path}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
