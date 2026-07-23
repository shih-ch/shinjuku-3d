import * as THREE from 'three';
import { ORIGIN_LON, ORIGIN_LAT } from './config.js';

// 國土地理院タイル（出典表示必須；CORS 開放）
const STYLES = {
  pale: { url: (z, x, y) => `https://cyberjapandata.gsi.go.jp/xyz/pale/${z}/${x}/${y}.png`, z: 17 },
  photo: { url: (z, x, y) => `https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/${z}/${x}/${y}.jpg`, z: 17 },
};

// 原點附近的線性近似（±1.5km 內誤差 < 1m）
export const M_LON = 90520;   // 公尺／經度度 @ 35.69N
export const M_LAT = 110953;  // 公尺／緯度度

const HALF = 1500; // 涵蓋半徑（公尺）

function lon2tx(lon, z) { return ((lon + 180) / 360) * 2 ** z; }
function lat2ty(lat, z) {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
}
function tx2lon(tx, z) { return (tx / 2 ** z) * 360 - 180; }
function ty2lat(ty, z) {
  const n = Math.PI - (2 * Math.PI * ty) / 2 ** z;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

function loadTile(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

const cache = new Map();

/** 建立 GSI 瓦片地面。回傳 {mesh, setOpacity}（快取，切換不重抓）。 */
export async function buildBasemap(style) {
  if (cache.has(style)) return cache.get(style);
  const conf = STYLES[style];
  const { z } = conf;

  const x0 = Math.floor(lon2tx(ORIGIN_LON - HALF / M_LON, z));
  const x1 = Math.floor(lon2tx(ORIGIN_LON + HALF / M_LON, z));
  const y0 = Math.floor(lat2ty(ORIGIN_LAT + HALF / M_LAT, z));
  const y1 = Math.floor(lat2ty(ORIGIN_LAT - HALF / M_LAT, z));

  const nx = x1 - x0 + 1;
  const ny = y1 - y0 + 1;
  const canvas = document.createElement('canvas');
  canvas.width = nx * 256;
  canvas.height = ny * 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e9e2cc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const jobs = [];
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      jobs.push(loadTile(conf.url(z, tx, ty)).then((img) => {
        if (img) ctx.drawImage(img, (tx - x0) * 256, (ty - y0) * 256);
      }));
    }
  }
  await Promise.all(jobs);

  // 瓦片範圍四角 → ENU 公尺
  const west = (tx2lon(x0, z) - ORIGIN_LON) * M_LON;
  const east = (tx2lon(x1 + 1, z) - ORIGIN_LON) * M_LON;
  const north = (ty2lat(y0, z) - ORIGIN_LAT) * M_LAT;
  const south = (ty2lat(y1 + 1, z) - ORIGIN_LAT) * M_LAT;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const geo = new THREE.PlaneGeometry(east - west, north - south);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshLambertMaterial({
    map: tex, transparent: true, opacity: 0.85, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((west + east) / 2, -0.5, -(north + south) / 2);
  mesh.renderOrder = -1;
  mesh.userData.noInk = true;

  const layer = { mesh, setOpacity(op) { mat.opacity = op; } };
  cache.set(style, layer);
  return layer;
}
