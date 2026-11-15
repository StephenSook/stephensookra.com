// troika-three-text ships no type declarations; this covers only what the headset scene uses.
declare module "troika-three-text" {
  import type { Color, Mesh } from "three";

  export class Text extends Mesh {
    text: string;
    font: string | null;
    fontSize: number;
    color: string | number | Color;
    anchorX: number | "left" | "center" | "right";
    anchorY: number | "top" | "top-baseline" | "middle" | "bottom-baseline" | "bottom";
    maxWidth: number;
    lineHeight: number | "normal";
    textAlign: "left" | "right" | "center" | "justify";
    /** Lays the text out (in a worker) and calls back once its geometry is ready. */
    sync(callback?: () => void): void;
    dispose(): void;
  }
}
