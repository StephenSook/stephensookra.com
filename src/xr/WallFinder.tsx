// Passthrough only: finds a wall where the reader looks, previews the case there, and shows
// a head-locked hint with an Exit until the case is placed (HeadsetCase places it on select).
import { useFrame, useThree } from "@react-three/fiber";
import { useXRHitTest } from "@react-three/xr";
import { useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { FONT_REGULAR, Label } from "./Label";
import type { Pointing } from "./pointing";
import type { Presses } from "./press";
import { HINT_AHEAD, HINT_BELOW, HINT_EXIT, normalOf, OUTLINE_BAR, wallPlacement, type WallPose } from "./wall";

type Size = { width: number; height: number; depth: number };

export type WallFinderProps = {
  size: Size;
  /** Written every frame: where the case would go now, or null when no wall is in view. */
  candidateRef: RefObject<WallPose | null>;
  /** True while a pointer is on the hint's Exit, so that select exits instead of placing. */
  onExitRef: RefObject<boolean>;
  exit: () => void;
  pointing: Pointing;
  presses: Presses;
};

const AMBER = "#ffb547";

/** Four thin bars around the case's front face, at the depth of that face. */
function Outline({ size }: { size: Size }) {
  const z = size.depth / 2;
  const bars: [number, number, number, number][] = [
    [0, size.height / 2, size.width + OUTLINE_BAR, OUTLINE_BAR],
    [0, -size.height / 2, size.width + OUTLINE_BAR, OUTLINE_BAR],
    [-size.width / 2, 0, OUTLINE_BAR, size.height],
    [size.width / 2, 0, OUTLINE_BAR, size.height],
  ];
  return (
    <>
      {bars.map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, z]} raycast={() => null}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial color={AMBER} />
        </mesh>
      ))}
    </>
  );
}

export function WallFinder({ size, candidateRef, onExitRef, exit, pointing, presses }: WallFinderProps) {
  const camera = useThree((s) => s.camera);
  const reticle = useRef<THREE.Group>(null);
  const hint = useRef<THREE.Group>(null);
  const [onAWall, setOnAWall] = useState(false);
  const shown = useRef(false);
  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      hit: new THREE.Vector3(),
      eye: new THREE.Vector3(),
      turn: new THREE.Quaternion(),
    }),
    [],
  );

  // From the head, straight ahead: the nearest surface only. If it is not a wall, nothing
  // behind it is used, so the case never lands on a wall the reader cannot see.
  useXRHitTest(
    (results, getWorldMatrix) => {
      const nearest = results[0];
      if (!nearest || !getWorldMatrix(scratch.matrix, nearest)) {
        candidateRef.current = null;
        return;
      }
      camera.getWorldPosition(scratch.eye);
      scratch.hit.setFromMatrixPosition(scratch.matrix);
      candidateRef.current = wallPlacement(
        { position: scratch.hit.clone(), normal: normalOf(scratch.matrix) },
        scratch.eye,
        size,
      );
    },
    "viewer",
    ["plane", "mesh"],
  );

  useFrame(() => {
    const pose = candidateRef.current;
    if (reticle.current) {
      reticle.current.visible = !!pose;
      if (pose) {
        reticle.current.position.copy(pose.position);
        reticle.current.quaternion.copy(pose.quaternion);
      }
    }
    if (shown.current !== !!pose) {
      shown.current = !!pose;
      setOnAWall(!!pose);
    }
    if (hint.current) {
      camera.getWorldPosition(scratch.eye);
      camera.getWorldQuaternion(scratch.turn);
      hint.current.position.set(0, -HINT_BELOW, -HINT_AHEAD).applyQuaternion(scratch.turn).add(scratch.eye);
      hint.current.quaternion.copy(scratch.turn);
    }
  });

  return (
    <>
      <group ref={reticle} visible={false}>
        <Outline size={size} />
      </group>
      <group ref={hint}>
        <Label
          text={onAWall ? "Select to hang the case here" : "Look at a wall"}
          size={0.03}
          position={[0, 0, 0]}
          anchorX="center"
          anchorY="bottom"
          maxWidth={0.6}
        />
        <mesh
          name="exit"
          position={[0, HINT_EXIT.y, 0]}
          pointerEventsType={{ deny: "grab" }}
          onPointerOver={() => {
            onExitRef.current = true;
            pointing.over("exit");
          }}
          onPointerOut={(e) => {
            onExitRef.current = false;
            pointing.out("exit");
            presses.leave("exit", e.pointerId);
          }}
          onPointerDown={(e) => presses.down("exit", e.pointerId)}
          onPointerUp={(e) => presses.up("exit", e.pointerId) && exit()}
        >
          <planeGeometry args={[HINT_EXIT.w, HINT_EXIT.h]} />
          <meshBasicMaterial color="#1b1d22" />
        </mesh>
        <Label
          text="Exit"
          size={0.03}
          position={[0, HINT_EXIT.y, 0.002]}
          anchorX="center"
          anchorY="middle"
          font={FONT_REGULAR}
        />
      </group>
    </>
  );
}
