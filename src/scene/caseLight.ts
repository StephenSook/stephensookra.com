import { useSyncExternalStore } from "react";

/**
 * Which slot of the case is lit, shared by the HTML grid and the 3D scene.
 * Each side keeps its own slug; the scene's wins while the pointer is on the canvas,
 * and when it clears, the grid's (hover or keyboard focus) shows again.
 */
export type LightSource = "grid" | "scene";
export type LightState = { slug: string | null; source: LightSource | null };

const slugs: Record<LightSource, string | null> = { grid: null, scene: null };
let state: LightState = { slug: null, source: null };
const listeners = new Set<() => void>();

function recompute() {
  const next: LightState = slugs.scene
    ? { slug: slugs.scene, source: "scene" }
    : slugs.grid
      ? { slug: slugs.grid, source: "grid" }
      : { slug: null, source: null };
  if (next.slug === state.slug && next.source === state.source) return;
  state = next;
  for (const fn of listeners) fn();
}

export const caseLight = {
  get: (): LightState => state,
  set(source: LightSource, slug: string | null) {
    if (slugs[source] === slug) return;
    slugs[source] = slug;
    recompute();
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  /** Test helper: back to nothing lit, listeners kept. */
  reset() {
    slugs.grid = null;
    slugs.scene = null;
    recompute();
  },
};

const serverState: LightState = { slug: null, source: null };

export function useCaseLight(): LightState {
  return useSyncExternalStore(caseLight.subscribe, caseLight.get, () => serverState);
}
