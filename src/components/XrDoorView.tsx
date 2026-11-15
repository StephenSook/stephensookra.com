// Imported only through the client XrDoor, so it may take function props (test seams).
import { useEffect, useState } from "react";
import { doorNote, xrTests as committedTests, type XrTests } from "@/content/measurements/xr";
import { webLaunchUrl } from "@/xr/support";

type Door = "checking" | "vr" | "launch" | "none";

export type XrDoorViewProps = {
  /** Resolves true when this browser can start immersive VR. */
  checkSupport: () => Promise<boolean>;
  /** A wide screen with a fine pointer: the reader is probably at a laptop. */
  isLaptop: () => boolean;
  /** The page to send to a headset. */
  pageUrl: () => string;
  /** Starts the VR session; without it the Enter VR button stays hidden. */
  onEnter?: () => void;
  tests?: XrTests;
};

/**
 * The way into the headset mode. A browser that can run immersive VR gets Enter VR; a
 * laptop without it gets Meta's Web Launch link, which sends the page to the reader's
 * Quest; phones get nothing here. Server HTML is empty, so no one is offered a mode
 * before the browser has answered.
 */
export function XrDoorView({ checkSupport, isLaptop, pageUrl, onEnter, tests = committedTests }: XrDoorViewProps) {
  const [door, setDoor] = useState<Door>("checking");

  useEffect(() => {
    let live = true;
    checkSupport().then((vr) => {
      if (live) setDoor(vr ? "vr" : isLaptop() ? "launch" : "none");
    });
    return () => {
      live = false;
    };
  }, [checkSupport, isLaptop]);

  const showVr = door === "vr" && !!onEnter;
  const showLaunch = door === "launch";
  return (
    <div className="xr-door" data-door={door}>
      {showVr && (
        <button type="button" className="xr-door__enter" onClick={onEnter}>
          Enter VR
        </button>
      )}
      {showLaunch && (
        <a className="xr-door__launch" href={webLaunchUrl(pageUrl())} target="_blank" rel="noopener noreferrer">
          Open on Meta Quest
        </a>
      )}
      {(showVr || showLaunch) && <p className="xr-door__note">{doorNote(tests)}</p>}
    </div>
  );
}
