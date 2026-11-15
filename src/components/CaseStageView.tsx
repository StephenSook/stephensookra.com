// Imported only through the client CaseStage, so it may take function props (test seams).
import { Component, useCallback, useEffect, useState, type ComponentType, type ReactNode } from "react";
import type { CaseSceneProps, IntroState } from "@/scene/CaseScene";
import { useCaseLight } from "@/scene/caseLight";
import { afterLoadAndIdle, onSceneEnvChange, readSceneEnv, shouldLoadScene, type SceneEnv } from "@/scene/gate";

type SceneModule = { default: ComponentType<CaseSceneProps> };
type Phase = "poster" | "loading" | "ready";

type Props = {
  variant: "hero" | "full";
  /** The server-rendered poster; it stays underneath and shows whenever the scene does not. */
  children: React.ReactNode;
  /** Seams for tests; the defaults are the real gate, idle wait and lazy import. */
  readEnv?: () => SceneEnv;
  onEnvChange?: (fn: () => void) => () => void;
  waitForIdle?: () => Promise<void>;
  loadScene?: () => Promise<SceneModule>;
};

const importScene = () => import("@/scene/CaseScene");

/**
 * Keeps a renderer failure (for example WebGL context creation failing after a good probe)
 * inside the stage: the scene unmounts and the poster stays, instead of the error reaching
 * the route boundary and taking the grid with it.
 */
class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The poster first, then (on wide fine-pointer screens without reduced motion and with
 * WebGL2) the live 3D case, loaded after the page is idle and faded in over the poster.
 * The whole stage is aria-hidden: the HTML grid is the keyboard and screen-reader path.
 */
export function CaseStageView({
  variant,
  children,
  readEnv = readSceneEnv,
  onEnvChange = onSceneEnvChange,
  waitForIdle = afterLoadAndIdle,
  loadScene = importScene,
}: Props) {
  const [Scene, setScene] = useState<SceneModule["default"] | null>(null);
  const [phase, setPhase] = useState<Phase>("poster");
  const [lost, setLost] = useState(false);
  const [open, setOpen] = useState(false);
  const [intro, setIntro] = useState<IntroState | null>(null);
  const { slug } = useCaseLight();

  // Track the gate: screen width, pointer, reduced motion, WebGL2. When it closes, the scene
  // unmounts; resetting the phase means a later reopen waits for a fresh first frame.
  useEffect(() => {
    const update = () => {
      const isOpen = shouldLoadScene(readEnv());
      setOpen(isOpen);
      if (!isOpen) setPhase("poster");
    };
    update();
    return onEnvChange(update);
  }, [readEnv, onEnvChange]);

  const handleReady = useCallback(() => setPhase("ready"), []);
  const handleContextLost = useCallback(() => {
    setLost(true);
    setPhase("poster");
  }, []);

  // Load the scene once the gate opens (after load and idle); keep the module for reuse.
  useEffect(() => {
    if (!open || lost || Scene) return;
    let cancelled = false;
    waitForIdle()
      // The gate may have closed, or the page gone, while waiting: then three.js never loads.
      .then(() => (cancelled ? null : loadScene()))
      .then((mod) => {
        if (mod && !cancelled) setScene(() => mod.default);
      })
      .catch(() => {
        // A failed chunk load leaves the poster in place.
      });
    return () => {
      cancelled = true;
    };
  }, [open, lost, Scene, waitForIdle, loadScene]);

  const showScene = open && !lost && Scene !== null;

  return (
    <div
      className={`case-stage case-stage--${variant}`}
      data-scene={showScene ? phase : "poster"}
      data-lit={slug ?? undefined}
      data-intro={showScene && intro ? intro : undefined}
      aria-hidden="true"
    >
      <div className="case-stage__poster">{children}</div>
      {showScene ? (
        <div className="case-stage__scene">
          <SceneBoundary onError={handleContextLost}>
            <Scene onReady={handleReady} onContextLost={handleContextLost} onIntro={setIntro} />
          </SceneBoundary>
        </div>
      ) : null}
    </div>
  );
}
