/**
 * Whether this visitor gets the live 3D case or the still poster. The scene loads only on
 * a wide screen with a fine pointer, without reduced motion, and with WebGL2. Phones,
 * tablets, reduced motion and no-WebGL all keep the poster (design brief sections 3, 10).
 */
export type SceneEnv = { wide: boolean; finePointer: boolean; reducedMotion: boolean; webgl2: boolean };

export const WIDE_QUERY = "(min-width: 1024px)";
export const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function shouldLoadScene(env: SceneEnv): boolean {
  return env.wide && env.finePointer && !env.reducedMotion && env.webgl2;
}

let webgl2Cache: boolean | undefined;

/** Probes WebGL2 once per page and releases the probe context right away. */
export function hasWebGL2(): boolean {
  if (webgl2Cache !== undefined) return webgl2Cache;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    webgl2Cache = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl2Cache = false;
  }
  return webgl2Cache;
}

export function readSceneEnv(): SceneEnv {
  const match = (q: string) => typeof window.matchMedia === "function" && window.matchMedia(q).matches;
  return {
    wide: match(WIDE_QUERY),
    finePointer: match(FINE_POINTER_QUERY),
    reducedMotion: match(REDUCED_MOTION_QUERY),
    webgl2: hasWebGL2(),
  };
}

/** Calls fn whenever any gate query changes; returns an unsubscribe function. */
export function onSceneEnvChange(fn: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const lists = [WIDE_QUERY, FINE_POINTER_QUERY, REDUCED_MOTION_QUERY].map((q) => window.matchMedia(q));
  lists.forEach((l) => l.addEventListener("change", fn));
  return () => lists.forEach((l) => l.removeEventListener("change", fn));
}

/** Resolves after the page has loaded and the browser is idle (or 2 s, whichever is first). */
export function afterLoadAndIdle(): Promise<void> {
  const loaded =
    document.readyState === "complete"
      ? Promise.resolve()
      : new Promise<void>((resolve) => window.addEventListener("load", () => resolve(), { once: true }));
  return loaded.then(
    () =>
      new Promise<void>((resolve) => {
        if ("requestIdleCallback" in window) window.requestIdleCallback(() => resolve(), { timeout: 2000 });
        else setTimeout(resolve, 200);
      }),
  );
}
