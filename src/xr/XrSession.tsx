// The headset session, VR or passthrough AR. Loaded only after a press on the door (dynamic
// import), so none of this, @react-three/xr or troika, is in any page's first load.
import { Canvas, useFrame } from "@react-three/fiber";
import { XR, XROrigin, createXRStore, useXR, type XRStore } from "@react-three/xr";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { featured } from "@/content";
import specJson from "@/scene/case-spec.json";
import { buildAtlas, readTokens } from "@/scene/caseAssets";
import { buildLayout } from "@/scene/layout";
import { createRig, type CaseRig } from "@/scene/rig";
import { xrAssetBase } from "./assets";
import { CardPanel } from "./CardPanel";
import { CARD_IN_FRONT } from "./cardLayout";
import { createFrameStats, statsText, wantsStats } from "./frameStats";
import { FONT_REGULAR, Label } from "./Label";
import { slotLabels, LABEL_SIZE } from "./labels";
import { pickPlanes, placeCase } from "./placement";
import { createEntry } from "./entry";
import { createPointing, type Pointing } from "./pointing";
import { createPresses } from "./press";
import type { XrSessionProps } from "./types";
import { createVideoController } from "./video";
import type { WallPose } from "./wall";
import { WallFinder } from "./WallFinder";

const layout = buildLayout(specJson);
const planes = pickPlanes(layout);
const labels = slotLabels(layout, featured);
const titleOf = (slug: string) => featured.find((p) => p.slug === slug)?.title ?? slug;
/** The front of a slot, where its card starts from, in case space. */
const selectedFrom = (slug: string | null): [number, number, number] => {
  const plane = planes.find((p) => p.slug === slug);
  return plane ? [plane.x, plane.y, plane.z] : CARD_REST;
};

/** A plain dark space around the case: no room, no walls (design brief section 9). */
const SPACE = "#0b0c0f";
const EXIT = { w: 0.3, h: 0.1, y: -layout.height / 2 - 0.1 };
/** Where a pulled card rests, in case space: centred, 0.35 m in front of the case face. */
const CARD_REST: [number, number, number] = [0, 0, layout.depth / 2 + CARD_IN_FRONT];

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
    // Passthrough asks for hit test, anchors and plane and mesh detection (the library's
    // defaults, all optional); no DOM overlay, which the headset browsers do not offer.
    domOverlay: false,
    // Select only: no grabbing or teleporting, and no head-gaze or screen pointers.
    controller: { grabPointer: false, teleportPointer: false },
    hand: { grabPointer: false, teleportPointer: false },
    gaze: false,
    screenInput: false,
  });
}

/**
 * Hands the door a way to ask for VR or passthrough (the door asks at once for the first
 * press, then from later presses), and reports how each session ends. The door keeps this
 * mounted between visits; only a real unmount (leaving the page) releases it, which ends a
 * running session and any session the browser grants afterwards.
 */
function Session({ store, onEnded, onReady }: { store: XRStore } & Pick<XrSessionProps, "onEnded" | "onReady">) {
  const callbacks = useRef({ onEnded, onReady });
  useEffect(() => {
    callbacks.current = { onEnded, onReady };
  });
  const entry = useRef<ReturnType<typeof createEntry> | null>(null);
  const pendingRelease = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => store.onSessionEnd(() => callbacks.current.onEnded("ended")), [store]);

  useEffect(() => {
    // Dev strict mode runs cleanup and setup back to back: keep the entry in that case.
    if (pendingRelease.current) clearTimeout(pendingRelease.current);
    pendingRelease.current = null;
    const current = (entry.current ??= createEntry(store, {
      // "In VR" is announced by the case once it is placed, not when the session is granted.
      onStarted: () => {},
      onEnded: (reason) => callbacks.current.onEnded(reason),
    }));
    callbacks.current.onReady(current.enter);
    return () => {
      pendingRelease.current = setTimeout(() => {
        current.release();
        void store.getState().session?.end();
      }, 0);
    };
  }, [store]);
  return null;
}

/** A plain dark space in VR; none in passthrough, where the reader's room shows through. */
function Background() {
  const mode = useXR((s) => s.mode);
  return mode === "immersive-ar" ? null : <color attach="background" args={[SPACE]} />;
}

/** ?xrstats=1: the session's target rate and the measured rate, under the case. */
function Stats({ store }: { store: XRStore }) {
  const stats = useMemo(() => createFrameStats(), []);
  const [text, setText] = useState(() => statsText(undefined, stats.summary()));
  const since = useRef(0);
  useFrame((_state, dt) => {
    stats.push(dt);
    since.current += dt;
    if (since.current < 0.5) return;
    since.current = 0;
    setText(statsText(store.getState().session?.frameRate, stats.summary()));
  });
  return (
    <Label
      text={text}
      size={0.02}
      position={[-layout.width / 2, EXIT.y, layout.depth / 2]}
      anchorY="middle"
      maxWidth={0.5}
      font={FONT_REGULAR}
      color="#cfd3da"
    />
  );
}

/**
 * The case, its slot targets, labels and the exit. In VR it stands in front of the viewer;
 * in passthrough it waits for a wall (WallFinder) and hangs there on a select, held by an
 * anchor so it stays put while the reader walks around.
 */
function HeadsetCase({
  store,
  onCard,
  onPlaced,
  pointing,
  showStats,
}: {
  store: XRStore;
  onCard: XrSessionProps["onCard"];
  /** Called each time the case is placed, in front of the reader or on a wall (once per session). */
  onPlaced: () => void;
  pointing: Pointing;
  showStats: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const placed = useRef(false);
  const rig = useRef<CaseRig | null>(null);
  const hovered = useRef<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // The slot the card last came from: it slides back there when put away.
  const [lastOpened, setLastOpened] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const onCardRef = useRef(onCard);
  const onPlacedRef = useRef(onPlaced);
  useEffect(() => {
    onCardRef.current = onCard;
    onPlacedRef.current = onPlaced;
  });

  // The session's one video element and its texture (design brief: one video at a time).
  // The texture is made and disposed by the same effect, so each setup has a live one.
  // Selects count on press and release on the same target, however long the press (./press).
  const presses = useMemo(() => createPresses(), []);
  const video = useMemo(() => createVideoController(), []);
  const mode = useXR((s) => s.mode);
  const session = useXR((s) => s.session);
  // Passthrough: where the case would go now, whether a pointer is on the hint's Exit, the
  // anchor that holds the placed case, and whether the case is on the wall yet.
  const candidate = useRef<WallPose | null>(null);
  const onHintExit = useRef(false);
  const anchor = useRef<XRAnchor | null>(null);
  /** Set by a select; the next frame makes the anchor (createAnchor needs a live frame). */
  const anchorWanted = useRef<WallPose | null>(null);
  const [onWall, setOnWall] = useState(false);
  const texture = useRef<THREE.VideoTexture | null>(null);
  useEffect(() => {
    const t = new THREE.VideoTexture(video.element() as HTMLVideoElement);
    t.colorSpace = THREE.SRGBColorSpace;
    texture.current = t;
    return () => {
      t.dispose();
      if (texture.current === t) texture.current = null;
    };
  }, [video]);
  const getTexture = useCallback(() => texture.current, []);
  useEffect(() => () => video.stop(), [video]);

  // When a session ends, the next one starts fresh: placed again from the new head pose,
  // with no card out (which also stops the video).
  useEffect(
    () =>
      store.subscribe((state, prev) => {
        if (!prev.session || state.session) return;
        placed.current = false;
        if (group.current) group.current.visible = false;
        try {
          anchor.current?.delete();
        } catch {
          // ended with the session
        }
        anchor.current = null;
        anchorWanted.current = null;
        candidate.current = null;
        onHintExit.current = false;
        setOnWall(false);
        hovered.current = null;
        selectedRef.current = null;
        setSelected(null);
      }),
    [store],
  );

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

  // Passthrough: a select (any hand or controller) hangs the case where the outline shows it,
  // unless that select was on the hint's Exit. No wall in view: nothing happens.
  useEffect(() => {
    if (!session || mode !== "immersive-ar") return;
    const place = () => {
      const pose = candidate.current;
      const holder = group.current;
      if (placed.current || !pose || onHintExit.current || !holder) return;
      holder.position.copy(pose.position);
      holder.quaternion.copy(pose.quaternion);
      holder.visible = true;
      placed.current = true;
      setOnWall(true);
      onPlacedRef.current();
      anchorWanted.current = pose;
    };
    session.addEventListener("select", place);
    return () => session.removeEventListener("select", place);
  }, [session, mode, store]);

  useFrame((state, dt) => {
    // Passthrough: anchor the hung case, inside this frame (an anchor asked for after the
    // frame has ended is refused).
    const wanted = anchorWanted.current;
    if (wanted) {
      anchorWanted.current = null;
      const frame = state.gl.xr.getFrame();
      const space = store.getState().originReferenceSpace;
      const forSession = store.getState().session;
      const { x, y, z } = wanted.position;
      const q = wanted.quaternion;
      if (frame?.createAnchor && space) {
        frame.createAnchor(new XRRigidTransform({ x, y, z }, { x: q.x, y: q.y, z: q.z, w: q.w }), space)?.then(
          (made) => {
            if (placed.current && store.getState().session === forSession) anchor.current = made;
            else made.delete();
          },
          () => {
            // No anchors here: the case still stays where it was hung.
          },
        );
      }
    }
    // Passthrough: follow the anchor, which the headset keeps on the wall as it tracks.
    if (anchor.current && group.current) {
      const frame = state.gl.xr.getFrame();
      const space = store.getState().originReferenceSpace;
      const pose = frame && space ? frame.getPose(anchor.current.anchorSpace, space) : undefined;
      if (pose) {
        const { position: p, orientation: o } = pose.transform;
        group.current.position.set(p.x, p.y, p.z);
        group.current.quaternion.set(o.x, o.y, o.z, o.w);
      }
    }
    // VR: place the case once, from the first tracked head pose (yaw only, measured height).
    if (mode !== "immersive-ar" && !placed.current && state.gl.xr.isPresenting && group.current) {
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
        onPlacedRef.current();
      }
    }
    rig.current?.step(hovered.current ?? selectedRef.current, dt);
  });

  /** Selecting the open card's slot again, or Close, puts the card back. */
  function select(slug: string | null) {
    const next = slug === null || selectedRef.current === slug ? null : slug;
    selectedRef.current = next;
    setSelected(next);
    if (next) setLastOpened(next);
    onCardRef.current(next ? { slug: next, title: titleOf(next) } : null);
  }

  return (
    <>
      {mode === "immersive-ar" && !onWall && (
        <WallFinder
          size={layout}
          candidateRef={candidate}
          onExitRef={onHintExit}
          exit={() => void store.getState().session?.end()}
          pointing={pointing}
          presses={presses}
        />
      )}
      <group ref={group} visible={false}>
        {planes.map((p) => (
          <mesh
            key={p.slug}
            name={`slot:${p.slug}`}
            position={[p.x, p.y, p.z]}
            pointerEventsType={{ deny: "grab" }}
            onPointerOver={() => {
              hovered.current = p.slug;
              pointing.over(p.slug);
            }}
            onPointerOut={(e) => {
              if (hovered.current === p.slug) hovered.current = null;
              pointing.out(p.slug);
              presses.leave(p.slug, e.pointerId);
            }}
            onPointerDown={(e) => presses.down(p.slug, e.pointerId)}
            onPointerUp={(e) => presses.up(p.slug, e.pointerId) && select(p.slug)}
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
          onPointerDown={(e) => presses.down("exit", e.pointerId)}
          onPointerUp={(e) => presses.up("exit", e.pointerId) && void store.getState().session?.end()}
          onPointerOver={() => pointing.over("exit")}
          onPointerOut={(e) => {
            pointing.out("exit");
            presses.leave("exit", e.pointerId);
          }}
        >
          <planeGeometry args={[EXIT.w, EXIT.h]} />
          <meshBasicMaterial color="#1b1d22" />
        </mesh>
        <Label
          text="Exit VR"
          size={0.035}
          position={[0, EXIT.y, layout.depth / 2 + 0.002]}
          anchorX="center"
          anchorY="middle"
        />
        <CardPanel
          project={featured.find((p) => p.slug === selected) ?? null}
          from={selectedFrom(lastOpened)}
          to={CARD_REST}
          video={video}
          texture={getTexture}
          onClose={() => select(null)}
          pointing={pointing}
          presses={presses}
        />
        {showStats && <Stats store={store} />}
      </group>
    </>
  );
}

/**
 * The headset modes: a 2 px, invisible canvas on the page (the headset gets its own frames),
 * an XR store, and the case placed 1 m in front of the viewer (VR) or on a wall (passthrough).
 */
export default function XrSession({ onStarted, onEnded, onCard, onReady }: XrSessionProps) {
  const [store] = useState(() => makeStore(window.location.origin));
  const [showStats] = useState(() => wantsStats(window.location.search));
  // The page element that carries data-pointing (see ./pointing).
  const [wrapper, setWrapper] = useState<HTMLDivElement | null>(null);
  const pointing = useMemo(() => createPointing(wrapper), [wrapper]);
  return (
    <div ref={setWrapper} className="xr-session" aria-hidden="true" data-pointing="">
      {/* demand: idle between visits; the headset session drives its own frames. */}
      <Canvas flat dpr={1} frameloop="demand" gl={{ antialias: true }}>
        <XR store={store}>
          <Background />
          <ambientLight intensity={1.4} />
          <directionalLight position={[0.6, 1.2, 2]} intensity={2} />
          <XROrigin />
          <HeadsetCase store={store} onCard={onCard} onPlaced={onStarted} pointing={pointing} showStats={showStats} />
          <Session store={store} onEnded={onEnded} onReady={onReady} />
        </XR>
      </Canvas>
    </div>
  );
}
