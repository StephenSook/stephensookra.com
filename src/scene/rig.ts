import * as THREE from "three";
import { damp, LIGHT_RATE } from "./damping";
import type { Box, CaseLayout } from "./layout";
import { createSlotMaterial, SLOT_ATTRIBUTES } from "./slotMaterial";

/** At most 2 degrees of pointer parallax: the only camera-like motion, and the user makes it. */
export const MAX_TILT = THREE.MathUtils.degToRad(2);
const TILT_RATE = 8;
const SETTLED = 1e-3;
const TILT_SETTLED = 1e-5;

export type Tokens = { wood: string; back: string; light: string };
export type AtlasRect = [number, number, number, number];

function instanced(boxes: Box[], geometry: THREE.BufferGeometry, material: THREE.Material) {
  const mesh = new THREE.InstancedMesh(geometry, material, boxes.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  boxes.forEach((b, i) => {
    m.compose(new THREE.Vector3(b.x, b.y, b.z), q, new THREE.Vector3(b.w, b.h, b.d));
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

/**
 * The lit case as plain three.js objects: two instanced meshes (wood, and every slot back
 * with the glow shader) in one group, plus the per-frame easing of the slot lights and the
 * pointer tilt. React only mounts it, feeds it input and asks for frames while step()
 * reports motion.
 */
export function createRig(layout: CaseLayout) {
  const group = new THREE.Group();
  const woodGeometry = new THREE.BoxGeometry(1, 1, 1);
  const backGeometry = new THREE.BoxGeometry(1, 1, 1);
  const woodMaterial = new THREE.MeshLambertMaterial({ color: "#8a6a4a" });
  const slotMaterial = createSlotMaterial();

  const backs = [...layout.projectSlots.map((s) => s.back), ...layout.smallBacks];
  const litAttr = new THREE.InstancedBufferAttribute(new Float32Array(backs.length), 1);
  const posterAttr = new THREE.InstancedBufferAttribute(new Float32Array(backs.length * 4), 4);
  backGeometry.setAttribute(SLOT_ATTRIBUTES.lit, litAttr);
  backGeometry.setAttribute(SLOT_ATTRIBUTES.poster, posterAttr);

  group.add(instanced([...layout.frame, ...layout.dividers], woodGeometry, woodMaterial));
  group.add(instanced(backs, backGeometry, slotMaterial));

  const slugs = layout.projectSlots.map((s) => s.slug);
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  let atlas: THREE.Texture | null = null;

  return {
    group,

    applyTokens(t: Tokens) {
      woodMaterial.color.set(t.wood);
      slotMaterial.uniforms.uBack.value.set(t.back);
      slotMaterial.uniforms.uLight.value.set(t.light);
    },

    /** Posters for the project slots; slugs without a rect keep a plain back. */
    setAtlas(texture: THREE.Texture, rects: Map<string, AtlasRect>) {
      atlas?.dispose();
      atlas = texture;
      slugs.forEach((slug, i) => {
        const r = rects.get(slug);
        if (r) posterAttr.setXYZW(i, r[0], r[1], r[2], r[3]);
      });
      posterAttr.needsUpdate = true;
      slotMaterial.uniforms.uAtlas.value = texture;
      slotMaterial.uniforms.uHasAtlas.value = 1;
    },

    /** Pointer position in NDC, or null when the pointer leaves the case. */
    setPointer(ndc: { x: number; y: number } | null) {
      tilt.tx = ndc ? -THREE.MathUtils.clamp(ndc.y, -1, 1) * MAX_TILT : 0;
      tilt.ty = ndc ? THREE.MathUtils.clamp(ndc.x, -1, 1) * MAX_TILT : 0;
    },

    /** Advances the easing by dt seconds; returns true while anything is still moving. */
    step(litSlug: string | null, dt: number): boolean {
      let moving = false;
      slugs.forEach((slug, i) => {
        const target = slug === litSlug ? 1 : 0;
        const next = damp(litAttr.getX(i), target, LIGHT_RATE, dt);
        const settled = Math.abs(next - target) <= SETTLED;
        if (!settled) moving = true;
        litAttr.setX(i, settled ? target : next);
      });
      litAttr.needsUpdate = true;

      tilt.x = damp(tilt.x, tilt.tx, TILT_RATE, dt);
      tilt.y = damp(tilt.y, tilt.ty, TILT_RATE, dt);
      if (Math.abs(tilt.x - tilt.tx) <= TILT_SETTLED) tilt.x = tilt.tx;
      else moving = true;
      if (Math.abs(tilt.y - tilt.ty) <= TILT_SETTLED) tilt.y = tilt.ty;
      else moving = true;
      group.rotation.set(tilt.x, tilt.y, 0);
      return moving;
    },

    litValue: (slug: string) => litAttr.getX(slugs.indexOf(slug)),
    litValues: () => Array.from(litAttr.array as Float32Array),
    woodColor: () => woodMaterial.color.clone(),

    dispose() {
      woodGeometry.dispose();
      backGeometry.dispose();
      woodMaterial.dispose();
      slotMaterial.dispose();
      atlas?.dispose();
    },
  };
}

export type CaseRig = ReturnType<typeof createRig>;
