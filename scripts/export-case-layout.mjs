// Writes the computed case layout and camera for the Blender poster script, so Blender
// builds exactly the boxes the 3D scene draws. Usage: npm run case:layout
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildLayout } from "../src/scene/layout.ts";
import { CASE_FOV, fitCamera } from "../src/scene/pick.ts";

const root = process.cwd();
const specPath = join(root, "src/scene/case-spec.json");
const specText = readFileSync(specPath, "utf8");
const spec = JSON.parse(specText);
const layout = buildLayout(spec);
const ASPECT = 16 / 9;
const camera = fitCamera(layout, ASPECT);

// Project posters are public/posters/<slug>.webp; a slot without one keeps a plain back.
const projects = Object.fromEntries(
  layout.projectSlots
    .map((s) => [s.slug, join(root, "public/posters", `${s.slug}.webp`)])
    .filter(([, path]) => existsSync(path)),
);

const out = {
  specSha256: createHash("sha256").update(specText).digest("hex"),
  aspect: ASPECT,
  camera: { fovDegrees: CASE_FOV, position: camera.position.toArray() },
  colors: spec.colors,
  layout,
  posters: projects,
};

mkdirSync(join(root, "scripts/blender/out"), { recursive: true });
writeFileSync(join(root, "scripts/blender/out/case-layout.json"), `${JSON.stringify(out, null, 2)}\n`);
console.log(`wrote scripts/blender/out/case-layout.json (spec ${out.specSha256.slice(0, 12)})`);
