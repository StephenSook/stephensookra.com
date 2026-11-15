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
  loadChunk?(name: string): Promise<void>;
}

type EngineWindow = Window & { XR8?: XR8Api };

let loading: Promise<XR8Api> | null = null;

/**
 * Adds the engine's script once (with its image-target chunk) and resolves with XR8. A failed
 * load is forgotten, so a later press can try again.
 */
export function loadEngine(src = ENGINE_SRC): Promise<XR8Api> {
  const w = window as EngineWindow;
  if (w.XR8?.XrController) return Promise.resolve(w.XR8);
  loading ??= new Promise<XR8Api>((resolve, reject) => {
    const fail = (why: string) => {
      loading = null;
      script.remove();
      reject(new Error(why));
    };
    const ready = async () => {
      const xr8 = w.XR8;
      if (!xr8) return fail("the 8th Wall engine loaded without XR8");
      // The chunk normally arrives with the script (data-preload-chunks); ask once more if not.
      if (!xr8.XrController) await xr8.loadChunk?.("slam").catch(() => {});
      if (!xr8.XrController) return fail("the image target chunk did not load");
      resolve(xr8);
    };
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.preloadChunks = "slam";
    script.onerror = () => fail("the 8th Wall engine did not load");
    window.addEventListener("xrloaded", () => void ready(), { once: true });
    document.head.append(script);
  });
  return loading;
}
