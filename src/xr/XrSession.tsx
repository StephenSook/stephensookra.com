// The headset session. Loaded only after an Enter VR press (dynamic import from the door),
// so none of this, @react-three/xr or troika, is in any page's first load.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { XR, XROrigin, createXRStore, type XRStore } from "@react-three/xr";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Text } from "troika-three-text";
import { featured } from "@/content";
import specJson from "@/scene/case-spec.json";
import { buildAtlas, readTokens } from "@/scene/caseAssets";
import { buildLayout } from "@/scene/layout";
import { createRig, type CaseRig } from "@/scene/rig";
import { xrAssetBase } from "./assets";
import { slotLabels, LABEL_SIZE } from "./labels";
import { pickPlanes, placeCase } from "./placement";
import type { XrEndReason, XrSessionProps } from "./types";

const layout = buildLayout(specJson);
const planes = pickPlanes(layout);
const labels = slotLabels(layout, featured);
const titleOf = (slug: string) => featured.find((p) => p.slug === slug)?.title ?? slug;

export const FONT_REGULAR = "/xr/fonts/familjen-grotesk-latin-400-normal.woff";
export const FONT_SEMIBOLD = "/xr/fonts/familjen-grotesk-latin-600-normal.woff";

/** A plain dark space around the case: no room, no walls (design brief section 9). */
const SPACE = "#0b0c0f";
const EXIT = { w: 0.3, h: 0.1, y: -layout.height / 2 - 0.1 };

function makeStore(origin: string): XRStore {
  return createXRStore({
    // The library would otherwise inject an emulated Quest on localhost and offer its own
    // session UI; this site enters only from its own Enter VR button.
    emulate: false,
    offerSession: false,
    enterGrantedSession: false,
    // The middle supported rate (90 Hz on a Quest offering 72/80/90/120), not the highest.
    frameRate: "mid",
    // Controller and hand models from this site, never a CDN.
    baseAssetPath: xrAssetBase(origin),
    // Select only: no grabbing or teleporting, and no head-gaze or screen pointers.
    controller: { grabPointer: false, teleportPointer: false },
    hand: { grabPointer: false, teleportPointer: false },
    gaze: false,
    screenInput: false,
  });
}

function reasonOf(error: unknown): XrEndReason {
  const name = error instanceof Error || error instanceof DOMException ? error.name : "";
  return name === "SecurityError" || name === "NotAllowedError" ? "blocked" : "failed";
}

/** SDF text from the self-hosted font. */
function Label(props: {
  text: string;
  size: number;
  position: [number, number, number];
  color?: string;
  font?: string;
  anchorX?: "left" | "center";
  anchorY?: "bottom" | "middle";
}) {
  const { text, size, color = "#f4efe6", font = FONT_SEMIBOLD, anchorX = "left", anchorY = "bottom" } = props;
  const mesh = useMemo(() => new Text(), []);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    Object.assign(mesh, { text, fontSize: size, color, font, anchorX, anchorY });
    mesh.sync(() => invalidate());
  }, [mesh, text, size, color, font, anchorX, anchorY, invalidate]);
  useEffect(() => () => mesh.dispose(), [mesh]);
  return <primitive object={mesh} position={props.position} />;
}

/** Starts the session once <XR> is mounted, and reports how it ends. */
function Session({ store, onStarted, onEnded }: { store: XRStore } & Omit<XrSessionProps, "onCard">) {
  const asked = useRef(false);
  const callbacks = useRef({ onStarted, onEnded });
  useEffect(() => {
    callbacks.current = { onStarted, onEnded };
  });

  // Subscribe before entering, and on every mount (dev strict mode mounts twice).
  useEffect(() => store.onSessionEnd(() => callbacks.current.onEnded("ended")), [store]);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    store.enterVR().then(
      (session) => (session ? callbacks.current.onStarted() : callbacks.current.onEnded("failed")),
      (error) => callbacks.current.onEnded(reasonOf(error)),
    );
  }, [store]);

  // Leaving the page (or the door unmounting) ends a running session.
  useEffect(() => () => void store.getState().session?.end(), [store]);
  return null;
}

/** The case, its slot targets, labels and the exit, placed in front of the viewer. */
function HeadsetCase({ store, onCard }: { store: XRStore; onCard: XrSessionProps["onCard"] }) {
  const group = useRef<THREE.Group>(null);
  const placed = useRef(false);
  const rig = useRef<CaseRig | null>(null);
  const hovered = useRef<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const onCardRef = useRef(onCard);
  useEffect(() => {
    onCardRef.current = onCard;
  });

  useEffect(() => {
    const built = createRig(layout);
    built.applyTokens(readTokens());
    rig.current = built;
    const holder = group.current;
    holder?.add(built.group);
    let live = true;
    buildAtlas(layout).then((atlas) => {
      if (!live) return atlas?.texture.dispose();
      if (atlas) built.setAtlas(atlas.texture, atlas.rects);
    });
    return () => {
      live = false;
      holder?.remove(built.group);
      built.dispose();
      rig.current = null;
    };
  }, []);

  useFrame((state, dt) => {
    // Place the case once, from the first tracked head pose (yaw only, measured height).
    if (!placed.current && state.gl.xr.isPresenting && group.current) {
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      state.camera.getWorldPosition(position);
      state.camera.getWorldQuaternion(quaternion);
      if (position.lengthSq() > 1e-4) {
        const p = placeCase({ position, quaternion });
        group.current.position.copy(p.position);
        group.current.rotation.set(0, p.rotationY, 0);
        group.current.visible = true;
        placed.current = true;
      }
    }
    rig.current?.step(hovered.current ?? selectedRef.current, dt);
  });

  function select(slug: string) {
    const next = selectedRef.current === slug ? null : slug;
    selectedRef.current = next;
    setSelected(next);
    onCardRef.current(next ? { slug: next, title: titleOf(next) } : null);
  }

  return (
    <group ref={group} visible={false}>
      {planes.map((p) => (
        <mesh
          key={p.slug}
          name={`slot:${p.slug}`}
          position={[p.x, p.y, p.z]}
          pointerEventsType={{ deny: "grab" }}
          onPointerOver={() => (hovered.current = p.slug)}
          onPointerOut={() => hovered.current === p.slug && (hovered.current = null)}
          onClick={() => select(p.slug)}
        >
          <planeGeometry args={[p.w, p.h]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
      {labels.map((l) => (
        <Label
          key={l.slug}
          text={l.text}
          size={LABEL_SIZE}
          position={[l.x, l.y, l.z]}
          color={l.slug === selected ? "#ffb547" : "#f4efe6"}
        />
      ))}
      <mesh
        name="exit"
        position={[0, EXIT.y, layout.depth / 2]}
        pointerEventsType={{ deny: "grab" }}
        onClick={() => void store.getState().session?.end()}
      >
        <planeGeometry args={[EXIT.w, EXIT.h]} />
        <meshBasicMaterial color="#1b1d22" />
      </mesh>
      <Label text="Exit VR" size={0.035} position={[0, EXIT.y, layout.depth / 2 + 0.002]} anchorX="center" anchorY="middle" />
    </group>
  );
}

/**
 * The headset mode: a 2 px, invisible canvas on the page (the headset gets its own frames),
 * an XR store, and the case placed 1 m in front of the viewer.
 */
export default function XrSession({ onStarted, onEnded, onCard }: XrSessionProps) {
  const [store] = useState(() => makeStore(window.location.origin));
  return (
    <div className="xr-session" aria-hidden="true">
      <Canvas flat dpr={1} gl={{ antialias: true }}>
        <XR store={store}>
          <color attach="background" args={[SPACE]} />
          <ambientLight intensity={1.4} />
          <directionalLight position={[0.6, 1.2, 2]} intensity={2} />
          <XROrigin />
          <HeadsetCase store={store} onCard={onCard} />
          <Session store={store} onStarted={onStarted} onEnded={onEnded} />
        </XR>
      </Canvas>
    </div>
  );
}
