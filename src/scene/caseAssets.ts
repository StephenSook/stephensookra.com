import * as THREE from "three";
import { featured } from "@/content";
import specJson from "./case-spec.json";
import type { CaseLayout } from "./layout";
import type { AtlasRect, Tokens } from "./rig";

// Shared by the page scene (CaseScene) and the headset scene (src/xr/XrSession).

/**
 * The wood and the slot backs come from the case model, the same in both colour schemes
 * (the case is a dark object on any page). The slot light is the site's accent token.
 */
export function readTokens(): Tokens {
  const light = getComputedStyle(document.documentElement).getPropertyValue("--slot").trim() || "#ffb547";
  return { wood: specJson.colors.wood, back: specJson.colors.back, light };
}

/** Packs the project posters into one texture, with a cover-cropped atlas rect per slot. */
export async function buildAtlas(caseLayout: CaseLayout) {
  const CELL_W = 512;
  const CELL_H = 288;
  const COLS = 2;
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const rects = new Map<string, AtlasRect>();
  let cell = 0;
  for (const slot of caseLayout.projectSlots) {
    const poster = featured.find((p) => p.slug === slot.slug)?.poster;
    if (!poster) continue;
    const img = new Image();
    img.src = poster.src;
    try {
      await img.decode();
    } catch {
      continue;
    }
    const cx = (cell % COLS) * CELL_W;
    const cy = Math.floor(cell / COLS) * CELL_H;
    ctx.drawImage(img, cx, cy, CELL_W, CELL_H);
    const slotAspect = slot.back.w / slot.back.h;
    const cellAspect = CELL_W / CELL_H;
    const useW = slotAspect < cellAspect ? CELL_H * slotAspect : CELL_W;
    const useH = slotAspect < cellAspect ? CELL_H : CELL_W / slotAspect;
    const x0 = cx + (CELL_W - useW) / 2;
    const y0 = cy + (CELL_H - useH) / 2;
    // Texture v runs bottom to top; canvas y runs top to bottom.
    rects.set(slot.slug, [x0 / 1024, 1 - (y0 + useH) / 1024, (x0 + useW) / 1024, 1 - y0 / 1024]);
    cell++;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, rects };
}
