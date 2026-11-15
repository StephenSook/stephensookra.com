import * as THREE from "three";
import spec from "@/scene/case-spec.json";

/** The case model's size in metres; its origin is the bottom centre, its depth centred on z = 0. */
export const CASE_SIZE = { width: spec.width, height: spec.height, depth: spec.depth };

type Vec3 = { x: number; y: number; z: number };
type Quat = Vec3 & { w: number };

/**
 * An image target's pose, as the 8th Wall engine reports it. In the target's own frame the
 * card is scaledWidth by scaledHeight, centred on the origin, x to the right, y up the card
 * and z out of it towards the viewer; `scale` maps that frame into the scene.
 */
export type TargetPose = { position: Vec3; rotation: Quat; scale: number; scaledWidth: number; scaledHeight: number };

/** Where the case picture sits on the card, as fractions of the card (top-left origin). */
export type CaseBox = { x: number; y: number; width: number; height: number };

export type CaseTransform = { position: [number, number, number]; quaternion: [number, number, number, number]; scale: number };

/**
 * The case laid over its own picture on the card: as wide as the picture, centred on it,
 * upright like the picture, with its back face on the card and its front coming out
 * towards the viewer. The card works as a small wall, as the case hangs on a real one.
 */
export function caseOnCard(pose: TargetPose, box: CaseBox): CaseTransform {
  const { scaledWidth: w, scaledHeight: h } = pose;
  const k = (box.width * w) / CASE_SIZE.width;
  const centreX = (box.x + box.width / 2 - 0.5) * w;
  const centreY = (0.5 - (box.y + box.height / 2)) * h;
  const local = new THREE.Vector3(centreX, centreY - (k * CASE_SIZE.height) / 2, (k * CASE_SIZE.depth) / 2);

  const rotation = new THREE.Quaternion(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w);
  const position = local.multiplyScalar(pose.scale).applyQuaternion(rotation).add(new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z));
  return {
    position: [position.x, position.y, position.z],
    quaternion: [rotation.x, rotation.y, rotation.z, rotation.w],
    scale: pose.scale * k,
  };
}
