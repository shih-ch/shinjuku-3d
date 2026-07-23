import * as THREE from 'three';

const VERT = /* glsl */ `
  attribute float aElev;
  attribute float aDist;
  attribute float aKind;
  uniform float uSep;
  varying float vDist;
  varying float vKind;
  void main() {
    vDist = aDist;
    vKind = aKind;
    vec3 p = position;
    p.y = aElev * uSep + 1.2;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColorWalk;
  uniform vec3 uColorVert;
  varying float vDist;
  varying float vKind;
  void main() {
    // 沿線移動的光點：週期 22m、速度 14m/s
    float t = fract(vDist / 22.0 - uTime * 0.64);
    float pulse = smoothstep(0.0, 0.32, t) * (1.0 - smoothstep(0.42, 0.75, t));
    vec3 color = mix(uColorWalk, uColorVert, vKind);
    float alpha = 0.22 + pulse * 0.78;
    gl_FragColor = vec4(color, alpha);
  }
`;

/** 步行空間ネットワーク → 流動線段動畫。 */
export function buildNetwork(data) {
  const pos = [];
  const elev = [];
  const dist = [];
  const kind = [];

  for (const link of data.links) {
    const n = link.p.length / 2;
    for (let i = 0; i + 1 < n; i++) {
      for (const j of [i, i + 1]) {
        pos.push(link.p[j * 2], 0, -link.p[j * 2 + 1]); // z = -北
        elev.push(link.e[j]);
        dist.push(link.d[j]);
        kind.push(link.v);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aElev', new THREE.Float32BufferAttribute(elev, 1));
  geo.setAttribute('aDist', new THREE.Float32BufferAttribute(dist, 1));
  geo.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uSep: { value: 1 },
      uTime: { value: 0 },
      uColorWalk: { value: new THREE.Color(0x1d55c8) },
      uColorVert: { value: new THREE.Color(0xd96a1e) },
    },
    transparent: true,
    depthWrite: false,
  });

  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.renderOrder = 5;

  return {
    object: lines,
    setSeparation(s) { mat.uniforms.uSep.value = s; },
    tick(t) { mat.uniforms.uTime.value = t; },
  };
}
