import { getSelectionScreenRect } from "../selection/screenRect.ts";
import type { CellBounds } from "../selection/bounds";

/**
 * Encoded pixel count above this cannot keep 60 fps.
 * 1280×720 is a full HD 16:9 frame.
 */
export const GIF_60FPS_MAX_PIXELS = 1280 * 720;

export function gifEncodedPixelCount(
  pixelWidth: number,
  pixelHeight: number,
  scale: number,
): number {
  const pixelScale = Math.max(1, Math.round(scale));
  const width = Math.max(0, Math.round(pixelWidth)) * pixelScale;
  const height = Math.max(0, Math.round(pixelHeight)) * pixelScale;
  return width * height;
}

export function gifSelectionTooLargeFor60Fps(
  pixelWidth: number,
  pixelHeight: number,
  scale: number,
): boolean {
  return gifEncodedPixelCount(pixelWidth, pixelHeight, scale) > GIF_60FPS_MAX_PIXELS;
}

/** True when the GIF crop (after upscale) is too large to capture at 60 fps. */
export function gifBoundsTooLargeFor60Fps(
  api: SandkitApi,
  bounds: CellBounds,
  scale: number,
): boolean {
  const rect = getSelectionScreenRect(api, bounds);
  if (!rect) return false;
  return gifSelectionTooLargeFor60Fps(rect.width, rect.height, scale);
}
