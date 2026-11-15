import * as THREE from "three";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { openCameraLikeIos } from "./fixtures/vendor/8thwall/fake-engine";

vi.mock("three/addons/loaders/GLTFLoader.js", () => ({
  GLTFLoader: class {
    async loadAsync() {
      return { scene: new THREE.Group() };
    }
  },
}));

type Track = { readyState: "live" | "ended"; stop(): void };
const opened: Track[] = [];
function fakeStream() {
  const track: Track = { readyState: "live", stop: () => (track.readyState = "ended") };
  opened.push(track);
  return { getTracks: () => [track] } as unknown as MediaStream;
}

let release = () => {};
let engineResult: Promise<MediaStream | Error> = Promise.resolve(new Error("not run"));
const xr8 = {
  XrController: { configure: vi.fn(), pipelineModule: () => ({ name: "xr" }), updateCameraProjectionMatrix: vi.fn() },
  GlTextureRenderer: { pipelineModule: () => ({ name: "gl" }) },
  XrConfig: { device: () => ({ ANY: "any" }) },
  addCameraPipelineModules: vi.fn(),
  clearCameraPipelineModules: vi.fn(),
  run: vi.fn(() => {
    engineResult = openCameraLikeIos(new Promise<void>((r) => (release = r)));
  }),
  stop: vi.fn(),
};

const options = (isCurrent = () => true) => ({
  canvas: document.createElement("canvas"),
  target: { name: "card", type: "PLANAR", imagePath: "/t.png", properties: {} },
  caseBox: { x: 0.1, y: 0.2, width: 0.8, height: 0.68 },
  glb: "/case.glb",
  onEvent: vi.fn(),
  isCurrent,
});

beforeAll(() => {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => fakeStream()), enumerateDevices: vi.fn(async () => []) },
  });
  (window as unknown as { XR8: typeof xr8 }).XR8 = xr8;
});
afterAll(() => {
  delete (window as unknown as { XR8?: unknown }).XR8;
});

describe("startMarker and the camera", () => {
  it("closes a camera the engine opens after Stop (the iOS 16.4 second request)", async () => {
    const { startMarker } = await import("@/ar/marker/session");
    const session = await startMarker(options());
    await vi.waitFor(() => expect(opened.length).toBe(1)); // the first request, closed by the engine
    session.stop(); // Stop lands while the engine lists devices
    expect(xr8.stop).toHaveBeenCalledTimes(1); // this run owned the engine
    release();
    // Like the engine's own stale-run path: the stream is closed and the request never
    // settles, so no success or failure from the ended run reaches the next run's pipeline.
    const outcome = await Promise.race([engineResult, new Promise((r) => setTimeout(() => r("pending"), 30))]);
    expect(outcome).toBe("pending");
    expect(opened.map((t) => t.readyState)).toEqual(["ended", "ended"]); // no camera left on
  });

  it("closes the run's own camera on Stop, whatever the engine does", async () => {
    const { startMarker } = await import("@/ar/marker/session");
    opened.length = 0;
    const session = await startMarker(options());
    release();
    const stream = await engineResult;
    expect(stream).not.toBeInstanceOf(Error);
    expect(opened.map((t) => t.readyState)).toEqual(["ended", "live"]);
    session.stop();
    expect(opened.map((t) => t.readyState)).toEqual(["ended", "ended"]);
  });

  it("leaves camera requests from anything but the engine alone", async () => {
    await import("@/ar/marker/session");
    opened.length = 0;
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    expect(stream.getTracks()[0].readyState).toBe("live");
  });

  it("never touches the engine for a run that ended while loading", async () => {
    const { startMarker } = await import("@/ar/marker/session");
    xr8.run.mockClear();
    xr8.stop.mockClear();
    xr8.XrController.configure.mockClear();
    const session = await startMarker(options(() => false));
    expect(xr8.run).not.toHaveBeenCalled();
    expect(xr8.XrController.configure).not.toHaveBeenCalled();
    session.stop();
    expect(xr8.stop).not.toHaveBeenCalled(); // an abandoned start cannot stop the engine
  });
});
