import * as THREE from 'three';

// 端點座標（JSON 已四捨五入到 0.1m，可直接當節點鍵）
const keyOf = (x, n) => `${x},${n}`;

/** 步行網路 → 導航圖（Dijkstra）＋路徑渲染。 */
export function buildNav(networkData, scene) {
  const links = networkData.links;
  const adj = new Map();   // nodeKey → [{to, w, li, rev}]
  const nodePos = new Map(); // nodeKey → {x, n, e}

  links.forEach((l, li) => {
    const n = l.p.length / 2;
    const ax = l.p[0]; const an = l.p[1];
    const bx = l.p[(n - 1) * 2]; const bn = l.p[(n - 1) * 2 + 1];
    const a = keyOf(ax, an); const b = keyOf(bx, bn);
    const len = l.d[l.d.length - 1] || 1;
    const w = len * (l.v ? 1.8 : 1); // 垂直移動加權
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push({ to: b, w, li, rev: false });
    adj.get(b).push({ to: a, w, li, rev: true });
    if (!nodePos.has(a)) nodePos.set(a, { x: ax, n: an, e: l.e[0] });
    if (!nodePos.has(b)) nodePos.set(b, { x: bx, n: bn, e: l.e[l.e.length - 1] });
  });
  const nodes = [...nodePos.entries()].map(([k, v]) => ({ k, ...v }));

  function dijkstra(a, b) {
    const dist = new Map([[a, 0]]);
    const prev = new Map();
    const done = new Set();
    const queue = [[0, a]];
    while (queue.length) {
      let bi = 0;
      for (let i = 1; i < queue.length; i++) if (queue[i][0] < queue[bi][0]) bi = i;
      const [d, u] = queue.splice(bi, 1)[0];
      if (u === b) break;
      if (done.has(u)) continue;
      done.add(u);
      for (const edge of adj.get(u) || []) {
        const nd = d + edge.w;
        if (nd < (dist.get(edge.to) ?? Infinity)) {
          dist.set(edge.to, nd);
          prev.set(edge.to, { from: u, edge });
          queue.push([nd, edge.to]);
        }
      }
    }
    if (!prev.has(b)) return null;
    const segs = [];
    let cur = b;
    while (cur !== a) {
      const { from, edge } = prev.get(cur);
      segs.unshift(edge);
      cur = from;
    }
    return segs;
  }

  // --- 渲染 ---
  const group = new THREE.Group();
  group.userData.noInk = true;
  scene.add(group);
  let markers = { a: null, b: null };
  let routeSegs = null;
  let routePts = null; // [{x, n, e}]
  let sep = 1;

  function marker(color) {
    const m = new THREE.Mesh(
      new THREE.ConeGeometry(6, 16, 12),
      new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.35 }),
    );
    m.rotation.x = Math.PI; // 尖端朝下
    return m;
  }

  function rebuild() {
    group.clear();
    const put = (node, color) => {
      if (!node) return null;
      const m = marker(color);
      m.position.set(node.x, node.e * sep + 12, -node.n);
      group.add(m);
      return m;
    };
    put(markers.a, 0x2e7d32);
    put(markers.b, 0xc62828);
    if (routePts && routePts.length >= 2) {
      const pts = routePts.map((p) => new THREE.Vector3(p.x, p.e * sep + 1.5, -p.n));
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 2.4, 6, false),
        new THREE.MeshLambertMaterial({ color: 0xd7263d, emissive: 0xd7263d, emissiveIntensity: 0.45 }),
      );
      group.add(tube);
    }
  }

  return {
    nodes,
    /** 螢幕座標選最近節點。 */
    pickNode(px, py, camera, width, height) {
      const v = new THREE.Vector3();
      let best = null;
      let bestD = 45; // px 門檻
      for (const node of nodes) {
        v.set(node.x, node.e * sep + 1, -node.n).project(camera);
        if (v.z > 1) continue;
        const sx = (v.x * 0.5 + 0.5) * width;
        const sy = (-v.y * 0.5 + 0.5) * height;
        const d = Math.hypot(sx - px, sy - py);
        if (d < bestD) { bestD = d; best = node; }
      }
      return best;
    },
    setStart(node) { markers.a = node; this.route(); },
    setEnd(node) { markers.b = node; this.route(); },
    clear() {
      markers = { a: null, b: null };
      routeSegs = null;
      routePts = null;
      group.clear();
    },
    route() {
      routeSegs = null;
      routePts = null;
      let info = null;
      if (markers.a && markers.b) {
        routeSegs = dijkstra(markers.a.k, markers.b.k);
        if (routeSegs) {
          routePts = [];
          let total = 0;
          for (const edge of routeSegs) {
            const l = links[edge.li];
            const n = l.p.length / 2;
            const idx = [...Array(n).keys()];
            if (edge.rev) idx.reverse();
            for (const i of idx) {
              routePts.push({ x: l.p[i * 2], n: l.p[i * 2 + 1], e: l.e[i] });
            }
            total += l.d[l.d.length - 1] || 0;
          }
          const elevs = routePts.map((p) => p.e);
          info = {
            meters: Math.round(total),
            minE: Math.min(...elevs),
            maxE: Math.max(...elevs),
            legs: routeSegs.length,
          };
        } else {
          info = { unreachable: true };
        }
      }
      rebuild();
      return info;
    },
    setSeparation(s) { sep = s; rebuild(); },
  };
}
