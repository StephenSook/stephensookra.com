import * as THREE from "three";
import type { CaseLayout } from "@/scene/layout";

/** How far in front of the viewer the case stands, in meters (design brief section 9). */
export const CASE_DISTANCE = 1;
/** The case's centre sits this far below the viewer's eyes, in meters. */
export const BELOW_EYE = 0.1;

export type HeadPose = { position: THREE.Vector3; quaternion: THREE.Quaternion };
export type CasePlacement = { position: THREE.Vector3; rotationY: number };

const FORWARD = new THREE.Vector3(0, 0, -1);

/**
 * Where to stand the case for a viewer, from the head pose on the first headset frame:
 * straight ahead along the head's yaw (pitch and roll ignored), at its measured height
 * less BELOW_EYE, turned to face the viewer. Measured height, not a fixed 1.6 m, so a
 * seated viewer gets a lower case.
 */
export function placeCase(head: HeadPose): CasePlacement {
  const ahead = FORWARD.clone().applyQuaternion(head.quaternion).setY(0);
  if (ahead.lengthSq() < 1e-6) ahead.copy(FORWARD); // looking straight up or down
  ahead.normalize();
  const position = head.position.clone().addScaledVector(ahead, CASE_DISTANCE);
  position.y = head.position.y - BELOW_EYE;
  // The case's front is +z in its own space; turn it to point back along `ahead`.
  return { position, rotationY: Math.atan2(-ahead.x, -ahead.z) };
}

export type PickPlane = { slug: string; x: number; y: number; z: number; w: number; h: number };

/** Just in front of the case face, so a target is never hidden inside the wood. */
const PICK_OFFSET = 0.002;

/**
 * One select target per project slot, covering its opening on the case's front plane.
 * Hands, controllers and transient pointers all aim at these, never at the wood.
 */
export function pickPlanes(layout: CaseLayout): PickPlane[] {
  return layout.projectSlots.map(({ slug, opening }) => ({
    slug,
    x: opening.x,
    y: opening.y,
    z: layout.depth / 2 + PICK_OFFSET,
    w: opening.w,
    h: opening.h,
  }));
}
