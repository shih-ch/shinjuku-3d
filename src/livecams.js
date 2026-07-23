import * as THREE from 'three';
import { M_LON, M_LAT } from './basemap.js';
import { ORIGIN_LON, ORIGIN_LAT } from './config.js';

// 新宿周邊 YouTube 24h 直播攝影機（位置為概略值）
// 全部條目於 2026-07-23 以 isLiveNow 驗證為直播中。
// YouTube 直播重啟時影片 ID 會輪替——失效時執行 tools/check_livecams.sh
// 檢查，並到 ch（頻道）找新的直播 ID 更新。
const CAMS = [
  { id: 'DjdUEyjx8GM', name: '歌舞伎町一番街 LIVE', lon: 139.70265, lat: 35.69384, ch: 'UCCLnJzwda_Kcdkok3et7n0A' },
  { id: 'gFRtAAmiFbE', name: '歌舞伎町 LIVE 2', lon: 139.70292, lat: 35.69452, ch: 'UCBFDJXGCOdMjVtg2AnReoXA' },
  { id: 'ErHJBXTmm2Q', name: '歌舞伎町交差点 4K（靖国通り）', lon: 139.70195, lat: 35.69352, ch: 'UCuv7xqb-jo3HEFMIVLTY_CA' },
  { id: 'vuP9iwdyyFM', name: '区役所前交差点 4K', lon: 139.70428, lat: 35.69398, ch: 'UCuv7xqb-jo3HEFMIVLTY_CA' },
  { id: 'gTO_FJzv70k', name: '新宿五丁目交差点 4K', lon: 139.70726, lat: 35.69389, ch: 'UCuv7xqb-jo3HEFMIVLTY_CA' },
  { id: 'lA6TaaMGgDo', name: '西武新宿駅 pepe前広場', lon: 139.69985, lat: 35.69525, ch: 'UC56apcbc2pLZ9xyBizbD1Dg' },
  { id: 'GLQhbRGv5qU', name: '新宿駅北側 鉄道ライブ', lon: 139.69860, lat: 35.69480, ch: 'UC1kDVgEX2DsE295Bkum_K9Q' },
  { id: '6dp-bvQ7RWo', name: '大ガード交差点', lon: 139.69930, lat: 35.69360, ch: 'UCpk2ftN35L3xfoV2S5xLN2A' },
  { id: 'Zhmmh7l6KEw', name: '新宿駅東口 猫の目線（クロス新宿）', lon: 139.70085, lat: 35.69205, ch: 'UC8cnCaq-MquhsebMer9A9rQ' },
];

function camIconTexture() {
  const s = 96;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const c = canvas.getContext('2d');
  c.fillStyle = '#d0342c';
  c.beginPath();
  c.arc(s / 2, s / 2 - 6, 34, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#fdfaf1';
  c.lineWidth = 5;
  c.stroke();
  // 攝影機圖形
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.roundRect(s / 2 - 18, s / 2 - 19, 24, 26, 4);
  c.fill();
  c.beginPath();
  c.moveTo(s / 2 + 8, s / 2 - 12);
  c.lineTo(s / 2 + 20, s / 2 - 18);
  c.lineTo(s / 2 + 20, s / 2 + 6);
  c.lineTo(s / 2 + 8, s / 2 + 0);
  c.closePath();
  c.fill();
  // LIVE 字樣
  c.fillStyle = '#d0342c';
  c.font = 'bold 20px sans-serif';
  c.textAlign = 'center';
  c.fillText('LIVE', s / 2, s - 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 現場直播攝影機圖示（可點擊，開啟 YouTube 直播嵌入視窗）。 */
export function buildLivecams() {
  const group = new THREE.Group();
  group.userData.noInk = true;
  const tex = camIconTexture();
  const sprites = [];
  for (const cam of CAMS) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthTest: false,
    }));
    const x = (cam.lon - ORIGIN_LON) * M_LON;
    const n = (cam.lat - ORIGIN_LAT) * M_LAT;
    sp.position.set(x, 34, -n);
    sp.scale.set(30, 30, 1);
    sp.renderOrder = 22;
    sp.userData.cam = cam;
    group.add(sp);
    sprites.push(sp);
  }
  return { group, sprites };
}
