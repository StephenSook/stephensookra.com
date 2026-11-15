// Imported only through the client CaseStage, so it may take function props (test seams).
import { useEffect, useState, type ComponentType } from "react";
import type { CaseSceneProps } from "@/scene/CaseScene";
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
  const { slug } = useCaseLight();

  // Track the gate: screen width, pointer, reduced motion, WebGL2.
  useEffect(() => {
    const update = () => setOpen(shouldLoadScene(readEnv()));
    update();
    return onEnvChange(update);
  }, [readEnv, onEnvChange]);

  // Load the scene once the gate opens (after load and idle); keep the module for reuse.
  useEffect(() => {
    if (!open || lost || Scene) return;
    let cancelled = false;
    waitForIdle()
      .then(loadScene)
      .then((mod) => {
        if (!cancelled) setScene(() => mod.default);
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
      aria-hidden="true"
    >
      <div className="case-stage__poster">{children}</div>
      {showScene ? (
        <div className="case-stage__scene">
          <Scene
            onReady={() => setPhase("ready")}
            onContextLost={() => {
              setLost(true);
              setPhase("poster");
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
