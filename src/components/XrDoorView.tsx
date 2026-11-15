// Imported only through the client XrDoor, so it may take function props (test seams).
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { webLaunchUrl } from "@/xr/support";
import type { XrEndReason, XrSessionProps } from "@/xr/types";

type Door = "checking" | "vr" | "launch" | "phone";
type SessionComponent = ComponentType<XrSessionProps>;

export type XrDoorViewProps = {
  /** Resolves true when this browser can start immersive VR. */
  checkSupport: () => Promise<boolean>;
  /** A wide screen with a fine pointer: the reader is probably at a laptop. */
  isLaptop: () => boolean;
  /** The page to send to a headset. */
  pageUrl: () => string;
  /** What has and has not been tested, from xr-tests.json (worked out on the server). */
  note: string;
  /** Loads the headset session (the XR chunk); called on the first Enter VR press only. */
  loadSession?: () => Promise<SessionComponent>;
};

const END_STATUS: Record<XrEndReason, string> = {
  ended: "Left VR",
  // The press's user activation ran out while the chunk loaded; the chunk is ready now.
  blocked: "Press Enter VR again",
  failed: "VR could not start",
};

/**
 * The way into the headset mode. A browser that can run immersive VR gets Enter VR; a
 * laptop without it gets Meta's Web Launch link, which sends the page to the reader's
 * Quest; a phone gets a link to see the case in its room (phone AR). Server HTML is
 * empty, so no one is offered a mode before the browser has answered. The XR chunk loads
 * on the first press, and a status
 * line says what happened (entering, in VR, which card is open, left).
 */
export function XrDoorView({ checkSupport, isLaptop, pageUrl, note, loadSession }: XrDoorViewProps) {
  const [door, setDoor] = useState<Door>("checking");
  // Once loaded, the session stays mounted (idle between visits), so a later press can ask
  // for VR synchronously inside that press: WebKit grants a session only inside the gesture.
  const [Session, setSession] = useState<SessionComponent | null>(null);
  const [status, setStatus] = useState("");
  const loading = useRef(false);
  const enterNow = useRef<(() => void) | null>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let live = true;
    checkSupport().then((vr) => {
      if (live) setDoor(vr ? "vr" : isLaptop() ? "launch" : "phone");
    });
    return () => {
      live = false;
    };
  }, [checkSupport, isLaptop]);

  // Stable, so the mounted session never re-runs its effects because the status changed.
  const sessionProps = useMemo<XrSessionProps>(
    () => ({
      onStarted: () => setStatus("In VR"),
      onEnded: (reason) => {
        setStatus(END_STATUS[reason]);
        button.current?.focus();
      },
      onCard: (card) => setStatus(card ? `${card.title} card open` : "In VR"),
      onReady: (enter) => {
        enterNow.current = enter;
      },
    }),
    [],
  );

  async function enter() {
    if (!loadSession) return;
    setStatus("Entering VR");
    // Loaded already: ask now, before any await, so the request is inside this press.
    if (enterNow.current) return enterNow.current();
    if (loading.current) return;
    // First press: load the XR chunk; the session asks for VR as soon as it is mounted
    // (Chromium allows that short delay after the press; WebKit may refuse, see above).
    loading.current = true;
    try {
      const component = await loadSession();
      setSession(() => component);
    } catch {
      setStatus(END_STATUS.failed);
    } finally {
      loading.current = false;
    }
  }

  const showVr = door === "vr" && !!loadSession;
  const showLaunch = door === "launch";
  return (
    <div className="xr-door" data-door={door}>
      {showVr && (
        <button ref={button} type="button" className="xr-door__enter" onClick={enter}>
          Enter VR
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
      <p role="status" className="xr-door__status">
        {status}
      </p>
      {Session && <Session {...sessionProps} />}
    </div>
  );
}
