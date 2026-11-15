import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Text } from "troika-three-text";

// The site's display font, self-hosted (see THIRD_PARTY_NOTICES.md), so no CDN is asked.
export const FONT_REGULAR = "/xr/fonts/familjen-grotesk-latin-400-normal.woff";
export const FONT_SEMIBOLD = "/xr/fonts/familjen-grotesk-latin-600-normal.woff";

export type LabelProps = {
  text: string;
  /** Font size in metres. */
  size: number;
  position: [number, number, number];
  color?: string;
  font?: string;
  anchorX?: "left" | "center" | "right";
  anchorY?: "top" | "middle" | "bottom";
  /** Wraps lines at this width, in metres. */
  maxWidth?: number;
  lineHeight?: number;
};

/** SDF text (troika-three-text): sharp at any distance in the headset. */
export function Label({
  text,
  size,
  position,
  color = "#f4efe6",
  font = FONT_SEMIBOLD,
  anchorX = "left",
  anchorY = "bottom",
  maxWidth = Infinity,
  lineHeight = 1.25,
}: LabelProps) {
  const mesh = useMemo(() => new Text(), []);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    Object.assign(mesh, { text, fontSize: size, color, font, anchorX, anchorY, maxWidth, lineHeight });
    mesh.sync(() => invalidate());
  }, [mesh, text, size, color, font, anchorX, anchorY, maxWidth, lineHeight, invalidate]);
  useEffect(() => () => mesh.dispose(), [mesh]);
  return <primitive object={mesh} position={position} />;
}
