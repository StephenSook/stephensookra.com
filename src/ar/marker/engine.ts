// The open-source 8th Wall engine (MIT), self-hosted under /vendor (scripts/vendor/8thwall.sh).
// Only the calls this site makes are typed.

export const ENGINE_SRC = "/vendor/8thwall/0.1.0/xr.js";

type Vec3 = { x: number; y: number; z: number };
export type ImageEventDetail = {
  name: string;
  position: Vec3;
  rotation: Vec3 & { w: number };
  scale: number;
  scaledWidth: number;
  scaledHeight: number;
};
export type Reality = { intrinsics?: ArrayLike<number>; position?: Vec3; rotation?: Vec3 & { w: number } };

export type PipelineModule = {
  name: string;
  onStart?: (args: { canvas: HTMLCanvasElement; GLctx: WebGL2RenderingContext }) => void;
  onCanvasSizeChange?: (args: { canvasWidth: number; canvasHeight: number }) => void;
  onUpdate?: (args: { processCpuResult: { reality?: Reality } }) => void;
  onRender?: () => void;
  onCameraStatusChange?: (args: { status: "requesting" | "hasStream" | "hasVideo" | "failed" }) => void;
  onException?: (error: unknown) => void;
  onDetach?: () => void;
  listeners?: { event: string; process: (args: { detail: ImageEventDetail }) => void }[];
};

export type ImageTargetData = { name: string; type: string; imagePath: string; properties: Record<string, unknown> };

export interface XR8Api {
  XrController: {
    configure(options: { disableWorldTracking?: boolean; imageTargetData?: ImageTargetData[] }): void;
    pipelineModule(): PipelineModule;
    updateCameraProjectionMatrix(options: {
      cam: { pixelRectWidth: number; pixelRectHeight: number; nearClipPlane: number; farClipPlane: number };
    }): void;
  };
  GlTextureRenderer: { pipelineModule(): PipelineModule };
  XrConfig: { device(): { ANY: string } };
  addCameraPipelineModules(modules: PipelineModule[]): void;
  clearCameraPipelineModules(): void;
  run(options: { canvas: HTMLCanvasElement; allowedDevices?: string }): void;
  stop(): void;
  loadChunk?(chunk: string | { name: string; url: string }): Promise<void>;
}

type EngineWindow = Window & { XR8?: XR8Api };

/** How long the engine script, and then its image-target chunk, may take before we give up. */
export const READY_MS = 30_000;

let script: Promise<XR8Api> | null = null;
let loading: Promise<XR8Api> | null = null;
/** Failed tries at the tracking chunk so far (each retry asks for a fresh address). */
let chunkFailures = 0;

function withTimeout<T>(work: Promise<T>, ms: number, why: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(why)), ms);
  });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

/** Adds xr.js once and resolves with XR8 when it says it is loaded. A failure is forgotten. */
function addScript(src: string): Promise<XR8Api> {
  const w = window as EngineWindow;
  if (w.XR8) return Promise.resolve(w.XR8);
  script ??= new Promise<XR8Api>((resolve, reject) => {
    const tag = document.createElement("script");
    const settle = (finish: () => void) => {
      clearTimeout(timer);
      window.removeEventListener("xrloaded", loaded);
      finish();
    };
    const fail = (why: string) =>
      settle(() => {
        script = null;
        tag.remove();
        reject(new Error(why));
      });
    function loaded() {
      settle(() => (w.XR8 ? resolve(w.XR8) : reject(new Error("the 8th Wall engine loaded without XR8"))));
    }
    tag.src = src;
    tag.async = true;
    tag.onerror = () => fail("the 8th Wall engine did not load");
    const timer = setTimeout(() => fail("the 8th Wall engine did not start in time"), READY_MS);
    window.addEventListener("xrloaded", loaded);
    document.head.append(tag);
  });
  return script;
}

/**
 * Loads the engine, then its image-target chunk (xr-tracking.js) as a separate, awaited step:
 * with the chunk preloaded through the script tag instead, a chunk that fails to load leaves
 * the engine silent (no XR8, no xrloaded) and nothing would ever settle. Both steps have a
 * time limit, and a failure is forgotten, so a later press can try again.
 */
export function loadEngine(src = ENGINE_SRC): Promise<XR8Api> {
  loading ??= (async () => {
    const xr8 = await addScript(src);
    if (!xr8.XrController) {
      if (!xr8.loadChunk) throw new Error("this engine build cannot load image targets");
      // Safari keeps a failed module import for its URL, so a retry must ask at a new one.
      const chunk = chunkFailures
        ? { name: "slam", url: new URL(`xr-tracking.js?retry=${chunkFailures}`, new URL(src, location.href)).href }
        : "slam";
      await withTimeout(xr8.loadChunk(chunk), READY_MS, "the image target chunk did not load in time").catch(
        (error: unknown) => {
          chunkFailures += 1;
          throw error;
        },
      );
    }
    if (!xr8.XrController) throw new Error("the image target chunk did not load");
    return xr8;
  })().catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}
