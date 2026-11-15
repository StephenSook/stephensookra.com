// JSX types for the two 3D elements the phone AR page renders: model-viewer (Google's web
// component, self-hosted) and <model> (the HTML model element in Safari 27 and visionOS).
import "react";

type Base = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": Base & {
        src?: string;
        "ios-src"?: string;
        ar?: boolean;
        "ar-modes"?: string;
        "ar-scale"?: string;
        "camera-controls"?: boolean;
        "touch-action"?: string;
        poster?: string;
        alt?: string;
        "shadow-intensity"?: string;
      };
      model: Base & { src?: string; alt?: string; stagemode?: string; environmentmap?: string };
    }
  }
}

// visionOS 27 Safari: immersive website environments (WWDC26 session 320), modelled on the
// Fullscreen API. Optional, so code must check before calling.
declare global {
  interface Document {
    immersiveEnabled?: boolean;
    immersiveElement?: Element | null;
    exitImmersive?: () => Promise<void>;
  }
}
