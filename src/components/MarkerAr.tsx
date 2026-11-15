"use client";

import { cameraBlocked, whyNoCamera } from "@/ar/marker/camera";
import type { SessionEvent } from "@/ar/marker/session";
import arManifest from "../../public/ar/manifest.json";
import marker from "../../public/marker/manifest.json";
import { MarkerArView } from "./MarkerArView";

/** The marker chunk (the engine, three.js and the case model) loads on the press only. */
const start = (canvas: HTMLCanvasElement, onEvent: (event: SessionEvent) => void, isCurrent: () => boolean) =>
  import("@/ar/marker/session").then((m) =>
    m.startMarker({ canvas, target: marker.target, caseBox: marker.caseBox, glb: arManifest.glb, onEvent, isCurrent }),
  );

/** Client boundary for marker AR: the server page passes the tested note. */
export function MarkerAr({ note }: { note: string }) {
  return (
    <MarkerArView
      note={note}
      cardHref="/ar/marker/card"
      start={start}
      cameraBlocked={() => cameraBlocked()}
      whyNoCamera={() => whyNoCamera()}
    />
  );
}
