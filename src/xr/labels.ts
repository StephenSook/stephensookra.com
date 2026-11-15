import type { CaseLayout } from "@/scene/layout";

/** Cap-to-baseline size of a slot label in meters: about 1.1 degrees of view at 1 m. */
export const LABEL_SIZE = 0.02;
const INSET = 0.012;

export type SlotLabel = { slug: string; text: string; x: number; y: number; z: number };

/**
 * One label per project slot ("A1 Case Light"), in the slot's lower-left corner, a little
 * in front of the poster. In the headset these name every slot.
 */
export function slotLabels(layout: CaseLayout, projects: { slug: string; title: string }[]): SlotLabel[] {
  return layout.projectSlots.map(({ slug, row, col, opening, back }) => {
    const title = projects.find((p) => p.slug === slug)?.title ?? slug;
    return {
      slug,
      text: `${row}${col} ${title}`,
      x: opening.x - opening.w / 2 + INSET,
      y: opening.y - opening.h / 2 + INSET,
      z: back.z + back.d / 2 + 0.01,
    };
  });
}
