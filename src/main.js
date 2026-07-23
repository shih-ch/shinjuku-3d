import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildBasemap } from './basemap.js';
import { buildBasements } from './basements.js';
import { buildExits } from './exits.js';
import { buildMalls } from './malls.js';
import { buildIndoor } from './indoor.js';
import { buildNav } from './nav.js';
import { buildNetwork } from './network.js';
import { buildParticles } from './particles.js';
import { buildPlatforms } from './platforms.js';
import { buildRail } from './rail.js';
import { buildTunnels } from './tunnels.js';
import { createInk } from './ink.js';
import { createTilesLayer, ghostRadius } from './tiles.js';
import { TILESETS, SPACE_CATS, PALETTE } from './config.js';

const app = document.getElementById('app');
const statusEl = document.getElementById('status');

// --- renderer / scene / camera ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.paper);
scene.fog = new THREE.Fog(PALETTE.paper, 1800, 4200);

const camera = new THREE.PerspectiveCamera(
  45, window.innerWidth / window.innerHeight, 1, 12000,
);
const CAM_HOME = new THREE.Vector3(620, 470, 700);
const TARGET_HOME = new THREE.Vector3(-40, -20, -60);
camera.position.copy(CAM_HOME);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(TARGET_HOME);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxDistance = 3800;
controls.maxPolarAngle = Math.PI * 0.62; // 稍微允許由下往上看地下層

// --- 光 ---
scene.add(new THREE.HemisphereLight(0xfffbee, 0xcfc4a8, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.7);
sun.position.set(500, 900, 350);
scene.add(sun);

// --- 墨線描邊後處理 ---
const ink = createInk(renderer, scene, camera);

// --- 地面圓盤 ---
const groundGeo = new THREE.CircleGeometry(2600, 96);
groundGeo.rotateX(-Math.PI / 2);
const ground = new THREE.Mesh(
  groundGeo,
  new THREE.MeshLambertMaterial({
    color: PALETTE.ground,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  }),
);
ground.position.y = -0.6;
ground.renderOrder = -1;
scene.add(ground);

// --- 室內樓層 ---
let indoor = null;
fetch('./data/indoor.json')
  .then((r) => r.json())
  .then((data) => {
    indoor = buildIndoor(data);
    indoor.setSeparation(parseFloat(sepSlider.value));
    scene.add(indoor.group);
    buildLevelList();
    statusEl.textContent = '室內資料載入完成';
  })
  .catch((e) => {
    statusEl.textContent = `室內資料載入失敗: ${e.message}`;
  });

// --- 步行網路流動動畫＋導航＋人流粒子 ---
let network = null;
let nav = null;
let particles = null;
fetch('./data/network.json')
  .then((r) => r.json())
  .then((data) => {
    network = buildNetwork(data);
    network.setSeparation(parseFloat(sepSlider.value));
    network.object.visible = tgNet.checked;
    network.object.userData.noInk = true;
    scene.add(network.object);
    nav = buildNav(data, scene);
    nav.setSeparation(parseFloat(sepSlider.value));
    particles = buildParticles(data);
    particles.object.visible = tgPpl.checked;
    scene.add(particles.object);
  })
  .catch(() => {});

// --- 建物地下量體（推定）---
let basements = null;
fetch('./data/basements.json')
  .then((r) => r.json())
  .then((data) => {
    basements = buildBasements(data);
    basements.setSeparation(parseFloat(sepSlider.value));
    basements.group.visible = tgBsmt.checked;
    scene.add(basements.group);
  })
  .catch(() => {});

// --- 商場標籤 ---
let malls = null;
fetch('./data/malls.json')
  .then((r) => r.json())
  .then((data) => {
    malls = buildMalls(data);
    malls.group.visible = tgMall.checked;
    scene.add(malls.group);
  })
  .catch(() => {});

// --- 出入口編號 ---
let exits = null;
fetch('./data/exits.json')
  .then((r) => r.json())
  .then((data) => {
    exits = buildExits(data);
    exits.group.visible = tgExit.checked;
    scene.add(exits.group);
  })
  .catch(() => {});

// --- 地面底圖（GSI 瓦片）---
let basemap = null;
async function setBasemap(style) {
  if (basemap) { scene.remove(basemap.mesh); basemap = null; }
  ground.visible = style === 'none';
  if (style === 'none') return;
  const layer = await buildBasemap(style);
  layer.setOpacity(parseFloat(document.getElementById('base-op').value));
  basemap = layer;
  scene.add(layer.mesh);
}
setBasemap('pale');

// --- 鐵道路線 ---
let rail = null;
fetch('./data/rail.json')
  .then((r) => r.json())
  .then((data) => {
    rail = buildRail(data);
    rail.setSeparation(parseFloat(sepSlider.value));
    scene.add(rail.group);
    buildRailOps();
  })
  .catch(() => {});

// --- OSM 補完：地下通道・站廳 ---
let tunnels = null;
fetch('./data/tunnels.json')
  .then((r) => r.json())
  .then((data) => {
    tunnels = buildTunnels(data);
    tunnels.setSeparation(parseFloat(sepSlider.value));
    tunnels.group.visible = tgTun.checked;
    scene.add(tunnels.group);
  })
  .catch(() => {});

// --- OSM 補完：月台 ---
let platforms = null;
fetch('./data/platforms.json')
  .then((r) => r.json())
  .then((data) => {
    platforms = buildPlatforms(data);
    platforms.setSeparation(parseFloat(sepSlider.value));
    platforms.group.visible = tgPlat.checked;
    scene.add(platforms.group);
  })
  .catch(() => {});

// --- PLATEAU tiles ---
const bldg = createTilesLayer({
  url: TILESETS.bldg.url, renderer, camera, ghost: true, errorTarget: 14,
});
scene.add(bldg.container);

const bldgShibuya = createTilesLayer({
  url: TILESETS.bldgShibuya.url, renderer, camera, ghost: true, errorTarget: 14,
});
scene.add(bldgShibuya.container);

const ubld = createTilesLayer({
  url: TILESETS.ubld.url, renderer, camera, ghost: false, errorTarget: 6,
});
scene.add(ubld.container);

// --- UI ---
const sepSlider = document.getElementById('sep');
const sepVal = document.getElementById('sep-val');
const tgNet = document.getElementById('tg-net');
const tgTun = document.getElementById('tg-tun');
const tgPlat = document.getElementById('tg-plat');
const tgExit = document.getElementById('tg-exit');
const tgBsmt = document.getElementById('tg-bsmt');
const tgMall = document.getElementById('tg-mall');
const tgPpl = document.getElementById('tg-ppl');
const tgInk = document.getElementById('tg-ink');
sepSlider.addEventListener('input', () => {
  const s = parseFloat(sepSlider.value);
  sepVal.textContent = `×${s.toFixed(2)}`;
  if (indoor) indoor.setSeparation(s);
  if (network) network.setSeparation(s);
  if (rail) rail.setSeparation(s);
  if (tunnels) tunnels.setSeparation(s);
  if (platforms) platforms.setSeparation(s);
  if (nav) nav.setSeparation(s);
  if (basements) basements.setSeparation(s);
  // 分離模式下 PLATEAU 地下街仍是實寸，自動隱藏避免混淆
  const exploded = s > 1.15;
  ubld.container.visible = !exploded && tgUbld.checked;
});

tgNet.addEventListener('change', () => {
  if (network) network.object.visible = tgNet.checked;
});
tgTun.addEventListener('change', () => {
  if (tunnels) tunnels.group.visible = tgTun.checked;
});
tgPlat.addEventListener('change', () => {
  if (platforms) platforms.group.visible = tgPlat.checked;
});
tgExit.addEventListener('change', () => {
  if (exits) exits.group.visible = tgExit.checked;
});
tgBsmt.addEventListener('change', () => {
  if (basements) basements.group.visible = tgBsmt.checked;
});
tgMall.addEventListener('change', () => {
  if (malls) malls.group.visible = tgMall.checked;
});
tgPpl.addEventListener('change', () => {
  if (particles) particles.object.visible = tgPpl.checked;
});
tgInk.addEventListener('change', () => { ink.enabled = tgInk.checked; });

for (const radio of document.querySelectorAll('input[name="base"]')) {
  radio.addEventListener('change', () => setBasemap(radio.value));
}
document.getElementById('base-op').addEventListener('input', (e) => {
  if (basemap) basemap.setOpacity(parseFloat(e.target.value));
});

// --- 導航互動 ---
const navInfo = document.getElementById('nav-info');
let pickMode = null; // 'start' | 'end' | null
document.getElementById('nav-start').addEventListener('click', () => {
  pickMode = 'start';
  navInfo.textContent = '點擊場景中的通路設定起點…';
});
document.getElementById('nav-end').addEventListener('click', () => {
  pickMode = 'end';
  navInfo.textContent = '點擊場景中的通路設定終點…';
});
document.getElementById('nav-clear').addEventListener('click', () => {
  pickMode = null;
  if (nav) nav.clear();
  navInfo.textContent = '按「設起點」後點擊場景中的通路';
});

let downPos = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  downPos = [e.clientX, e.clientY];
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downPos || !pickMode || !nav) return;
  if (Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]) > 6) return;
  const node = nav.pickNode(e.clientX, e.clientY, camera, window.innerWidth, window.innerHeight);
  if (!node) { navInfo.textContent = '附近沒有通路節點，換個位置點看看'; return; }
  const info = pickMode === 'start' ? (nav.setStart(node), nav.route()) : (nav.setEnd(node), nav.route());
  if (pickMode === 'start') {
    pickMode = 'end';
    navInfo.textContent = '起點已設定，接著點擊終點…';
  } else {
    pickMode = null;
  }
  if (info && !info.unreachable) {
    const r0 = Math.round(info.minE) || 0;
    const r1 = Math.round(info.maxE) || 0;
    navInfo.textContent = `路徑約 ${info.meters}m・${info.legs} 段`
      + (r0 !== r1 ? `（高度 ${r0}m～${r1}m）` : '');
  } else if (info && info.unreachable) {
    navInfo.textContent = '這兩點在網路上不連通';
  }
});

function buildRailOps() {
  const wrap = document.getElementById('rail-ops');
  wrap.innerHTML = '';
  const byOp = new Map();
  for (const line of rail.lines) {
    if (!byOp.has(line.operator)) byOp.set(line.operator, []);
    byOp.get(line.operator).push(line);
  }
  for (const [op, opLines] of byOp) {
    const label = document.createElement('label');
    label.className = 'row';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true;
    cb.addEventListener('change', () => {
      for (const l of opLines) l.group.visible = cb.checked;
    });
    label.appendChild(cb);
    for (const l of opLines) {
      const dot = document.createElement('span');
      dot.className = 'op-dot';
      dot.style.background = `#${l.color.toString(16).padStart(6, '0')}`;
      dot.title = l.label;
      label.appendChild(dot);
    }
    label.appendChild(document.createTextNode(op));
    wrap.appendChild(label);
  }
}

const tgBldg = document.getElementById('tg-bldg');
const tgUbld = document.getElementById('tg-ubld');
tgBldg.addEventListener('change', () => {
  bldg.container.visible = tgBldg.checked;
  bldgShibuya.container.visible = tgBldg.checked;
});
tgUbld.addEventListener('change', () => {
  ubld.container.visible = tgUbld.checked && parseFloat(sepSlider.value) <= 1.15;
});

document.getElementById('bldg-op').addEventListener('input', (e) => {
  const op = parseFloat(e.target.value);
  bldg.setGhostOpacity(op);
  bldgShibuya.setGhostOpacity(op);
});

document.getElementById('bldg-rad').addEventListener('input', (e) => {
  ghostRadius.value = parseFloat(e.target.value);
  document.getElementById('rad-val').textContent = `${(ghostRadius.value / 1000).toFixed(1)}km`;
});

for (const radio of document.querySelectorAll('input[name="cmode"]')) {
  radio.addEventListener('change', () => {
    if (indoor) indoor.setColorMode(radio.value);
  });
}

function buildLevelList() {
  const wrap = document.getElementById('levels');
  wrap.innerHTML = '';
  for (const lv of [...indoor.levels].reverse()) {
    const label = document.createElement('label');
    label.className = 'row';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true;
    cb.addEventListener('change', () => { lv.group.visible = cb.checked; });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(lv.name));
    const elev = document.createElement('span');
    elev.className = 'elev';
    elev.textContent = `${lv.baseElev >= 0 ? '+' : ''}${lv.baseElev}m`;
    label.appendChild(elev);
    wrap.appendChild(label);
  }
}

// 圖例
const legendEl = document.getElementById('legend');
const legendToggle = document.getElementById('legend-toggle');
legendToggle.addEventListener('click', () => {
  legendEl.classList.toggle('open');
  legendToggle.textContent = legendEl.classList.contains('open') ? '隱藏圖例 ▴' : '顯示圖例 ▾';
});
for (const [code, conf] of Object.entries(SPACE_CATS)) {
  if (code === 'default') continue;
  const div = document.createElement('div');
  const sw = document.createElement('span');
  sw.className = 'sw';
  sw.style.background = `#${conf.color.toString(16).padStart(6, '0')}`;
  div.appendChild(sw);
  div.appendChild(document.createTextNode(conf.label));
  legendEl.appendChild(div);
}

document.getElementById('reset-cam').addEventListener('click', () => {
  camera.position.copy(CAM_HOME);
  controls.target.copy(TARGET_HOME);
});

// --- 羅盤 ---
const compassRose = document.getElementById('compass-rose');
const _sph = new THREE.Spherical();
const _off = new THREE.Vector3();
document.getElementById('compass').addEventListener('click', () => {
  _off.copy(camera.position).sub(controls.target);
  _sph.setFromVector3(_off);
  _sph.theta = 0; // 回正北（相機移到目標正南方，朝北看）
  _off.setFromSpherical(_sph);
  camera.position.copy(controls.target).add(_off);
});
function updateCompass() {
  // 指針指向畫面上的北方：方位角取負
  compassRose.style.transform = `rotate(${-controls.getAzimuthalAngle()}rad)`;
}

// --- 載入進度顯示 ---
let statusTimer = 0;
function updateStatus() {
  const now = performance.now();
  if (now - statusTimer < 500) return;
  statusTimer = now;
  const stats = [];
  for (const [name, layer] of [['建築', bldg], ['建築渋谷', bldgShibuya], ['地下街', ubld]]) {
    const t = layer.tiles;
    const loading = t.stats ? t.stats.downloading + t.stats.parsing : 0;
    if (layer.container.visible) {
      stats.push(`${name}${loading > 0 ? `載入中(${loading})` : ' ✓'}`);
    }
  }
  statusEl.textContent = stats.join('・') || '—';
}

// --- resize / loop ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  ink.setSize(window.innerWidth, window.innerHeight);
});

// 供瀏覽器 console 偵錯／量測對位
window.__dbg = {
  THREE, scene, camera, bldg, ubld,
  get indoor() { return indoor; },
  get network() { return network; },
  get rail() { return rail; },
  get tunnels() { return tunnels; },
  get platforms() { return platforms; },
  get nav() { return nav; },
  get particles() { return particles; },
};

const t0 = performance.now();
let tPrev = t0;
renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min((now - tPrev) / 1000, 0.1);
  tPrev = now;
  controls.update();
  camera.updateMatrixWorld();
  if (bldg.container.visible) bldg.update();
  if (bldgShibuya.container.visible) bldgShibuya.update();
  if (ubld.container.visible) ubld.update();
  if (network) network.tick((now - t0) / 1000);
  if (particles && particles.object.visible) {
    particles.update(dt, parseFloat(sepSlider.value));
  }
  updateCompass();
  updateStatus();
  ink.render();
});
