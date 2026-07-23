import * as THREE from 'three';
import { TilesRenderer } from '3d-tiles-renderer';
import { ReorientationPlugin, GLTFExtensionsPlugin } from '3d-tiles-renderer/plugins';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { ORIGIN_LON, ORIGIN_LAT, GROUND_ELLIPSOIDAL_H, PALETTE } from './config.js';

const DEG2RAD = Math.PI / 180;

/**
 * 建立一個 PLATEAU 3D Tiles 圖層。
 * ReorientationPlugin 把原點放到 (0,0,0)、X 朝西、Z 朝北；
 * 外層 group 繞 Y 轉 180°，轉成本場景的 X 東、Z 南。
 */
export function createTilesLayer({ url, renderer, camera, ghost = false, errorTarget = 8 }) {
  const tiles = new TilesRenderer(url);
  tiles.errorTarget = errorTarget;

  const draco = new DRACOLoader();
  draco.setDecoderPath('./draco/');
  const ktx2 = new KTX2Loader();
  ktx2.setTranscoderPath('./basis/');
  ktx2.detectSupport(renderer);

  tiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: draco, ktxLoader: ktx2 }));
  tiles.registerPlugin(new ReorientationPlugin({
    lat: ORIGIN_LAT * DEG2RAD,
    lon: ORIGIN_LON * DEG2RAD,
    height: GROUND_ELLIPSOIDAL_H,
  }));

  const materials = [];
  if (ghost) {
    tiles.addEventListener('load-model', ({ scene }) => {
      scene.traverse((o) => {
        if (o.isMesh) {
          o.material = new THREE.MeshLambertMaterial({
            color: PALETTE.building,
            transparent: true,
            opacity: 0.92,
          });
          materials.push(o.material);
        }
      });
    });
  }

  tiles.setCamera(camera);
  tiles.setResolutionFromRenderer(camera, renderer);

  const container = new THREE.Group();
  container.rotation.y = Math.PI;
  container.add(tiles.group);

  return {
    tiles,
    container,
    materials,
    setGhostOpacity(op) {
      for (const m of materials) {
        m.opacity = op;
        m.transparent = op < 1;
        m.needsUpdate = true;
      }
    },
    update() {
      tiles.update();
    },
    dispose() {
      tiles.dispose();
      draco.dispose();
      ktx2.dispose();
    },
  };
}
