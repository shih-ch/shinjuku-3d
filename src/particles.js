import * as THREE from 'three';

const COUNT = 1600;

/** 人流粒子：沿步行網路 link 移動的點群（CPU 更新，配合樓層分離）。 */
export function buildParticles(networkData) {
  const links = networkData.links.filter((l) => (l.d[l.d.length - 1] || 0) > 4);
  // 依長度加權抽樣
  const cum = [];
  let total = 0;
  for (const l of links) { total += l.d[l.d.length - 1]; cum.push(total); }
  const pickLink = () => {
    const r = Math.random() * total;
    let lo = 0; let hi = cum.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m; }
    return lo;
  };

  const state = new Array(COUNT).fill(null).map(() => ({
    li: pickLink(),
    t: Math.random(),
    dir: Math.random() < 0.5 ? 1 : -1,
    speed: 1.1 + Math.random() * 0.9, // m/s
  }));

  const pos = new Float32Array(COUNT * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0x36322a,
    size: 2.6,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 6;
  points.userData.noInk = true;

  function sample(link, frac) {
    const dists = link.d;
    const target = frac * dists[dists.length - 1];
    let i = 1;
    while (i < dists.length - 1 && dists[i] < target) i++;
    const seg = dists[i] - dists[i - 1] || 1;
    const f = (target - dists[i - 1]) / seg;
    const x = link.p[(i - 1) * 2] + (link.p[i * 2] - link.p[(i - 1) * 2]) * f;
    const n = link.p[(i - 1) * 2 + 1] + (link.p[i * 2 + 1] - link.p[(i - 1) * 2 + 1]) * f;
    const e = link.e[i - 1] + (link.e[i] - link.e[i - 1]) * f;
    return [x, n, e];
  }

  return {
    object: points,
    update(dt, sep) {
      for (let i = 0; i < COUNT; i++) {
        const s = state[i];
        const link = links[s.li];
        const len = link.d[link.d.length - 1];
        s.t += (s.dir * s.speed * dt) / len;
        if (s.t > 1 || s.t < 0) {
          s.li = pickLink();
          s.t = Math.random() < 0.5 ? 0 : 1;
          s.dir = s.t === 0 ? 1 : -1;
        }
        const [x, n, e] = sample(links[s.li], Math.min(Math.max(s.t, 0), 1));
        pos[i * 3] = x;
        pos[i * 3 + 1] = e * sep + 1.6;
        pos[i * 3 + 2] = -n;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
