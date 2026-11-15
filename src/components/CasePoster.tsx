import { getImageProps } from "next/image";
import manifest from "../../public/case/manifest.json";

/**
 * Still renders of the lit case, made in Blender from the same model as the 3D scene
 * (scripts/blender/render_case.py). Phones, reduced motion and no-WebGL see only this.
 * The manifest names the current generation, so both posters always come from one run.
 */
export const POSTER = {
  light: manifest.light,
  dark: manifest.dark,
  width: manifest.width,
  height: manifest.height,
} as const;

const SIZES = "(min-width: 1280px) 1216px, calc(100vw - 2rem)";

/** Light or dark render via <picture>, so only the matching file downloads. */
export function CasePoster() {
  // Decorative: the HTML grid below carries every project; the stage is aria-hidden.
  const common = { alt: "", width: POSTER.width, height: POSTER.height, sizes: SIZES, quality: 80 };
  const {
    props: { srcSet: dark },
  } = getImageProps({ ...common, src: POSTER.dark });
  const { props: light } = getImageProps({ ...common, src: POSTER.light, fetchPriority: "high", loading: "eager" });
  return (
    <picture className="case-poster">
      <source media="(prefers-color-scheme: dark)" srcSet={dark} sizes={SIZES} />
      {/* A plain img inside picture: art direction by colour scheme (props from getImageProps). */}
      <img {...light} alt="" />
    </picture>
  );
}
