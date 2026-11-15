// The one function the tests use from 8th Wall's image-target-cli (MIT): its own crop check.
declare module "@8thwall/image-target-cli/src/crop.js" {
  export function validateCrop(
    crop: { top: number; left: number; width: number; height: number },
    image: { width: number; height: number },
  ): string[];
}
