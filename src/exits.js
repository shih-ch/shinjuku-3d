import * as THREE from 'three';

function badgeSprite(text) {
  const font = 'bold 26px "Noto Sans JP", sans-serif';
  const canvas = document.createElement('canvas');
  let ctx = canvas.getContext('2d');
  ctx.font = font;
  const w = Math.max(Math.ceil(ctx.measureText(text).width) + 16, 40);
  const h = 40;
  canvas.width = w * 2;
  canvas.height = h * 2;
  ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  ctx.fillStyle = '#123c78';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 7);
  ctx.fill();
  ctx.strokeStyle = '#fdfaf1';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.font = font;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 1);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sp.scale.set(w * 0.32, h * 0.32, 1);
  sp.renderOrder = 15;
  return sp;
}

/** 出入口編號徽章（地面高度，不隨樓層分離移動）。 */
export function buildExits(data) {
  const group = new THREE.Group();
  group.userData.noInk = true;
  for (const e of data.exits) {
    const sp = badgeSprite(e.r);
    sp.position.set(e.x, 3.2, -e.n);
    group.add(sp);
  }
  return { group };
}
