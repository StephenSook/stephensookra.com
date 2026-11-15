import * as THREE from "three";

/** A hit whose surface normal tips further than this from level is not a wall (|normal.y|). */
export const WALL_MAX_TILT = 0.3;
/** The case's bottom stays at least this far off the floor, in metres. */
export const MIN_BOTTOM = 0.05;

export type WallHit = { position: THREE.Vector3; normal: THREE.Vector3 };
export type WallPose = { position: THREE.Vector3; quaternion: THREE.Quaternion };

/** A hit pose's surface normal: WebXR gives it as the pose's y axis. */
export function normalOf(hitMatrix: THREE.Matrix4): THREE.Vector3 {
  return new THREE.Vector3().setFromMatrixColumn(hitMatrix, 1).normalize();
}

/**
 * Where the case's centre goes on a wall, from a hit test: centred on the hit, its back on
 * the wall, upright (world up), facing out of the wall towards the viewer. A floor, a table,
 * a ceiling or a steep slope gives null, so the case is never placed on one.
 */
export function wallPlacement(
  hit: WallHit,
  viewer: THREE.Vector3,
  size: { height: number; depth: number },
): WallPose | null {
  if (Math.abs(hit.normal.y) > WALL_MAX_TILT) return null;
  const out = new THREE.Vector3(hit.normal.x, 0, hit.normal.z).normalize();
  // The normal may point into the wall: turn it to the viewer's side.
  if (out.dot(new THREE.Vector3().subVectors(viewer, hit.position)) < 0) out.negate();

  const position = hit.position.clone().addScaledVector(out, size.depth / 2);
  position.y = Math.max(position.y, MIN_BOTTOM + size.height / 2);
  const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(out.x, out.z));
  return { position, quaternion };
}

/** While looking for a wall, a hint stays this far ahead of the eyes and this far below them. */
export const HINT_AHEAD = 0.8;
export const HINT_BELOW = 0.12;
/** The hint's Exit button, in the hint's own space (metres). */
export const HINT_EXIT = { w: 0.22, h: 0.08, y: -0.1 };
/** The outline that previews the case on the wall: bar thickness, in metres. */
export const OUTLINE_BAR = 0.012;
