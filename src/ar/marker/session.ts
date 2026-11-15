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
  /** False once the page has ended this run (Stop, hidden, left): give up before using XR8. */
  isCurrent: () => boolean;
};

export type MarkerSession = { stop(): void };

const NEAR = 0.01;
const FAR = 100;

let caseModel: Promise<THREE.Group> | null = null;
/** XR8 is one engine per page: the run that owns it, and how to end that run. */
let owner: { stop(): void } | null = null;

/** The camera streams the engine opened for one run. */
type CameraRun = { streams: MediaStream[] };
let cameraRun: CameraRun | null = null;
let cameraGuarded = false;
/** The engine's own files: its camera requests carry them in their call stack. */
const ENGINE_FILES = /\/vendor\/8thwall\//;

const closeAll = (streams: MediaStream[]) => streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));

/**
 * The engine opens the camera itself, and on iOS 16.4 and later it opens it twice: it closes
 * the first stream, lists the devices, then asks again without checking that the run is still
 * wanted. A Stop during that pause would leave the second camera on. So every camera request
 * the engine makes is tied to the run that was current when it asked; a stream that arrives
 * after that run ended is closed at once (and the engine is told AbortError). Requests from
 * anything else on the page pass straight through.
 */
function guardCamera() {
  const media = navigator.mediaDevices;
  if (cameraGuarded || !media?.getUserMedia) return;
  cameraGuarded = true;
  const open = media.getUserMedia.bind(media);
  media.getUserMedia = async (constraints?: MediaStreamConstraints) => {
    if (!ENGINE_FILES.test(new Error().stack ?? "")) return open(constraints);
    const run = cameraRun;
    const stream = await open(constraints);
    if (!run || run !== cameraRun) {
      closeAll([stream]);
      throw new DOMException("The camera run had already ended", "AbortError");
    }
    run.streams.push(stream);
    return stream;
  };
}
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

/**
 * Starts the camera and the card tracker on `canvas`. Rejects if the engine or the case fails
 * to load. A run that is no longer current by the time they have loaded never touches XR8, and
 * a run's stop() only stops the engine while that run still owns it, so an old run cannot end
 * a newer one.
 */
export async function startMarker({
  canvas,
  target,
  caseBox,
  glb,
  onEvent,
  isCurrent,
}: MarkerSessionOptions): Promise<MarkerSession> {
  const [xr8, model] = await Promise.all([loadEngine(), loadCase(glb)]);
  if (!isCurrent()) return { stop() {} };
  owner?.stop(); // a run the page lost track of: end it before taking the engine

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

  guardCamera();
  const streams: CameraRun = { streams: [] };
  cameraRun = streams;

  // Image targets only: the open-source engine has no world tracking, and this page needs none.
  xr8.XrController.configure({ disableWorldTracking: true, imageTargetData: [target] });
  xr8.addCameraPipelineModules([xr8.GlTextureRenderer.pipelineModule(), xr8.XrController.pipelineModule(), overlay]);
  xr8.run({ canvas, allowedDevices: xr8.XrConfig.device().ANY });

  let stopped = false;
  const session: MarkerSession = {
    stop() {
      if (stopped) return;
      stopped = true;
      if (cameraRun === streams) cameraRun = null;
      if (owner === session) {
        owner = null;
        xr8.stop(); // ends the camera stream, so the camera light goes off
        xr8.clearCameraPipelineModules();
      }
      closeAll(streams.streams); // and every stream this run got, whatever the engine did
      renderer?.dispose();
      renderer = null;
    },
  };
  owner = session;
  return session;
}
