#!/usr/bin/env python3
"""OSM Overpass 鐵道資料 → 各營運商路線 JSON。

高度為各線在新宿站一帶的概略深度（視覺化用，非實測）。
© OpenStreetMap contributors (ODbL)

用法: python3 convert_rail.py <rail_osm.json> <out.json>
"""
import json
import sys

from convert_indoor import Enu, ORIGIN_LON, ORIGIN_LAT

ENU = Enu(ORIGIN_LON, ORIGIN_LAT)

# 依序比對（前面優先）：match 子字串 → 路線設定
LINES = [
    ("山手貨物線", dict(key="saikyo", label="埼京線・湘南新宿ライン", color=0x00a88f, elev=0, op="JR東日本")),
    ("JR埼京線", dict(key="saikyo")),
    ("湘南新宿ライン", dict(key="saikyo")),
    ("山手線", dict(key="yamanote", label="山手線", color=0xb1cb39, elev=0, op="JR東日本")),
    ("中央緩行線", dict(key="sobu", label="中央・総武線各駅停車", color=0xffd400, elev=0, op="JR東日本")),
    ("中央・総武緩行線", dict(key="sobu")),
    ("中央本線", dict(key="chuo", label="中央線快速", color=0xf15a22, elev=0, op="JR東日本")),
    ("JR中央線", dict(key="chuo")),
    ("小田急", dict(key="odakyu", label="小田急小田原線", color=0x2288cc, elev=0, op="小田急電鉄")),
    ("京王新線", dict(key="keio_new", label="京王新線", color=0x3aa655, elev=-18, op="京王電鉄")),
    ("京王電鉄京王線", dict(key="keio", label="京王線", color=0xcc0033, elev=-8, op="京王電鉄")),
    ("丸ノ内線", dict(key="marunouchi", label="丸ノ内線", color=0xf62e36, elev=-8, op="東京メトロ")),
    ("副都心線", dict(key="fukutoshin", label="副都心線", color=0x9c5e31, elev=-30, op="東京メトロ")),
    ("都営地下鉄新宿線", dict(key="toei_shinjuku", label="都営新宿線", color=0x6cbb5a, elev=-18, op="都営地下鉄")),
    ("都営地下鉄大江戸線", dict(key="oedo", label="都営大江戸線", color=0xb6007a, elev=-26, op="都営地下鉄")),
    ("西武新宿線", dict(key="seibu", label="西武新宿線", color=0x2ea8df, elev=0, op="西武鉄道")),
]


def main(src, out_path):
    with open(src, encoding="utf-8") as f:
        osm = json.load(f)

    lines = {}
    defs = {}
    for _, conf in LINES:
        if "label" in conf:
            defs[conf["key"]] = conf
    unmatched = set()

    for el in osm.get("elements", []):
        if el.get("type") != "way" or "geometry" not in el:
            continue
        name = (el.get("tags") or {}).get("name", "")
        key = None
        for pat, conf in LINES:
            if pat in name:
                key = conf["key"]
                break
        if key is None:
            unmatched.add(name or "(無名)")
            continue
        pts = [ENU.xy(g["lon"], g["lat"]) for g in el["geometry"]]
        if len(pts) < 2:
            continue
        lines.setdefault(key, []).append([round(c, 1) for xy in pts for c in xy])

    out = []
    for key, ways in lines.items():
        d = defs[key]
        out.append({
            "key": key,
            "label": d["label"],
            "color": d["color"],
            "elev": d["elev"],
            "operator": d["op"],
            "ways": ways,
        })
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"lines": out}, f, ensure_ascii=False, separators=(",", ":"))
    for name in sorted(unmatched):
        print(f"  unmatched: {name}")
    print(f"lines={len(out)} wrote {out_path}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
