import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeLabelSprite } from './rail.js';
import { slabFromRing } from './platforms.js';

const COLOR = 0x1f7a72; // 補完地下道：藍綠色
const AREA_COLOR = 0x4b8f88; // 站廳面

/** OSM 行人地下通道＋站廳補完圖層（依深度分組，配合樓層分離縮放）。 */
export function buildTunnels(data) {
  const root = new THREE.Group();
  const buckets = new Map(); // elev → geometries
  const areaBuckets = new Map();

  for (const area of data.areas || []) {
    try {
      const geo = slabFromRing(area.p, 0.4);
      if (!areaBuckets.has(area.e)) areaBuckets.set(area.e, []);
      areaBuckets.get(area.e).push(geo);
    } catch { /* 退化多邊形略過 */ }
  }

  for (const way of data.ways) {
    const pts = [];
    for (let i = 0; i + 1 < way.p.length; i += 2) {
      pts.push(new THREE.Vector3(way.p[i], 0, -way.p[i + 1]));
    }
    if (pts.length < 2) continue;
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, Math.max(pts.length * 2, 6), 1.7, 5, false);
    if (!buckets.has(way.e)) buckets.set(way.e, []);
    buckets.get(way.e).push(geo);
  }

  const groups = [];
  const bucketGroup = (elev) => {
    let b = groups.find((x) => x.elev === elev);
    if (!b) {
      b = { elev, group: new THREE.Group() };
      b.group.position.y = elev;
      root.add(b.group);
      groups.push(b);
    }
    return b;
  };
  for (const [elev, geos] of buckets) {
    const merged = mergeGeometries(geos, false);
    geos.forEach((x) => x.dispose());
    const mesh = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({
      color: COLOR,
      emissive: COLOR,
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.85,
    }));
    bucketGroup(elev).group.add(mesh);
  }
  for (const [elev, geos] of areaBuckets) {
    const merged = mergeGeometries(geos, false);
    geos.forEach((x) => x.dispose());
    const mesh = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({
      color: AREA_COLOR,
      transparent: true,
      opacity: 0.5,
    }));
    bucketGroup(elev).group.add(mesh);
  }

  // 通道名標籤（挂在對應深度的 group 內、抬升到通道上方）
  for (const lb of data.labels) {
    const bucket = groups.find((b) => b.elev === lb.e) || groups[0];
    if (!bucket) continue;
    const sprite = makeLabelSprite(lb.t, COLOR);
    sprite.position.set(lb.x, 6, -lb.n);
    sprite.scale.multiplyScalar(0.8);
    bucket.group.add(sprite);
  }

  return {
    group: root,
    setSeparation(s) {
      for (const b of groups) b.group.position.y = b.elev * s;
    },
  };
}
