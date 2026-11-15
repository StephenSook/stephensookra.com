// Imported only through the client VisionRoom, so it may take function props (test seams).
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

export type VisionRoomViewProps = {
  /** The room (USDZ) and its environment map (HDR), from public/vision/manifest.json. */
  room: string;
  environment: string;
  /** visionOS 27 Safari: document.immersiveEnabled. */
  immersiveEnabled: () => boolean;
};

type Phase = "ready" | "opening" | "inside" | "left" | "failed";
const STATUS: Record<Phase, string> = {
  ready: "",
  opening: "Opening the room",
  inside: "In the room",
  left: "Left the room",
  failed: "The room could not open here.",
};

type ImmersiveModel = HTMLElement & { requestImmersive?: () => Promise<void> };
const noSubscription = () => () => {};

/**
 * Apple Vision Pro's immersive website environment: a press takes the reader into a room
 * with the case on its wall (model.requestImmersive, WWDC26 session 320). The <model> is
 * hidden, so the room downloads only when the reader asks for it, and it exists only where
 * Safari can open it. Elsewhere the page says where the room opens.
 */
export function VisionRoomView({ room, environment, immersiveEnabled }: VisionRoomViewProps) {
  const available = useSyncExternalStore(noSubscription, immersiveEnabled, () => false);
  const [phase, setPhase] = useState<Phase>("ready");
  const model = useRef<ImmersiveModel>(null);
  const enter = useRef<HTMLButtonElement>(null);
  const inside = phase === "inside";

  // visionOS reports every change (in, out, or closed from the system) with immersivechange.
  useEffect(() => {
    if (!available) return;
    const change = () => {
      const now = !!model.current && document.immersiveElement === model.current;
      setPhase((was) => (now ? "inside" : was === "inside" ? "left" : was));
    };
    document.addEventListener("immersivechange", change);
    return () => document.removeEventListener("immersivechange", change);
  }, [available]);

  // Back on the page: focus returns to the way in.
  useEffect(() => {
    if (phase === "left") enter.current?.focus();
  }, [phase]);

  function open() {
    const el = model.current;
    if (!el?.requestImmersive) return setPhase("failed");
    setPhase("opening");
    // Called inside the press, before any await: Safari grants it only from the reader's gesture.
    el.requestImmersive().then(
      // Normally immersivechange has said so already; if not, do not leave the button stuck.
      () => setPhase((was) => (was === "opening" ? (document.immersiveElement === el ? "inside" : "ready") : was)),
      () => setPhase("failed"),
    );
  }

  if (!available) {
    return (
      <p className="vision-room__elsewhere">
        The room opens in Safari on Apple Vision Pro, from visionOS 27. Anywhere else, the case is here in VR and on
        your phone.
      </p>
    );
  }
  return (
    <div className="vision-room" data-phase={phase}>
      <model ref={model} src={room} environmentmap={environment} style={{ display: "none" }} />
      {inside ? (
        <button type="button" className="vision-room__button" onClick={() => void document.exitImmersive?.()}>
          Leave the room
        </button>
      ) : (
        <button
          ref={enter}
          type="button"
          className="vision-room__button"
          onClick={open}
          disabled={phase === "opening"}
        >
          Step into the room
        </button>
      )}
      <p role="status" className="vision-room__status">
        {STATUS[phase]}
      </p>
    </div>
  );
}
