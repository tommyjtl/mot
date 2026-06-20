import { arrayBufferToBase64 } from "./audio-encoding";
import type { ViewportCaptureRect } from "./capture-region";

export async function cropScreenshotToBase64(
  dataUrl: string,
  rect: ViewportCaptureRect,
  devicePixelRatio: number,
): Promise<string> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const sx = Math.max(0, Math.round(rect.left * devicePixelRatio));
  const sy = Math.max(0, Math.round(rect.top * devicePixelRatio));
  const sw = Math.min(
    Math.round(rect.width * devicePixelRatio),
    bitmap.width - sx,
  );
  const sh = Math.min(
    Math.round(rect.height * devicePixelRatio),
    bitmap.height - sy,
  );

  if (sw <= 0 || sh <= 0) {
    bitmap.close();
    throw new Error("Selected region is outside the visible page.");
  }

  const canvas = new OffscreenCanvas(sw, sh);
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Could not prepare screenshot crop.");
  }

  context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
  bitmap.close();

  const croppedBlob = await canvas.convertToBlob({ type: "image/png" });
  return arrayBufferToBase64(await croppedBlob.arrayBuffer());
}

export async function captureVisibleRegionBase64(
  windowId: number | undefined,
  rect: ViewportCaptureRect,
  devicePixelRatio: number,
): Promise<string> {
  const dataUrl = await browser.tabs.captureVisibleTab(windowId, {
    format: "png",
  });

  return cropScreenshotToBase64(dataUrl, rect, devicePixelRatio);
}
