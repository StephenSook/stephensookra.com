/**
 * Layout math for the lit letter case. One model (case-spec.json) feeds this file,
 * the React Three Fiber scene and the Blender poster script, so they cannot drift.
 *
 * Coordinates: metres, origin at the centre of the case, x to the right, y up,
 * z towards the viewer (front face at +depth/2). Boxes are centre-based.
 */
export type Box = { x: number; y: number; z: number; w: number; h: number; d: number };

export type CaseSpec = {
  width: number;
  height: number;
  depth: number;
  frame: number;
  divider: number;
  shelf: number;
  back: number;
  smallCellsPerRow: number;
  projectRowHeight: number;
  rows: string[];
  slots: Record<string, string[]>;
  /**
   * The case is one dark piece of furniture in both colour schemes; only the page around
   * it changes. The scene and the Blender posters both read these.
   */
  colors: { wood: string; back: string };
};

export type SlotLayout = {
  slug: string;
  row: "A" | "B";
  col: 1 | 2 | 3;
  /** The thin panel at the back of the slot that lights up. */
  back: Box;
  /** The open volume of the slot, used for picking. */
  opening: Box;
};

export type CaseLayout = {
  width: number;
  height: number;
  depth: number;
  /** Outer frame: top, bottom, left, right. */
  frame: Box[];
  /** Shelves between rows and dividers between cells. */
  dividers: Box[];
  projectSlots: SlotLayout[];
  /** Open volumes of the small cells. */
  smallCells: Box[];
  /** Back panels of the small cells. */
  smallBacks: Box[];
};

export function buildLayout(spec: CaseSpec): CaseLayout {
  const { width, height, depth, frame, divider, shelf, back } = spec;
  const innerW = width - 2 * frame;
  const innerH = height - 2 * frame;
  const projectRows = spec.rows.filter((r) => r !== "small");
  const smallRows = spec.rows.length - projectRows.length;
  const smallRowHeight =
    (innerH - (spec.rows.length - 1) * shelf - projectRows.length * spec.projectRowHeight) / smallRows;
  if (smallRowHeight <= 0) throw new Error("case-spec: rows do not fit the case height");

  const box = (x: number, y: number, z: number, w: number, h: number, d: number): Box => ({ x, y, z, w, h, d });
  const frameBoxes = [
    box(0, height / 2 - frame / 2, 0, width, frame, depth),
    box(0, -height / 2 + frame / 2, 0, width, frame, depth),
    box(-width / 2 + frame / 2, 0, 0, frame, innerH, depth),
    box(width / 2 - frame / 2, 0, 0, frame, innerH, depth),
  ];

  const dividers: Box[] = [];
  const projectSlots: SlotLayout[] = [];
  const smallCells: Box[] = [];
  const smallBacks: Box[] = [];
  const backZ = -depth / 2 + back / 2;

  /** Splits the row into `n` cells separated by dividers; returns cell centres and width. */
  const cellsAcross = (n: number) => {
    const cellW = (innerW - (n - 1) * divider) / n;
    const xs = Array.from({ length: n }, (_, i) => -innerW / 2 + cellW / 2 + i * (cellW + divider));
    return { cellW, xs };
  };

  let yTop = height / 2 - frame;
  spec.rows.forEach((row, rowIndex) => {
    const rowH = row === "small" ? smallRowHeight : spec.projectRowHeight;
    const yc = yTop - rowH / 2;
    const isProject = row !== "small";
    const n = isProject ? spec.slots[row].length : spec.smallCellsPerRow;
    const { cellW, xs } = cellsAcross(n);

    xs.forEach((x, i) => {
      const opening = box(x, yc, 0, cellW, rowH, depth);
      const backBox = box(x, yc, backZ, cellW, rowH, back);
      if (isProject) {
        projectSlots.push({
          slug: spec.slots[row][i],
          row: row as "A" | "B",
          col: (i + 1) as 1 | 2 | 3,
          back: backBox,
          opening,
        });
      } else {
        smallCells.push(opening);
        smallBacks.push(backBox);
      }
      if (i < n - 1) dividers.push(box(x + cellW / 2 + divider / 2, yc, 0, divider, rowH, depth));
    });

    yTop -= rowH;
    if (rowIndex < spec.rows.length - 1) {
      dividers.push(box(0, yTop - shelf / 2, 0, innerW, shelf, depth));
      yTop -= shelf;
    }
  });

  return { width, height, depth, frame: frameBoxes, dividers, projectSlots, smallCells, smallBacks };
}

export function slotIndex(layout: CaseLayout, slug: string): number {
  return layout.projectSlots.findIndex((s) => s.slug === slug);
}
