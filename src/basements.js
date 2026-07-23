import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { slabFromRing } from './platforms.js';

/** 建物地下量體（推定）：由 OSM 地下層數把建築足跡向下擠出。
 *  量體從 y=0 向下延伸，group.scale.y 直接配合樓層分離。 */
export function buildBasements(data) {
  const geos = [];
  for (const poly of data.polys) {
    try {
      const geo = slabFromRing(poly.p, poly.d);
      geo.translate(0, -poly.d - 0.6, 0); // 頂面貼齊地面下緣
      geos.push(geo);
    } catch { /* 退化多邊形略過 */ }
  }
  const merged = mergeGeometries(geos, false);
  geos.forEach((x) => x.dispose());
  const mesh = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({
    color: 0x8a7355,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  }));
  const group = new THREE.Group();
  group.add(mesh);
  return {
    group,
    setSeparation(s) { group.scale.y = s; },
  };
}
