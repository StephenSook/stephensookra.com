// Imported only by the client CaseStage (dynamic import), so this module is not a
// client boundary itself and may take function props.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import specJson from "./case-spec.json";
import { caseLight } from "./caseLight";
import { buildAtlas, readTokens } from "./caseAssets";
import { buildLayout } from "./layout";
import { fitCamera, pickSlot } from "./pick";
import { createRig, type CaseRig } from "./rig";

const layout = buildLayout(specJson);

export type CaseSceneProps = {
  /** Called once the first frame (with posters, or without if they failed) is on screen. */
  onReady?: () => void;
  /** Called if the browser drops the WebGL context; the stage then shows the poster. */
  onContextLost?: () => void;
};

function Case({ onReady, onContextLost }: CaseSceneProps) {
  const router = useRouter();
  const { gl, scene, size, set, get, invalidate } = useThree();
  const rigRef = useRef<CaseRig | null>(null);
  // Callbacks live in refs so a parent re-render (every light change re-renders the stage)
  // never re-runs the effects below: re-running them cleared the light and rebuilt the atlas.
  const onReadyRef = useRef(onReady);
  const onLostRef = useRef(onContextLost);
  const routerRef = useRef(router);
  useEffect(() => {
    onReadyRef.current = onReady;
    onLostRef.current = onContextLost;
    routerRef.current = router;
  });

  // Build the case once, add it to the scene, dispose it on unmount.
  useEffect(() => {
    const rig = createRig(layout);
    rigRef.current = rig;
    scene.add(rig.group);
    rig.applyTokens(readTokens());
    invalidate();
    return () => {
      scene.remove(rig.group);
      rig.dispose();
      rigRef.current = null;
    };
  }, [scene, invalidate]);

  // Camera fitted to the canvas, refitted on resize.
  useEffect(() => {
    set({ camera: fitCamera(layout, size.width / Math.max(size.height, 1)) });
    invalidate();
  }, [size.width, size.height, set, invalidate]);

  // Colours follow the CSS tokens when the colour scheme changes.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      rigRef.current?.applyTokens(readTokens());
      invalidate();
    };
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [invalidate]);

  // Posters, then the first frame, then ready.
  useEffect(() => {
    let cancelled = false;
    buildAtlas(layout).then((atlas) => {
      if (cancelled) {
        atlas?.texture.dispose();
        return;
      }
      if (atlas) rigRef.current?.setAtlas(atlas.texture, atlas.rects);
      invalidate();
      requestAnimationFrame(() => {
        if (!cancelled) onReadyRef.current?.();
      });
    });
    return () => {
      cancelled = true;
    };
  }, [invalidate]);

  // Pointer: light the slot under it, tilt slightly towards it, click to open the project.
  useEffect(() => {
    const el = gl.domElement;
    const ndcOf = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 };
    };
    // Pick where the case is drawn now: it tilts towards the pointer.
    const pick = (ndc: { x: number; y: number }) => {
      const group = rigRef.current?.group;
      group?.updateMatrixWorld();
      return pickSlot(ndc, get().camera, layout, group?.matrixWorld);
    };
    const onMove = (e: PointerEvent) => {
      const ndc = ndcOf(e);
      const slug = pick(ndc);
      caseLight.set("scene", slug);
      el.style.cursor = slug ? "pointer" : "default";
      rigRef.current?.setPointer(ndc);
      invalidate();
    };
    const onLeave = () => {
      caseLight.set("scene", null);
      el.style.cursor = "default";
      rigRef.current?.setPointer(null);
      invalidate();
    };
    const onClick = (e: MouseEvent) => {
      const slug = pick(ndcOf(e));
      if (slug) routerRef.current.push(`/work/${slug}`);
    };
    const onLost = (e: Event) => {
      e.preventDefault();
      onLostRef.current?.();
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("click", onClick);
    el.addEventListener("webglcontextlost", onLost);
    const unsubscribe = caseLight.subscribe(() => invalidate());
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("click", onClick);
      el.removeEventListener("webglcontextlost", onLost);
      unsubscribe();
      caseLight.set("scene", null);
    };
  }, [gl, get, invalidate]);

  // Ease lights and tilt; with frameloop="demand", keep asking for frames only while moving.
  useFrame((_state, dt) => {
    if (rigRef.current?.step(caseLight.get().slug, dt)) invalidate();
  });

  return null;
}

/** The lit letter case. Lazy-loaded by CaseStage; never rendered on the server. */
export default function CaseScene(props: CaseSceneProps) {
  return (
    // flat: no tone mapping, so the wood keeps the model's colour instead of a washed-out one.
    <Canvas dpr={[1, 1.75]} frameloop="demand" flat gl={{ antialias: true, alpha: true }} aria-hidden="true">
      {/* Matched to the Blender poster's lighting, so the crossfade shows no step. */}
      <ambientLight intensity={1.4} />
      <directionalLight position={[0.6, 1.2, 2]} intensity={2} />
      <Case {...props} />
    </Canvas>
  );
}
