import { rasterizeLiveAdvancedOverlay } from "./advancedOverlayDomPreview";
import { applyOverlayToImageData, getOverlayImageData } from "./captureOverlay";
import type { CaptureOverlaySettings } from "./captureSettings";
import { shouldCompositeOverlayAfterCapture } from "./overlayPanelOpen";

/** Rasterize the GIF overlay once (still freeze). Null when the crop already has it. */
export async function prepareGifOverlayRaster(
  width: number,
  height: number,
  overlay: CaptureOverlaySettings | undefined,
): Promise<ImageData | null> {
  if (!overlay?.enabled) return null;
  const cache = new Map<string, ImageData>();
  if (overlay.advanced) {
    const live = await rasterizeLiveAdvancedOverlay(width, height);
    if (live && live.width === width && live.height === height) return live;
    return getOverlayImageData(overlay, width, height, cache);
  }
  if (!shouldCompositeOverlayAfterCapture(overlay)) return null;
  return getOverlayImageData(overlay, width, height, cache);
}

/** Composite overlay at 1× crop size (live CSS snapshot for advanced). */
export async function applyNativeCaptureOverlay(
  base: ImageData,
  overlay: CaptureOverlaySettings,
  cache?: Map<string, ImageData>,
): Promise<ImageData> {
  if (!overlay.enabled) return base;
  if (overlay.advanced) {
    const live = await rasterizeLiveAdvancedOverlay(base.width, base.height);
    return applyOverlayToImageData(base, overlay, cache, live);
  }
  if (!shouldCompositeOverlayAfterCapture(overlay)) return base;
  return applyOverlayToImageData(base, overlay, cache);
}

export async function applyNativeCaptureOverlayToCanvas(
  canvas: HTMLCanvasElement,
  overlay: CaptureOverlaySettings,
  cache?: Map<string, ImageData>,
): Promise<boolean> {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  let base: ImageData;
  try {
    base = ctx.getImageData(0, 0, canvas.width, canvas.height);
  } catch (error) {
    console.warn("capture readback failed before overlay:", error);
    return false;
  }
  const blended = await applyNativeCaptureOverlay(base, overlay, cache);
  if (blended === base) return false;
  ctx.putImageData(blended, 0, 0);
  return true;
}

export function nearestNeighborScaleCanvas(
  source: HTMLCanvasElement,
  scale: number,
): HTMLCanvasElement {
  if (scale <= 1) return source;
  const out = document.createElement("canvas");
  out.width = source.width * scale;
  out.height = source.height * scale;
  const ctx = out.getContext("2d");
  if (!ctx) return source;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out;
}
