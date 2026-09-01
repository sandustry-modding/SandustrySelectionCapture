import { getGameCanvas, getOverlayCanvas } from "../game/session.ts";
import type { CellBounds } from "./bounds";

/** Kept for optional extra crop margin; default capture uses exact cell pixels. */
export const BORDER_PX = 0;

export type ScreenRect = { x: number; y: number; width: number; height: number };

export type ViewportRect = { x: number; y: number; width: number; height: number };

/** Expand a crop rect so a centered stroke of `lineWidth` sits outside the crop pixels. */
export function expandScreenRectOutlineOutward(rect: ScreenRect, lineWidth: number): ScreenRect {
  const half = lineWidth / 2;
  return {
    x: rect.x - half,
    y: rect.y - half,
    width: rect.width + lineWidth,
    height: rect.height + lineWidth,
  };
}

/** Map inclusive cell AABB corners (in draw pixels) to a screen rect. */
export function screenRectFromCellCorners(
  topLeft: { x: number; y: number },
  bottomRightExclusive: { x: number; y: number },
  borderPx: number = BORDER_PX,
): ScreenRect | null {
  if (
    !Number.isFinite(topLeft.x) ||
    !Number.isFinite(topLeft.y) ||
    !Number.isFinite(bottomRightExclusive.x) ||
    !Number.isFinite(bottomRightExclusive.y)
  ) {
    return null;
  }
  let x = Math.floor(topLeft.x);
  let y = Math.floor(topLeft.y);
  const right = Math.floor(bottomRightExclusive.x) - 1;
  const bottom = Math.floor(bottomRightExclusive.y) - 1;
  let width = right - x + 1;
  let height = bottom - y + 1;
  if (width <= 0 || height <= 0) return null;
  if (borderPx > 0) {
    x -= borderPx;
    y -= borderPx;
    width += borderPx * 2;
    height += borderPx * 2;
  }
  return { x, y, width, height };
}

export function getSelectionScreenRect(
  api: SandkitApi,
  bounds: CellBounds,
  borderPx: number = BORDER_PX,
): ScreenRect | null {
  return screenRectFromCellCorners(
    api.rendering.getDrawPositionAtCell(bounds.minX, bounds.minY),
    api.rendering.getDrawPositionAtCell(bounds.maxX + 1, bounds.maxY + 1),
    borderPx,
  );
}

/** Map a canvas-space crop rect to CSS viewport pixels for DOM overlays. */
export function screenRectToViewportRect(rect: ScreenRect): ViewportRect | null {
  const canvas = getOverlayCanvas() ?? getGameCanvas();
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) return null;
  const bounds = canvas.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return null;
  const scaleX = bounds.width / canvas.width;
  const scaleY = bounds.height / canvas.height;
  return {
    x: bounds.left + rect.x * scaleX,
    y: bounds.top + rect.y * scaleY,
    width: rect.width * scaleX,
    height: rect.height * scaleY,
  };
}

export function clipRectToCanvas(
  rect: ScreenRect,
  canvasW: number,
  canvasH: number,
): ScreenRect | null {
  const x0 = Math.max(0, rect.x);
  const y0 = Math.max(0, rect.y);
  const x1 = Math.min(canvasW, rect.x + rect.width);
  const y1 = Math.min(canvasH, rect.y + rect.height);
  const width = x1 - x0;
  const height = y1 - y0;
  if (width <= 0 || height <= 0) return null;
  return { x: x0, y: y0, width, height };
}
