// Imported only through the client PhoneAr, so it may take function props (test seams).
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

export type PhoneArViewProps = {
  glb: string;
  usdz: string;
  poster: { src: string; width: number; height: number };
  /** What has and has not been tested, from xr-tests.json (worked out on the server). */
  note: string;
  /** iPhone and iPad Safari: an <a rel="ar"> opens AR Quick Look. */
  supportsQuickLook: () => boolean;
  /** Safari 27 and visionOS: the HTML <model> element. */
  hasModelElement: () => boolean;
  /** Loads the self-hosted model-viewer build; called on the tap only. */
  loadViewer: () => Promise<void>;
};

type Phase = "idle" | "loading" | "viewer" | "failed";
/** What the browser offers: worked out on the client only (the server renders "checking"). */
type Support = "checking" | "quicklook" | "quicklook-model" | "viewer";

const noSubscription = () => () => {};

const ALT = "Stephen Sookra's lit letter case, 1.6 metres wide, with six projects in its slots.";

/**
 * The case in the reader's room at real size. An iPhone gets a plain AR Quick Look link (no
 * script). Anywhere else a tap loads model-viewer, which shows the case in 3D and offers
 * Scene Viewer on Android or WebXR where it exists. Nothing heavy loads before the tap.
 */
export function PhoneArView({ glb, usdz, poster, note, supportsQuickLook, hasModelElement, loadViewer }: PhoneArViewProps) {
  const detect = useCallback(
    (): Support => (supportsQuickLook() ? (hasModelElement() ? "quicklook-model" : "quicklook") : "viewer"),
    [supportsQuickLook, hasModelElement],
  );
  const support = useSyncExternalStore(noSubscription, detect, () => "checking" as const);
  const [phase, setPhase] = useState<Phase>("idle");
  const viewer = useRef<HTMLElement>(null);
  const quickLook = support === "quicklook" || support === "quicklook-model";
  const mode = support === "checking" ? "checking" : quickLook ? "quicklook" : phase;

  useEffect(() => {
    const el = viewer.current;
    if (phase !== "viewer" || !el) return;
    const failed = () => setPhase("failed");
    el.addEventListener("error", failed);
    return () => el.removeEventListener("error", failed);
  }, [phase]);

  async function open() {
    setPhase("loading");
    try {
      await loadViewer();
      setPhase("viewer");
    } catch {
      setPhase("failed");
    }
  }

  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={poster.src} width={poster.width} height={poster.height} alt={ALT} className="phone-ar__poster" />
  );

  return (
    <div className="phone-ar" data-mode={mode}>
      {mode === "quicklook" && (
        <a rel="ar" href={usdz} className="phone-ar__quicklook">
          {support === "quicklook-model" ? <model src={usdz} alt={ALT} className="phone-ar__model" /> : image}
        </a>
      )}
      {mode === "viewer" ? (
        <model-viewer
          ref={viewer}
          className="phone-ar__viewer"
          src={glb}
          ios-src={usdz}
          ar
          ar-modes="webxr scene-viewer quick-look"
          ar-scale="fixed"
          camera-controls
          touch-action="pan-y"
          poster={poster.src}
          alt={ALT}
        />
      ) : (
        mode !== "quicklook" && image
      )}
      {(mode === "idle" || mode === "loading") && (
        <button type="button" className="phone-ar__open" onClick={open} disabled={mode === "loading"}>
          {mode === "loading" ? "Loading the 3D viewer" : "See it in 3D and in your room"}
        </button>
      )}
      {mode === "quicklook" && <p className="phone-ar__hint">Tap the case to place it in your room.</p>}
      <p role="status" className="phone-ar__status">
        {mode === "failed" ? "The 3D viewer is not available here." : ""}
      </p>
      <p className="phone-ar__note">{note}</p>
    </div>
  );
}
