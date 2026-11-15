import { describe, expect, it } from "vitest";
import { cameraBlocked, whyNoCamera } from "@/ar/marker/camera";

type Nav = Parameters<typeof whyNoCamera>[0];
const nav = (permission: PermissionState | "throws" | null, devices: string[] | "throws" | null): Nav =>
  ({
    permissions:
      permission === null
        ? undefined
        : {
            query: async () => {
              if (permission === "throws") throw new TypeError("camera is not a permission name here");
              return { state: permission } as PermissionStatus;
            },
          },
    mediaDevices:
      devices === null
        ? undefined
        : {
            getUserMedia: async () => new MediaStream(),
            enumerateDevices: async () => {
              if (devices === "throws") throw new Error("no");
              return devices.map((kind) => ({ kind }) as MediaDeviceInfo);
            },
          },
  }) as unknown as Nav;

describe("whyNoCamera", () => {
  it("says denied when the browser blocks the camera for this site", async () => {
    expect(await whyNoCamera(nav("denied", ["videoinput"]))).toBe("denied");
  });

  it("says no camera when the device has none, or the page cannot reach cameras at all", async () => {
    expect(await whyNoCamera(nav("prompt", ["audioinput"]))).toBe("nocamera");
    expect(await whyNoCamera(nav(null, null))).toBe("nocamera"); // no mediaDevices (not a secure page)
  });

  it("falls back to failed when it cannot tell, even if the questions themselves fail", async () => {
    expect(await whyNoCamera(nav("granted", ["videoinput"]))).toBe("failed");
    expect(await whyNoCamera(nav("throws", "throws"))).toBe("failed");
    expect(await whyNoCamera(nav(null, ["videoinput"]))).toBe("failed"); // Safari before 16: no permissions API
  });
});

describe("cameraBlocked", () => {
  it("is true only for a known denial, so a press never waits on a question that cannot be answered", async () => {
    expect(await cameraBlocked(nav("denied", []))).toBe(true);
    expect(await cameraBlocked(nav("prompt", []))).toBe(false);
    expect(await cameraBlocked(nav("throws", []))).toBe(false);
    expect(await cameraBlocked(nav(null, []))).toBe(false);
  });
});
