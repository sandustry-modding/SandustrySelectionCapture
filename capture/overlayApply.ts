import {
  beginOverlayRecording,
  endOverlayRecording,
  rasterizeLiveAdvancedOverlay,
  setOverlayRecordingFrame,
} from "./advancedOverlayDomPreview";
import {
  applyOverlayToImageData,
  getOverlayImageData,
  rasterizeAdvancedOverlaySized,
} from "./captureOverlay";
import type { CaptureOverlaySettings } from "./captureSettings";
import { shouldCompositeOverlayAfterCapture } from "./overlayPanelOpen";

export function scaleImageDataNearestNeighbor(
  image: ImageData,
  outWidth: number,
  outHeight: number,
): ImageData {
  if (image.width === outWidth && image.height === outHeight) return image;

  const src = document.createElement("canvas");
  src.width = image.width;
  src.height = image.height;
  const srcCtx = src.getContext("2d");
  if (!srcCtx) return image;
  srcCtx.putImageData(image, 0, 0);

  const out = document.createElement("canvas");
  out.width = outWidth;
  out.height = outHeight;
  const outCtx = out.getContext("2d");
  if (!outCtx) return image;
  outCtx.imageSmoothingEnabled = false;
  outCtx.drawImage(src, 0, 0, outWidth, outHeight);
  return outCtx.getImageData(0, 0, outWidth, outHeight);
}

export type OverlayApplyOptions = {
  /** GIF frame index for advanced overlay lock-step (0-based). */
  frameIndex?: number;
  ticksPerFrame?: number;
  cache?: Map<string, ImageData>;
  /** 1× crop pixels for overlay layout (defaults to canvas size). */
  cropWidth?: number;
  cropHeight?: number;
};

/** Composite overlay at 1× crop size (live CSS snapshot for advanced). */
export async function applyNativeCaptureOverlay(
  base: ImageData,
  overlay: CaptureOverlaySettings,
  options?: OverlayApplyOptions,
): Promise<ImageData> {
  const cache = options?.cache;
  if (!overlay.enabled) return base;

  const cropWidth = options?.cropWidth ?? base.width;
  const cropHeight = options?.cropHeight ?? base.height;
  const outWidth = base.width;
  const outHeight = base.height;

  if (overlay.advanced) {
    if (options?.frameIndex != null && options.ticksPerFrame != null) {
      setOverlayRecordingFrame(options.frameIndex);
    }
    let live = await rasterizeLiveAdvancedOverlay(cropWidth, cropHeight, outWidth, outHeight);
    if (!live && overlay.html.trim()) {
      live = await rasterizeAdvancedOverlaySized(
        overlay.html,
        cropWidth,
        cropHeight,
        outWidth,
        outHeight,
      );
    }
    return applyOverlayToImageData(base, overlay, cache, live);
  }
  if (!shouldCompositeOverlayAfterCapture(overlay)) return base;
  const raster = await getOverlayImageData(overlay, cropWidth, cropHeight, cache);
  if (!raster) return base;
  const scaled = scaleImageDataNearestNeighbor(raster, outWidth, outHeight);
  return applyOverlayToImageData(base, overlay, cache, scaled);
}

export async function applyNativeCaptureOverlayToCanvas(
  canvas: HTMLCanvasElement,
  overlay: CaptureOverlaySettings,
  options?: OverlayApplyOptions,
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
  const blended = await applyNativeCaptureOverlay(base, overlay, options);
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

/** Wrap GIF capture so overlay CSS stays on the sim timeline, not wall clock. */
export function withOverlayGifRecording<T>(
  ticksPerFrame: number,
  overlay: CaptureOverlaySettings | undefined,
  run: () => Promise<T>,
): Promise<T> {
  const advanced = overlay?.enabled && overlay.advanced;
  if (advanced) beginOverlayRecording(ticksPerFrame);
  return run().finally(() => {
    if (advanced) endOverlayRecording();
  });
}
