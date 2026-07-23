import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const COLOR = 0x8d8577; // 月台：暖灰

// ENU (東,北) 閉合環 → XZ 平面擠出板；反轉環序讓頂面法線朝上（同 indoor.js 約定）
export function slabFromRing(flat, thickness) {
  const pts = [];
  for (let i = flat.length - 2; i >= 0; i -= 2) {
    pts.push(new THREE.Vector2(flat[i], flat[i + 1]));
  }
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), {
    depth: thickness, bevelEnabled: false,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/** OSM 月台（面→板、線→管），依深度分組配合樓層分離。 */
export function buildPlatforms(data) {
  const root = new THREE.Group();
  const buckets = new Map();
  const push = (elev, geo) => {
    if (!buckets.has(elev)) buckets.set(elev, []);
    // Extrude 無索引、Tube 有索引，統一成非索引才能合併
    buckets.get(elev).push(geo.index ? geo.toNonIndexed() : geo);
  };

  for (const poly of data.polys) {
    try {
      push(poly.e, slabFromRing(poly.p, 1.2));
    } catch { /* 退化多邊形略過 */ }
  }
  for (const line of data.lines) {
    const pts = [];
    for (let i = 0; i + 1 < line.p.length; i += 2) {
      pts.push(new THREE.Vector3(line.p[i], 0.6, -line.p[i + 1]));
    }
    if (pts.length < 2) continue;
    push(line.e, new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(pts), Math.max(pts.length * 2, 6), 1.5, 5, false,
    ));
  }

  const groups = [];
  for (const [elev, geos] of buckets) {
    const merged = mergeGeometries(geos, false);
    geos.forEach((x) => x.dispose());
    const mat = new THREE.MeshLambertMaterial({ color: COLOR });
    const mesh = new THREE.Mesh(merged, mat);
    if (elev < 0) {
      // 地下月台：排在半透明底圖之後渲染，避免被蓋淡
      mat.transparent = true;
      mesh.renderOrder = 2;
    }
    const g = new THREE.Group();
    g.add(mesh);
    g.position.y = elev;
    root.add(g);
    groups.push({ elev, group: g });
  }

  return {
    group: root,
    setSeparation(s) {
      for (const b of groups) b.group.position.y = b.elev * s;
    },
  };
}
