import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function makeLabelSprite(text, colorHex) {
  const pad = 14;
  const font = 'bold 30px "Noto Sans JP", "Hiragino Sans", sans-serif';
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
  const h = 46;
  canvas.width = w * 2;
  canvas.height = h * 2;
  const c = canvas.getContext('2d');
  c.scale(2, 2);
  c.font = font;
  const color = `#${colorHex.toString(16).padStart(6, '0')}`;
  c.fillStyle = 'rgba(250, 246, 233, 0.88)';
  c.beginPath();
  c.roundRect(0, 0, w, h, 8);
  c.fill();
  c.strokeStyle = color;
  c.lineWidth = 3;
  c.stroke();
  c.fillStyle = color;
  c.textBaseline = 'middle';
  c.fillText(text, pad, h / 2 + 1);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, depthTest: false, transparent: true,
  }));
  const scale = 0.55;
  sprite.scale.set(w * scale, h * scale, 1);
  sprite.renderOrder = 20;
  sprite.userData.noInk = true;
  return sprite;
}

/** OSM 鐵道線形 → 各營運商路線管狀模型＋標籤。 */
export function buildRail(data) {
  const root = new THREE.Group();
  const lines = [];

  for (const line of data.lines) {
    const g = new THREE.Group();
    g.name = `rail-${line.key}`;
    const geos = [];
    let far = null;
    let farD = -1;
    for (const way of line.ways) {
      const pts = [];
      for (let i = 0; i + 1 < way.length; i += 2) {
        const p = new THREE.Vector3(way[i], 0, -way[i + 1]);
        pts.push(p);
        const d = p.x * p.x + p.z * p.z;
        if (d > farD) { farD = d; far = p; }
      }
      if (pts.length < 2) continue;
      const curve = new THREE.CatmullRomCurve3(pts);
      geos.push(new THREE.TubeGeometry(curve, Math.max(pts.length * 2, 8), 1.6, 5, false));
    }
    if (!geos.length) continue;
    const merged = mergeGeometries(geos, false);
    geos.forEach((x) => x.dispose());
    const mat = new THREE.MeshLambertMaterial({
      color: line.color,
      emissive: line.color,
      emissiveIntensity: 0.25,
    });
    g.add(new THREE.Mesh(merged, mat));

    // 標籤放在離站中心最遠的端點（進場方向一目瞭然）
    if (far) {
      const sprite = makeLabelSprite(line.label, line.color);
      sprite.position.set(far.x, 14, far.z);
      g.add(sprite);
    }

    g.position.y = line.elev;
    root.add(g);
    lines.push({ ...line, group: g });
  }

  return {
    group: root,
    lines,
    setSeparation(s) {
      for (const l of lines) l.group.position.y = l.elev * s;
    },
  };
}
