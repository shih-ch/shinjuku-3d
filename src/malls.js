import * as THREE from 'three';

function mallSprite(text) {
  const font = 'bold 26px "Noto Sans JP", "Hiragino Sans", sans-serif';
  const canvas = document.createElement('canvas');
  let ctx = canvas.getContext('2d');
  ctx.font = font;
  const pad = 12;
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
  const h = 42;
  canvas.width = w * 2;
  canvas.height = h * 2;
  ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  ctx.fillStyle = 'rgba(200, 85, 46, 0.92)';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 9);
  ctx.fill();
  ctx.font = font;
  ctx.fillStyle = '#fdfaf1';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 1);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthTest: false,
  }));
  sp.scale.set(w * 0.42, h * 0.42, 1);
  sp.renderOrder = 18;
  sp.userData.noInk = true;
  return sp;
}

/** 商場・百貨標籤。 */
export function buildMalls(data) {
  const group = new THREE.Group();
  group.userData.noInk = true;
  for (const m of data.malls) {
    const sp = mallSprite(m.n);
    sp.position.set(m.x, 46, -m.y);
    group.add(sp);
  }
  return { group };
}
