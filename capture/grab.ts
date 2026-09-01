import {
  getDynamic2DCanvas,
  getGameCanvas,
  getOverlayCanvas,
  getSession,
} from "../game/session";
import { setCapturePreviewOverlayPaint } from "../preview/crop";
import {
  clipRectToCanvas,
  getSelectionScreenRect,
  type ScreenRect,
} from "../selection/screenRect";
import type { CellBounds } from "../selection/bounds";
import { FALLBACK_SKY, GREENSCREEN } from "./look";
import type { CaptureLook } from "./types";

export type GrabFrameResult =
  | { status: "ok"; canvas: HTMLCanvasElement }
  | { status: "out-of-view" }
  | { status: "failed" };

type CursorKey = "default" | "marquee" | "demolish";

const CURSOR_PATHS: Record<Exclude<CursorKey, "default">, string> = {
  marquee: "img/cursor_marquee.png",
  demolish: "img/cursor_demolish.png",
};

const pathCursorCache = new Map<string, HTMLImageElement>();

let cropScratch: HTMLCanvasElement | null = null;

function scratchCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = cropScratch ?? document.createElement("canvas");
  cropScratch = canvas;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return canvas;
}

function resolveActiveCursorKey(): CursorKey {
  const pixi = getSession()?.rendering?.pixi;
  const style =
    pixi?.app?.renderer?.events?.cursorStyles?.default ??
    pixi?.app?.renderer?.events?.currentCursor ??
    pixi?.cursors?.default ??
    "";
  const text = String(style);
  if (text.includes("marquee") || text === pixi?.cursors?.marquee) return "marquee";
  if (text.includes("demolish") || text === pixi?.cursors?.demolish) return "demolish";
  return "default";
}

function isDrawableImage(image: CanvasImageSource | undefined): image is CanvasImageSource {
  if (!image) return false;
  if (image instanceof HTMLImageElement) {
    return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
  }
  if (image instanceof HTMLCanvasElement || image instanceof OffscreenCanvas) {
    return image.width > 0 && image.height > 0;
  }
  return true;
}

function imageNaturalSize(image: CanvasImageSource): { width: number; height: number } | null {
  if (image instanceof HTMLImageElement) {
    return { width: image.naturalWidth, height: image.naturalHeight };
  }
  if ("width" in image && "height" in image) {
    const width = Number(image.width);
    const height = Number(image.height);
    if (width > 0 && height > 0) return { width, height };
  }
  return null;
}

function getCursorImage(key: CursorKey): CanvasImageSource | null {
  const session = getSession();
  if (key === "default") {
    const image = session?.rendering?.images?.cursor_default?.image;
    return isDrawableImage(image) ? image : null;
  }

  const path = CURSOR_PATHS[key];
  let cached = pathCursorCache.get(path);
  if (!cached) {
    cached = new Image();
    cached.src = path;
    pathCursorCache.set(path, cached);
  }
  return isDrawableImage(cached) ? cached : null;
}

function drawMouseCursor(
  ctx: CanvasRenderingContext2D,
  clip: ScreenRect,
  cropWidth: number,
  cropHeight: number,
): void {
  const session = getSession();
  const mouse = session?.input?.mouse;
  if (mouse?.available === false) return;
  const mx = mouse?.position?.x;
  const my = mouse?.position?.y;
  if (!Number.isFinite(mx) || !Number.isFinite(my)) return;

  const localX = (mx as number) - clip.x;
  const localY = (my as number) - clip.y;
  if (localX < 0 || localY < 0 || localX >= cropWidth || localY >= cropHeight) return;

  const image = getCursorImage(resolveActiveCursorKey()) ?? getCursorImage("default");
  if (!image) return;

  const natural = imageNaturalSize(image);
  if (!natural) return;

  const scale = Math.max(1, Number(session?.settings?.cursorScale) || 1);
  const width = Math.max(1, Math.round(natural.width * scale));
  const height = Math.max(1, Math.round(natural.height * scale));

  const previousSmooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  try {
    ctx.drawImage(image, localX, localY, width, height);
  } catch (error) {
    console.warn(`cursor draw failed:`, error);
  } finally {
    ctx.imageSmoothingEnabled = previousSmooth;
  }
}

/**
 * Crop the selection from the live game canvases.
 * Layers (bottom to top): WebGL world, dynamic2D tool FX, overlayCanvas (wires, hover UI).
 */
export function rasterizeSelection(
  api: SandkitApi,
  bounds: CellBounds,
  look?: CaptureLook,
): GrabFrameResult {
  const screenRect = getSelectionScreenRect(api, bounds);
  if (!screenRect) {
    console.warn(`could not map cell bounds to screen`);
    return { status: "failed" };
  }

  const dynamicCanvas = getDynamic2DCanvas();
  if (!dynamicCanvas) {
    console.warn(`dynamic2D canvas missing`);
    return { status: "failed" };
  }

  const clip = clipRectToCanvas(screenRect, dynamicCanvas.width, dynamicCanvas.height);
  if (!clip) {
    console.warn(`selection off-screen`, { screenRect });
    return { status: "out-of-view" };
  }

  const out = scratchCanvas(clip.width, clip.height);
  const ctx = out.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { status: "failed" };
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = look?.greenscreen ? GREENSCREEN : FALLBACK_SKY;
  ctx.fillRect(0, 0, out.width, out.height);
  const gameCanvas = getGameCanvas();
  if (gameCanvas && gameCanvas.width > 0 && gameCanvas.height > 0) {
    try {
      ctx.drawImage(
        gameCanvas,
        clip.x,
        clip.y,
        clip.width,
        clip.height,
        0,
        0,
        clip.width,
        clip.height,
      );
    } catch (error) {
      console.warn(`WebGL backdrop draw failed:`, error);
    }
  }

  try {
    ctx.drawImage(
      dynamicCanvas,
      clip.x,
      clip.y,
      clip.width,
      clip.height,
      0,
      0,
      clip.width,
      clip.height,
    );
  } catch (error) {
    console.error(`dynamic2D draw failed:`, error);
    return { status: "failed" };
  }

  const overlayCanvas = getOverlayCanvas();
  if (overlayCanvas) {
    try {
      ctx.drawImage(
        overlayCanvas,
        clip.x,
        clip.y,
        clip.width,
        clip.height,
        0,
        0,
        clip.width,
        clip.height,
      );
    } catch (error) {
      console.warn(`overlay draw failed:`, error);
    }
  }

  if (look?.showMouse) {
    drawMouseCursor(ctx, clip, out.width, out.height);
  }

  return { status: "ok", canvas: out };
}

/**
 * Copy pixels on the first microtask after `frame:render`.
 * That event fires just before `texture.update` + Pixi render — a sync read is
 * still the sky clear. Waiting an extra `await` hop is too late (WebGL buffer gone).
 *
 * `onPaint` runs in the render listener (before the copy) so the sim can pause
 * while a large crop is still on the main thread.
 */
export function grabSelectionFrame(
  api: SandkitApi,
  bounds: CellBounds,
  look?: CaptureLook,
  onPaint?: () => void,
): Promise<GrabFrameResult> {
  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = 0;
    setCapturePreviewOverlayPaint(false);
    const finish = (result: GrabFrameResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      setCapturePreviewOverlayPaint(true);
      resolve(result);
    };
    const unsubscribe = api.events.on("frame:render", () => {
      unsubscribe();
      onPaint?.();
      queueMicrotask(() => {
        try {
          finish(rasterizeSelection(api, bounds, look));
        } catch (error) {
          console.warn(`grab threw:`, error);
          finish({ status: "failed" });
        }
      });
    });
    timeoutId = window.setTimeout(() => {
      unsubscribe();
      finish({ status: "failed" });
    }, 2000);
  });
}
