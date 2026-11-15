// The marker AR run: loaded on the "Start the camera" press only (with three.js and the engine).
// The engine draws the camera picture and finds the card; three.js draws the case on top, in
// the same WebGL context, from the camera and card poses the engine reports each frame.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { loadEngine, type ImageEventDetail, type ImageTargetData, type PipelineModule, type XR8Api } from "./engine";
import { caseOnCard, type CaseBox } from "./placement";

export type SessionEvent = "camera" | "found" | "lost" | "camerafailed" | "error";

export type MarkerSessionOptions = {
  canvas: HTMLCanvasElement;
  target: ImageTargetData;
  caseBox: CaseBox;
  glb: string;
  onEvent: (event: SessionEvent) => void;
};

export type MarkerSession = { stop(): void };

const NEAR = 0.01;
const FAR = 100;

let caseModel: Promise<THREE.Group> | null = null;
function loadCase(url: string) {
  caseModel ??= new GLTFLoader()
    .loadAsync(url)
    .then((gltf) => gltf.scene)
    .catch((error: unknown) => {
      caseModel = null;
      throw error;
    });
  return caseModel;
}

function projection(xr8: XR8Api, width: number, height: number) {
  xr8.XrController.updateCameraProjectionMatrix({
    cam: { pixelRectWidth: width, pixelRectHeight: height, nearClipPlane: NEAR, farClipPlane: FAR },
  });
}

/** Starts the camera and the card tracker on `canvas`. Rejects if the engine or the case fails to load. */
export async function startMarker({ canvas, target, caseBox, glb, onEvent }: MarkerSessionOptions): Promise<MarkerSession> {
  const [xr8, model] = await Promise.all([loadEngine(), loadCase(glb)]);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  // The site's case lighting (src/scene/CaseScene.tsx); the posters are unlit.
  scene.add(new THREE.AmbientLight(0xffffff, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(0.6, 1.2, 2);
  scene.add(sun);
  const theCase = model.clone();
  theCase.visible = false;
  scene.add(theCase);

  let renderer: THREE.WebGLRenderer | null = null;
  const place = (detail: ImageEventDetail) => {
    const t = caseOnCard(detail, caseBox);
    theCase.position.fromArray(t.position);
    theCase.quaternion.fromArray(t.quaternion);
    theCase.scale.setScalar(t.scale);
    theCase.visible = true;
  };

  const overlay: PipelineModule = {
    name: "case-overlay",
    onStart: ({ canvas: c, GLctx }) => {
      renderer = new THREE.WebGLRenderer({ canvas: c, context: GLctx, alpha: true, antialias: true });
      renderer.autoClear = false;
      renderer.setSize(c.width, c.height, false);
      projection(xr8, c.width, c.height);
    },
    onCanvasSizeChange: ({ canvasWidth, canvasHeight }) => {
      renderer?.setSize(canvasWidth, canvasHeight, false);
      projection(xr8, canvasWidth, canvasHeight);
    },
    onUpdate: ({ processCpuResult }) => {
      const r = processCpuResult.reality;
      // The first frames can carry no projection yet (NaN); keep the last good one.
      if (r?.intrinsics && Number.isFinite(r.intrinsics[0])) {
        camera.projectionMatrix.fromArray(Array.from(r.intrinsics));
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      }
      if (r?.rotation) camera.quaternion.set(r.rotation.x, r.rotation.y, r.rotation.z, r.rotation.w);
      if (r?.position) camera.position.set(r.position.x, r.position.y, r.position.z);
    },
    onRender: () => {
      if (!renderer) return;
      renderer.resetState(); // the engine just drew the camera picture with its own GL state
      renderer.clearDepth();
      renderer.render(scene, camera);
    },
    onCameraStatusChange: ({ status }) => {
      if (status === "hasVideo") onEvent("camera");
      if (status === "failed") onEvent("camerafailed");
    },
    onException: () => onEvent("error"),
    listeners: [
      {
        event: "reality.imagefound",
        process: ({ detail }) => {
          place(detail);
          onEvent("found");
        },
      },
      { event: "reality.imageupdated", process: ({ detail }) => place(detail) },
      {
        event: "reality.imagelost",
        process: () => {
          theCase.visible = false;
          onEvent("lost");
        },
      },
    ],
  };

  // Image targets only: the open-source engine has no world tracking, and this page needs none.
  xr8.XrController.configure({ disableWorldTracking: true, imageTargetData: [target] });
  xr8.addCameraPipelineModules([xr8.GlTextureRenderer.pipelineModule(), xr8.XrController.pipelineModule(), overlay]);
  xr8.run({ canvas, allowedDevices: xr8.XrConfig.device().ANY });

  let stopped = false;
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      xr8.stop(); // ends the camera stream, so the camera light goes off
      xr8.clearCameraPipelineModules();
      renderer?.dispose();
      renderer = null;
    },
  };
}
