// A stand-in for the 8th Wall engine's camera start, kept under a vendor/8thwall path so its
// calls carry the same stack signature as the real engine's. It copies what xr.js does on
// iOS 16.4 and later: open the camera, close it, list devices, then open it again, with no
// check in between that the run is still wanted.
export async function openCameraLikeIos(enumeration: Promise<void>): Promise<MediaStream | Error> {
  const first = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  first.getTracks().forEach((t) => t.stop());
  await enumeration;
  try {
    return await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", deviceId: "back" } });
  } catch (error) {
    return error as Error;
  }
}
