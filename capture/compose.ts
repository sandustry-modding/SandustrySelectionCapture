import { rasterizeLiveAdvancedOverlay, setOverlayRecordingFrame } from "../overlay/advanced";
import { rasterizeAdvancedOverlayHtml } from "../overlay/bake";
import { drawSimpleOverlayText } from "../overlay/simple";
import type { CaptureOverlaySettings } from "../settings/panel";
import { readCaptureScale } from "../settings/mods";

let scaleScratch: HTMLCanvasElement | null = null;

function scaledScratch(width: number, height: number): HTMLCanvasElement {
  const canvas = scaleScratch ?? document.createElement("canvas");
  scaleScratch = canvas;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return canvas;
}

/** Nearest-neighbor upscale. Scale 1 returns `source`. */
export function scaleCanvasNearestNeighbor(
  source: HTMLCanvasElement,
  scale: number,
): HTMLCanvasElement {
  const pixelScale = readCaptureScale(scale);
  if (pixelScale <= 1) return source;
  const out = scaledScratch(source.width * pixelScale, source.height * pixelScale);
  const ctx = out.getContext("2d", { willReadFrequently: true });
  if (!ctx) return source;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, out.width, out.height);
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out;
}

function drawOverlayImage(ctx: CanvasRenderingContext2D, overlay: ImageData): void {
  const layer = document.createElement("canvas");
  layer.width = overlay.width;
  layer.height = overlay.height;
  const layerCtx = layer.getContext("2d");
  if (!layerCtx) return;
  layerCtx.putImageData(overlay, 0, 0);
  ctx.drawImage(layer, 0, 0);
}

/**
 * Upscale the 1× crop, then composite overlay at output pixels.
 * Overlay off is a no-op besides scale.
 */
export async function finishCaptureCanvas(
  crop: HTMLCanvasElement,
  scale: number,
  overlay?: CaptureOverlaySettings,
  options?: { frameIndex?: number },
): Promise<HTMLCanvasElement> {
  const out = scaleCanvasNearestNeighbor(crop, scale);
  if (!overlay?.enabled) return out;

  const ctx = out.getContext("2d", { willReadFrequently: true });
  if (!ctx) return out;
  const pixelScale = readCaptureScale(scale);
  const cropWidth = crop.width;
  const cropHeight = crop.height;

  if (overlay.advanced) {
    if (options?.frameIndex != null) {
      setOverlayRecordingFrame(options.frameIndex);
    }
    let live = await rasterizeLiveAdvancedOverlay(
      cropWidth,
      cropHeight,
      out.width,
      out.height,
    );
    if (!live && overlay.html.trim()) {
      live = await rasterizeAdvancedOverlayHtml(
        overlay.html,
        cropWidth,
        cropHeight,
        out.width,
        out.height,
      );
    }
    if (live) drawOverlayImage(ctx, live);
    return out;
  }

  const text = overlay.text.trim();
  if (!text) return out;
  drawSimpleOverlayText(
    ctx,
    text,
    overlay.verticalAlign,
    overlay.horizontalAlign,
    overlay.fontSize * pixelScale,
    out.width,
    out.height,
  );
  return out;
}

/** Copy output pixels once for GIF encode. */
export function canvasToRgba(canvas: HTMLCanvasElement): Uint8ClampedArray | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
}
