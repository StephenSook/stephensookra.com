import * as THREE from "three";

/** Per-instance attributes on the slot-back mesh. */
export const SLOT_ATTRIBUTES = { lit: "aLit", poster: "aPoster" } as const;

const vertexShader = /* glsl */ `
attribute float aLit;
attribute vec4 aPoster;
varying vec2 vUv;
varying float vLit;
varying vec4 vPoster;

void main() {
  vUv = uv;
  vLit = aLit;
  vPoster = aPoster;
  vec4 local = vec4(position, 1.0);
  #ifdef USE_INSTANCING
    local = instanceMatrix * local;
  #endif
  gl_Position = projectionMatrix * modelViewMatrix * local;
}
`;

const fragmentShader = /* glsl */ `
#include <common>
uniform vec3 uBack;
uniform vec3 uLight;
uniform sampler2D uAtlas;
uniform float uHasAtlas;
uniform float uDim;
varying vec2 vUv;
varying float vLit;
varying vec4 vPoster;

void main() {
  vec3 base = uBack;
  // aPoster is an atlas rect (u0, v0, u1, v1); a zero-width rect means no poster.
  if (uHasAtlas > 0.5 && vPoster.z > vPoster.x) {
    vec2 st = mix(vPoster.xy, vPoster.zw, vUv);
    vec3 poster = texture2D(uAtlas, st).rgb;
    base = mix(base, poster, uDim + (1.0 - uDim) * vLit);
  }
  // The slot light: a strip along the top edge and a warm glow spilling down from it.
  float strip = smoothstep(0.93, 1.0, vUv.y);
  float d = distance(vUv, vec2(0.5, 1.08));
  float glow = exp(-d * d * 3.5);
  vec3 color = base * (0.7 + 0.3 * vLit) + uLight * vLit * (0.9 * strip + 0.5 * glow);
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;

/**
 * One material for every slot back in the case (project slots and small cells), so the
 * whole back wall is one instanced draw call. Colours are set from the CSS tokens.
 */
export function createSlotMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uBack: { value: new THREE.Color("#14161b") },
      uLight: { value: new THREE.Color("#ffb547") },
      uAtlas: { value: null },
      uHasAtlas: { value: 0 },
      // How much of a poster shows while its slot is dark.
      uDim: { value: 0.35 },
    },
    toneMapped: false,
  });
}
