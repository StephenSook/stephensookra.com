"use client";

import vision from "../../public/vision/manifest.json";
import { VisionRoomView } from "./VisionRoomView";

const immersiveEnabled = () => typeof document !== "undefined" && document.immersiveEnabled === true;

/** Client boundary for the Vision Pro room: the room and its light come from the manifest. */
export function VisionRoom() {
  return <VisionRoomView room={vision.room} environment={vision.environment} immersiveEnabled={immersiveEnabled} />;
}
