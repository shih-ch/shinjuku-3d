#!/usr/bin/env python3
"""OSM shop=department_store|mall ＋ 歌舞伎町地標 → 商場・地標標籤 JSON。

© OpenStreetMap contributors (ODbL)
用法: python3 convert_malls.py <osm.json>... <out.json>
"""
import json
import sys

from convert_indoor import Enu, ORIGIN_LON, ORIGIN_LAT

ENU = Enu(ORIGIN_LON, ORIGIN_LAT)

# 非商場雜訊、英文重複條目、細部設施
SKIP = ("100", "ディスクユニオン", "Keith", "K-Star", "Can Do",
        "Lumine 2", "Keio Department Store",
        "出入口", "駐輪場", ";", "唐獅子", "由緒記", "社務所", "拝殿",
        "G1通り", "G2通り")


def main(srcs, out_path):
    elements = []
    for src in srcs:
        with open(src, encoding="utf-8") as f:
            elements += json.load(f).get("elements", [])
    seen = set()
    malls = []
    for el in elements:
        tags = el.get("tags") or {}
        name = tags.get("name", "").strip()
        if not name or name in seen or any(s in name for s in SKIP):
            continue
        if el.get("type") == "node":
            lon, lat = el["lon"], el["lat"]
        elif "center" in el:
            lon, lat = el["center"]["lon"], el["center"]["lat"]
        else:
            continue
        seen.add(name)
        x, n = ENU.xy(lon, lat)
        malls.append({"n": name, "x": x, "y": n})
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"malls": malls}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"malls={len(malls)}")
    for m in malls:
        print(f"  {m['n']}")


if __name__ == "__main__":
    main(sys.argv[1:-1], sys.argv[-1])
