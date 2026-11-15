// Why the camera is not available, asked of the browser without opening the camera.

type CameraNavigator = {
  permissions?: Pick<Permissions, "query">;
  mediaDevices?: Pick<MediaDevices, "getUserMedia" | "enumerateDevices">;
};

/** True only when the browser says the camera is blocked for this site. */
export async function cameraBlocked(nav: CameraNavigator = navigator): Promise<boolean> {
  try {
    // "camera" is a valid permission name in Chromium and Safari 16+, but not in every TS lib.
    const status = await nav.permissions?.query({ name: "camera" as PermissionName });
    return status?.state === "denied";
  } catch {
    return false; // Firefox and older Safari do not know the name: we cannot tell, so not blocked
  }
}

/** After the camera failed to start: blocked, missing, or a reason the browser does not give. */
export async function whyNoCamera(nav: CameraNavigator = navigator): Promise<"denied" | "nocamera" | "failed"> {
  if (await cameraBlocked(nav)) return "denied";
  if (!nav.mediaDevices?.getUserMedia) return "nocamera"; // no camera API at all (not a secure page)
  try {
    const devices = await nav.mediaDevices.enumerateDevices();
    if (!devices.some((d) => d.kind === "videoinput")) return "nocamera";
  } catch {
    // fall through: we cannot tell
  }
  return "failed";
}
