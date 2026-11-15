import * as THREE from "three";
import type { CaseLayout } from "./layout";

/** Vertical field of view of the case camera, in degrees. */
export const CASE_FOV = 30;
/** Room around the case so its frame never touches the canvas edge. */
const MARGIN = 1.08;

/**
 * A perspective camera on the case's centre line, far enough back that the whole front
 * face fits the canvas at this aspect ratio. The scene and the tests share it, and the
 * Blender poster script uses the same numbers.
 */
export function fitCamera(layout: CaseLayout, aspect: number, fov = CASE_FOV): THREE.PerspectiveCamera {
  const halfV = THREE.MathUtils.degToRad(fov) / 2;
  const halfHeight = Math.max(layout.height / 2, layout.width / 2 / aspect) * MARGIN;
  const distance = halfHeight / Math.tan(halfV) + layout.depth / 2;
  const camera = new THREE.PerspectiveCamera(fov, aspect, 0.05, distance + layout.depth * 4);
  camera.position.set(0, 0, distance);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

export function projectToNdc(point: THREE.Vector3, camera: THREE.Camera): { x: number; y: number } {
  const p = point.clone().project(camera);
  return { x: p.x, y: p.y };
}

const raycaster = new THREE.Raycaster();
const frontPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const hit = new THREE.Vector3();

/**
 * Which project slot is under a pointer, from its normalized device coordinates.
 * The ray meets the case's front plane and the hit must fall inside a project slot's
 * opening, so a divider, the frame, a small cell or the margin gives null.
 */
export function pickSlot(ndc: { x: number; y: number }, camera: THREE.Camera, layout: CaseLayout): string | null {
  raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  frontPlane.constant = -layout.depth / 2;
  if (!raycaster.ray.intersectPlane(frontPlane, hit)) return null;
  for (const slot of layout.projectSlots) {
    const o = slot.opening;
    if (Math.abs(hit.x - o.x) < o.w / 2 && Math.abs(hit.y - o.y) < o.h / 2) return slot.slug;
  }
  return null;
}
