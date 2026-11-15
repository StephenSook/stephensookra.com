// Imported only through the client XrDoor, so it may take function props (test seams).
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { webLaunchUrl } from "@/xr/support";
import type { XrEndReason, XrMode, XrSessionProps } from "@/xr/types";

type Door = "checking" | "vr" | "launch" | "phone";
type SessionComponent = ComponentType<XrSessionProps>;
export type XrModes = { vr: boolean; ar: boolean };

export type XrDoorViewProps = {
  /** Which immersive modes this browser can start (VR, and passthrough AR). */
  checkSupport: () => Promise<XrModes>;
  /** A wide screen with a fine pointer: the reader is probably at a laptop. */
  isLaptop: () => boolean;
  /** The page to send to a headset. */
  pageUrl: () => string;
  /** What has and has not been tested, from xr-tests.json (worked out on the server). */
  note: string;
  /** The passthrough line, shown with Place on your wall (empty when the headset note covers it). */
  arNote?: string;
  /** Loads the headset session (the XR chunk); called on the first press only. */
  loadSession?: () => Promise<SessionComponent>;
};

type Phase = "entering" | "started" | XrEndReason;
const STATUS: Record<XrMode, Record<Phase, string>> = {
  vr: {
    entering: "Entering VR",
    started: "In VR",
    ended: "Left VR",
    // The press's user activation ran out while the chunk loaded; the chunk is ready now.
    blocked: "Press Enter VR again",
    failed: "VR could not start",
  },
  ar: {
    entering: "Entering passthrough",
    started: "On your wall",
    ended: "Left passthrough",
    blocked: "Press Place on your wall again",
    failed: "Passthrough could not start",
  },
};

/**
 * The way into the headset modes. A headset gets Enter VR, and Place on your wall where it
 * also runs passthrough AR; a laptop without VR gets Meta's Web Launch link, which sends the
 * page to the reader's Quest; a phone gets a link to see the case in its room (phone AR,
 * also for a phone that runs WebXR AR but not VR). Server HTML is empty, so no one is
 * offered a mode before the browser has answered. The XR chunk loads on the first press,
 * and a status line says what happened (entering, in VR or on the wall, which card is
 * open, left).
 */
export function XrDoorView({ checkSupport, isLaptop, pageUrl, note, arNote, loadSession }: XrDoorViewProps) {
  const [door, setDoor] = useState<Door>("checking");
  const [wall, setWall] = useState(false);
  // Once loaded, the session stays mounted (idle between visits), so a later press can ask
  // synchronously inside that press: WebKit grants a session only inside the gesture.
  const [Session, setSession] = useState<SessionComponent | null>(null);
  const [status, setStatus] = useState("");
  const loading = useRef(false);
  const enterNow = useRef<((mode: XrMode) => void) | null>(null);
  /** The mode the first press asked for, until the session has loaded and can ask. */
  const pending = useRef<XrMode | null>(null);
  const mode = useRef<XrMode>("vr");
  const buttons = useRef<Record<XrMode, HTMLButtonElement | null>>({ vr: null, ar: null });

  useEffect(() => {
    let live = true;
    checkSupport().then(({ vr, ar }) => {
      if (!live) return;
      setDoor(vr ? "vr" : isLaptop() ? "launch" : "phone");
      setWall(vr && ar);
    });
    return () => {
      live = false;
    };
  }, [checkSupport, isLaptop]);

  // Stable, so the mounted session never re-runs its effects because the status changed.
  const sessionProps = useMemo<XrSessionProps>(
    () => ({
      onStarted: () => setStatus(STATUS[mode.current].started),
      onEnded: (reason) => {
        setStatus(STATUS[mode.current][reason]);
        buttons.current[mode.current]?.focus();
      },
      onCard: (card) => setStatus(card ? `${card.title} card open` : STATUS[mode.current].started),
      onReady: (enter) => {
        enterNow.current = enter;
        const first = pending.current;
        pending.current = null;
        if (first) enter(first);
      },
    }),
    [],
  );

  async function enter(next: XrMode) {
    if (!loadSession) return;
    mode.current = next;
    setStatus(STATUS[next].entering);
    // Loaded already: ask now, before any await, so the request is inside this press.
    if (enterNow.current) return enterNow.current(next);
    pending.current = next;
    if (loading.current) return;
    // First press: load the XR chunk; the session hands over its enter once mounted, and the
    // request goes out then (Chromium allows that short delay after the press; WebKit may
    // refuse, see above).
    loading.current = true;
    try {
      const component = await loadSession();
      setSession(() => component);
    } catch {
      pending.current = null;
      setStatus(STATUS[next].failed);
    } finally {
      loading.current = false;
    }
  }

  const showVr = door === "vr" && !!loadSession;
  const showWall = showVr && wall;
  const showLaunch = door === "launch";
  return (
    <div className="xr-door" data-door={door}>
      {showVr && (
        <button
          ref={(el) => {
            buttons.current.vr = el;
          }}
          type="button"
          className="xr-door__enter"
          onClick={() => enter("vr")}
        >
          Enter VR
        </button>
      )}
      {showWall && (
        <button
          ref={(el) => {
            buttons.current.ar = el;
          }}
          type="button"
          className="xr-door__enter xr-door__wall"
          onClick={() => enter("ar")}
        >
          Place on your wall
        </button>
      )}
      {showLaunch && (
        <a className="xr-door__launch" href={webLaunchUrl(pageUrl())} target="_blank" rel="noopener noreferrer">
          Open on Meta Quest
        </a>
      )}
      {/* A phone without VR: the case in its room (phone AR, /case/ar). */}
      {door === "phone" && (
        <a className="xr-door__phone" href="/case/ar">
          See it in your room
        </a>
      )}
      {(showVr || showLaunch) && <p className="xr-door__note">{note}</p>}
      {showWall && arNote && <p className="xr-door__note">{arNote}</p>}
      <p role="status" className="xr-door__status">
        {status}
      </p>
      {Session && <Session {...sessionProps} />}
    </div>
  );
}
