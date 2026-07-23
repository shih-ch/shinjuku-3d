import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LEVEL_ELEV, SPACE_CATS, TOLL_COLORS, PALETTE } from './config.js';

// coords: [x1,y1,x2,y2,...]（ENU 公尺，y=北）→ THREE.Shape 平面
// Shape 建在 (東, 北) 平面，rotateX(-90°) 後 z = -北 = 南，與 PLATEAU tiles 座標一致。
// 反轉頂點順序讓外環維持 CCW（ESRI 外環為 CW），保持頂面法線朝上。
function ringToPts(flat) {
  const pts = [];
  for (let i = flat.length - 2; i >= 0; i -= 2) {
    pts.push(new THREE.Vector2(flat[i], flat[i + 1]));
  }
  return pts;
}

function polysToShapes(polys) {
  const shapes = [];
  for (const rings of polys) {
    const shape = new THREE.Shape(ringToPts(rings[0]));
    for (let i = 1; i < rings.length; i++) {
      shape.holes.push(new THREE.Path(ringToPts(rings[i])));
    }
    shapes.push(shape);
  }
  return shapes;
}

function extrude(polys, depth) {
  const shapes = polysToShapes(polys);
  const geo = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false });
  // ExtrudeGeometry 在 XY 平面擠出 +Z：轉成 XZ 平面、+Y 向上
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/**
 * 依樓層建立室內模型。
 * 回傳 { group, levels: [{id, name, group, baseElev}], setColorMode, setSeparation }
 */
export function buildIndoor(data) {
  const root = new THREE.Group();
  const levels = [];
  const spaceMeshes = []; // {mesh, catGeos: Map<cat, geo>, level}

  for (const lv of data.levels) {
    const g = new THREE.Group();
    g.name = `level-${lv.id}`;
    const baseElev = LEVEL_ELEV[lv.id] ?? 0;

    // --- 樓板 ---
    const floorPolys = lv.floors.flatMap((f) => f.p);
    if (floorPolys.length) {
      const geo = extrude(floorPolys, 0.45);
      geo.translate(0, -0.45, 0);
      const mat = new THREE.MeshLambertMaterial({
        color: PALETTE.floorPlate,
        transparent: true,
        opacity: lv.outdoor ? 0.55 : 0.82,
      });
      const mesh = new THREE.Mesh(geo, mat);
      g.add(mesh);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo, 30),
        new THREE.LineBasicMaterial({ color: PALETTE.floorEdge, transparent: true, opacity: 0.35 }),
      );
      edges.userData.noInk = true;
      g.add(edges);
    }

    // --- 空間（依 category 合併）---
    const byCat = new Map();
    for (const sp of lv.spaces) {
      const cat = SPACE_CATS[sp.c] ? sp.c : 'default';
      const conf = SPACE_CATS[cat];
      const geo = extrude(sp.p, conf.h);
      const paid = String(sp.t) === '1';
      const key = `${cat}|${paid ? 1 : 0}`;
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key).push(geo);
    }
    for (const [key, geos] of byCat) {
      const [cat, paid] = key.split('|');
      const merged = mergeGeometries(geos, false);
      geos.forEach((x) => x.dispose());
      const mat = new THREE.MeshLambertMaterial({ color: SPACE_CATS[cat].color });
      const mesh = new THREE.Mesh(merged, mat);
      mesh.userData = { cat, paid: paid === '1' };
      g.add(mesh);
      spaceMeshes.push(mesh);
    }

    // --- 固定設置物（牆、柱）---
    const fixPolys = lv.fixtures.flatMap((f) => f.p);
    if (fixPolys.length) {
      const geo = extrude(fixPolys, 1.4);
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshLambertMaterial({ color: PALETTE.fixture }),
      );
      g.add(mesh);
    }

    // --- 出入口（洋紅線，同凡例）---
    if (lv.openings.length) {
      const verts = [];
      for (const op of lv.openings) {
        for (const line of op.p) {
          // polyline: 連續線段拆成 segment pair
          const flat = Array.isArray(line[0]) ? line[0] : line;
          for (let i = 0; i + 3 < flat.length; i += 2) {
            verts.push(flat[i], 0.6, -flat[i + 1], flat[i + 2], 0.6, -flat[i + 3]);
          }
        }
      }
      if (verts.length) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        const seg = new THREE.LineSegments(
          geo,
          new THREE.LineBasicMaterial({ color: PALETTE.opening }),
        );
        seg.userData.noInk = true;
        g.add(seg);
      }
    }

    g.position.y = baseElev;
    root.add(g);
    levels.push({ id: lv.id, name: lv.name, outdoor: lv.outdoor, group: g, baseElev });
  }

  function setSeparation(s) {
    for (const lv of levels) {
      lv.group.position.y = lv.baseElev * s;
    }
  }

  function setColorMode(mode) {
    for (const mesh of spaceMeshes) {
      if (mode === 'toll') {
        mesh.material.color.setHex(mesh.userData.paid ? TOLL_COLORS.paid : TOLL_COLORS.free);
      } else {
        mesh.material.color.setHex(SPACE_CATS[mesh.userData.cat].color);
      }
    }
  }

  return { group: root, levels, setSeparation, setColorMode };
}
