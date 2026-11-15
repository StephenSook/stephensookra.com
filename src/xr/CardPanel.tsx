import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Project } from "@/content";
import { damp } from "@/scene/damping";
import { cardText, fitBox } from "./card";
import { CLOSE, PANEL, VIDEO_BOX } from "./cardLayout";
import { FONT_REGULAR, Label } from "./Label";
import type { VideoController } from "./video";

const TEXT_X = -0.005;
const TEXT_W = 0.29;
/** About 450 ms to slide out of the slot (frame-rate independent). */
const PULL_RATE = 10;
const SETTLED = 0.002;

type Vec3 = [number, number, number];

export type CardPanelProps = {
  /** The open project, or null when the card is put back. */
  project: Project | null;
  /** Where the card comes from (the slot's front), and where it rests, in case space. */
  from: Vec3;
  to: Vec3;
  video: VideoController;
  texture: THREE.Texture;
  onClose: () => void;
};

/**
 * Slides out of its slot toward the viewer and back on close: the only motion in the
 * headset, made by the reader's own select. It blocks pointers to the slots behind it,
 * so a select on the card never opens a slot through it.
 */
export function CardPanel({ project, from, to, video, texture, onClose }: CardPanelProps) {
  const group = useRef<THREE.Group>(null);
  const progress = useRef(0);
  // Keep showing the last card while it slides back into its slot.
  const [shown, setShown] = useState<Project | null>(project);
  if (project && project !== shown) setShown(project);
  const card = shown ? cardText(shown) : null;
  const loop = shown?.loop;
  const size = loop ? fitBox(loop.width, loop.height, VIDEO_BOX.w, VIDEO_BOX.h) : null;
  // Only an open card takes pointers. Hit tests ignore visibility, so a closed card must
  // opt out, or its hidden Close button would catch selects meant for the slot.
  const open = project !== null;

  // A newly opened card starts from its own slot (closing slides back from where it is).
  useEffect(() => {
    if (project) progress.current = 0;
  }, [project]);

  // One video for the whole session: play this card's loop, or stop when there is none.
  useEffect(() => {
    if (project?.loop) void video.play(project.loop.src);
    else video.stop();
  }, [project, video]);

  const fromV = useMemo(() => new THREE.Vector3(...from), [from]);
  const toV = useMemo(() => new THREE.Vector3(...to), [to]);

  useFrame((_s, dt) => {
    const g = group.current;
    if (!g) return;
    const target = project ? 1 : 0;
    progress.current = damp(progress.current, target, PULL_RATE, dt);
    if (Math.abs(progress.current - target) < SETTLED) progress.current = target;
    const p = progress.current;
    g.position.lerpVectors(fromV, toV, p);
    g.scale.setScalar(0.35 + 0.65 * p);
    g.visible = p > 0.01;
  });

  if (!card) return <group ref={group} visible={false} />;
  return (
    <group ref={group} visible={false}>
      {/* "auto": the card blocks pointers to the slots behind it, though it has no handler. */}
      <mesh name="card" pointerEvents={open ? "auto" : "none"} pointerEventsType={{ deny: "grab" }}>
        <planeGeometry args={[PANEL.w, PANEL.h]} />
        <meshBasicMaterial color="#17191e" />
      </mesh>
      {size && (
        <mesh position={[VIDEO_BOX.x, 0, 0.001]}>
          <planeGeometry args={[size.w, size.h]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
      )}
      <Label text={card.title} size={0.03} position={[TEXT_X, 0.13, 0.002]} anchorY="top" maxWidth={TEXT_W} />
      <Label
        text={[card.line, card.platform, card.result, card.part].filter(Boolean).join("\n\n")}
        size={0.0145}
        font={FONT_REGULAR}
        color="#cfd3da"
        position={[TEXT_X, 0.088, 0.002]}
        anchorY="top"
        maxWidth={TEXT_W}
        lineHeight={1.3}
      />
      <mesh
        name="close"
        position={[CLOSE.x, CLOSE.y, 0.003]}
        pointerEvents={open ? "listener" : "none"}
        pointerEventsType={{ deny: "grab" }}
        onClick={onClose}
      >
        <planeGeometry args={[CLOSE.w, CLOSE.h]} />
        <meshBasicMaterial color="#2a2d34" />
      </mesh>
      <Label text="Close" size={0.02} position={[CLOSE.x, CLOSE.y, 0.004]} anchorX="center" anchorY="middle" />
    </group>
  );
}
