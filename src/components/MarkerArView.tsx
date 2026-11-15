// Imported only through the client MarkerAr, so it may take function props (test seams).
import Link from "next/link";
import { useCallback, useEffect, useReducer, useRef } from "react";
import type { MarkerSession, SessionEvent } from "@/ar/marker/session";
import { next, running, STATUS } from "@/ar/marker/state";

export type MarkerArViewProps = {
  /** What has and has not been tested, from xr-tests.json (worked out on the server). */
  note: string;
  /** The printable card. */
  cardHref: string;
  /** Loads the marker chunk and starts the camera and tracker on the canvas (the press only). */
  start: (canvas: HTMLCanvasElement, onEvent: (event: SessionEvent) => void) => Promise<MarkerSession>;
  /** True when the browser already blocks the camera for this site. */
  cameraBlocked: () => Promise<boolean>;
  /** Why the camera did not open, asked after it failed. */
  whyNoCamera: () => Promise<"denied" | "nocamera" | "failed">;
};

/** At most twice the CSS size: enough for the tracker, and it keeps phones cool. */
const MAX_DPR = 2;

/**
 * The case on the printed card, through the phone's camera. Nothing loads before the press.
 * The camera view opens as a modal dialog over the page; Stop, Escape, leaving the page or
 * hiding it all turn the camera off. Each run has an id, so a late event or a late start
 * from an ended run changes nothing.
 */
export function MarkerArView({ note, cardHref, start, cameraBlocked, whyNoCamera }: MarkerArViewProps) {
  const [state, dispatch] = useReducer(next, "idle");
  const session = useRef<MarkerSession | null>(null);
  const run = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  const isRunning = running(state);

  /** Ends the current run: later events from it are ignored, and its camera is turned off. */
  const end = useCallback(() => {
    run.current += 1;
    session.current?.stop();
    session.current = null;
  }, []);

  const stop = useCallback(() => {
    end();
    dispatch("stop");
  }, [end]);

  async function begin() {
    if (isRunning) return;
    end();
    const id = run.current;
    dispatch("start");
    const stage = dialog.current!;
    if (typeof stage.showModal === "function") stage.showModal();
    else stage.setAttribute("open", "");
    const c = canvas.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    c.width = Math.max(1, Math.round(c.clientWidth * dpr));
    c.height = Math.max(1, Math.round(c.clientHeight * dpr));

    if (await cameraBlocked()) {
      if (id === run.current) dispatch("denied");
      return;
    }
    const onEvent = (event: SessionEvent) => {
      if (id !== run.current) return;
      if (event === "camera" || event === "found" || event === "lost") return dispatch(event);
      end();
      if (event === "error") return dispatch("failed");
      void whyNoCamera().then(dispatch);
    };
    try {
      const s = await start(c, onEvent);
      if (id !== run.current) return s.stop(); // stopped while it was starting
      session.current = s;
    } catch {
      if (id !== run.current) return;
      end();
      dispatch("failed");
    }
  }

  // Close the camera view when a run ends, and put focus back on Start.
  useEffect(() => {
    const stage = dialog.current;
    if (isRunning || !stage?.hasAttribute("open")) return;
    if (typeof stage.close === "function") stage.close();
    else stage.removeAttribute("open");
    startButton.current?.focus();
  }, [isRunning]);

  // Leaving or hiding the page turns the camera off (the camera light goes off too).
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === "hidden" && session.current) {
        end();
        dispatch("hidden");
      }
    };
    const leave = () => {
      if (session.current) {
        end();
        dispatch("hidden");
      }
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", leave);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", leave);
      end();
    };
  }, [end]);

  const resting = isRunning ? "" : STATUS[state];
  return (
    <div className="marker-ar" data-state={state}>
      <button ref={startButton} type="button" className="marker-ar__start" onClick={begin} disabled={isRunning}>
        Start the camera
      </button>
      <p role="status" className="marker-ar__status">
        {resting}
      </p>
      <p className="marker-ar__card">
        No card yet? <Link href={cardHref}>Print the card</Link>, or open it on another screen.
      </p>
      <p className="marker-ar__note">{note}</p>

      <dialog
        ref={dialog}
        className="marker-ar__stage"
        aria-label="Camera view"
        onCancel={(e) => {
          e.preventDefault(); // Escape: stop the run, which closes the view
          stop();
        }}
      >
        <canvas ref={canvas} className="marker-ar__canvas" />
        <div className="marker-ar__bar">
          <p role="status" className="marker-ar__live">
            {isRunning ? STATUS[state] : ""}
          </p>
          <button type="button" className="marker-ar__stop" onClick={stop} autoFocus>
            Stop the camera
          </button>
        </div>
      </dialog>
    </div>
  );
}
