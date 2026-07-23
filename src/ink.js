import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// 法線＋深度 Sobel 描邊 → 墨線手繪風
const EdgeShader = {
  uniforms: {
    tDiffuse: { value: null },
    tNormal: { value: null },
    tDepth: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    cameraNear: { value: 1 },
    cameraFar: { value: 12000 },
    strength: { value: 0.7 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    #include <packing>
    uniform sampler2D tDiffuse;
    uniform sampler2D tNormal;
    uniform sampler2D tDepth;
    uniform vec2 resolution;
    uniform float cameraNear;
    uniform float cameraFar;
    uniform float strength;
    varying vec2 vUv;

    float viewZ(vec2 uv) {
      float d = texture2D(tDepth, uv).x;
      return perspectiveDepthToViewZ(d, cameraNear, cameraFar);
    }

    void main() {
      vec2 px = 1.0 / resolution;
      vec3 n0 = texture2D(tNormal, vUv).rgb;
      vec3 nx = texture2D(tNormal, vUv + vec2(px.x, 0.0)).rgb;
      vec3 ny = texture2D(tNormal, vUv + vec2(0.0, px.y)).rgb;
      float nEdge = length(nx - n0) + length(ny - n0);

      float z0 = viewZ(vUv);
      float zx = viewZ(vUv + vec2(px.x, 0.0));
      float zy = viewZ(vUv + vec2(0.0, px.y));
      // 深度差相對化，遠處不會整片變黑
      float dEdge = (abs(zx - z0) + abs(zy - z0)) / max(abs(z0) * 0.02, 1.0);

      float ink = clamp(max(nEdge * 0.9, dEdge * 0.55), 0.0, 1.0);
      ink = smoothstep(0.25, 0.9, ink) * strength;

      vec4 color = texture2D(tDiffuse, vUv);
      vec3 inkColor = vec3(0.28, 0.25, 0.20);
      gl_FragColor = vec4(mix(color.rgb, inkColor, ink), color.a);
    }
  `,
};

/** 墨線描邊後處理。enabled=false 時直接普通渲染。 */
export function createInk(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const dpr = renderer.getPixelRatio();

  const normalTarget = new THREE.WebGLRenderTarget(size.x * dpr, size.y * dpr);
  normalTarget.depthTexture = new THREE.DepthTexture(size.x * dpr, size.y * dpr);
  const normalMat = new THREE.MeshNormalMaterial();

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const edgePass = new ShaderPass(EdgeShader);
  edgePass.uniforms.tNormal.value = normalTarget.texture;
  edgePass.uniforms.tDepth.value = normalTarget.depthTexture;
  edgePass.uniforms.resolution.value.set(size.x * dpr, size.y * dpr);
  edgePass.uniforms.cameraNear.value = camera.near;
  edgePass.uniforms.cameraFar.value = camera.far;
  composer.addPass(edgePass);
  composer.addPass(new OutputPass());

  const hidden = [];
  function hideNoInk() {
    scene.traverse((o) => {
      if (o.userData.noInk && o.visible) { o.visible = false; hidden.push(o); }
    });
  }
  function restore() {
    for (const o of hidden) o.visible = true;
    hidden.length = 0;
  }

  return {
    enabled: true,
    render() {
      if (!this.enabled) { renderer.render(scene, camera); return; }
      hideNoInk();
      scene.overrideMaterial = normalMat;
      renderer.setRenderTarget(normalTarget);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      scene.overrideMaterial = null;
      restore();
      composer.render();
    },
    setSize(w, h) {
      const p = renderer.getPixelRatio();
      composer.setSize(w, h);
      normalTarget.setSize(w * p, h * p);
      edgePass.uniforms.resolution.value.set(w * p, h * p);
    },
  };
}
