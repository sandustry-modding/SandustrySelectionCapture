import { getSelectionScreenRect, screenRectToViewportRect } from "../selection/screenRect";
import { hideOverlayDomPreview, syncOverlayDomPreview } from "../overlay/advanced";
import type { CaptureOverlaySettings } from "../settings/panel";
import {
  cellBoundsEqual,
  getSelectionCellBounds,
  resolveCaptureBounds,
  type CellBounds,
  type SelectionBoundsOptions,
} from "../selection/bounds";
import { modinfo } from "../modinfo";

const PREVIEW_OUTLINE_IDLE = "rgba(255, 165, 0, 0.85)";
const PREVIEW_OUTLINE_RECORDING = "rgba(255, 0, 0, 0.75)";
const PREVIEW_OUTLINE_ENCODING = "rgba(0, 120, 255, 0.75)";

const PREVIEW_OUTLINE_WIDTH = 3;
const OUTLINE_HOST_ID = `${modinfo.id}:crop-outline`;

export type CapturePreviewOutline = "idle" | "recording" | "encoding";

export type CapturePreviewState = SelectionBoundsOptions & {
  outline?: CapturePreviewOutline;
  /** Crop held while a GIF records (C select mode exits at record start). */
  frozenBounds?: CellBounds | null;
  /** Locked GIF crop core (no block padding). Padding applies live while locked. */
  lockedGifBounds?: CellBounds | null;
  overlay?: CaptureOverlaySettings;
};

type OutlineBox = {
  bounds: CellBounds;
  color: string;
};

function frozenOutlineColor(outline: CapturePreviewOutline): string {
  if (outline === "recording") return PREVIEW_OUTLINE_RECORDING;
  if (outline === "encoding") return PREVIEW_OUTLINE_ENCODING;
  return PREVIEW_OUTLINE_IDLE;
}

function getOutlineHost(): HTMLDivElement {
  let host = document.getElementById(OUTLINE_HOST_ID) as HTMLDivElement | null;
  if (!host) {
    host = document.createElement("div");
    host.id = OUTLINE_HOST_ID;
    host.style.position = "fixed";
    host.style.inset = "0";
    host.style.pointerEvents = "none";
    host.style.zIndex = "9999";
    document.body.appendChild(host);
  }
  return host;
}

export function hideCaptureOutlineDom(): void {
  const host = document.getElementById(OUTLINE_HOST_ID);
  if (host) host.style.display = "none";
}

function syncCaptureOutlineDom(api: SandkitApi, boxes: OutlineBox[]): void {
  const viewports: Array<{ x: number; y: number; width: number; height: number; color: string }> =
    [];
  for (const box of boxes) {
    const rect = getSelectionScreenRect(api, box.bounds);
    if (!rect) continue;
    const viewport = screenRectToViewportRect(rect);
    if (!viewport || viewport.width <= 0 || viewport.height <= 0) continue;
    viewports.push({ ...viewport, color: box.color });
  }

  if (viewports.length === 0) {
    hideCaptureOutlineDom();
    return;
  }

  const host = getOutlineHost();
  host.style.display = "block";
  while (host.children.length > viewports.length) host.lastElementChild?.remove();
  while (host.children.length < viewports.length) {
    const el = document.createElement("div");
    el.style.position = "fixed";
    el.style.pointerEvents = "none";
    el.style.boxSizing = "border-box";
    host.appendChild(el);
  }

  for (let i = 0; i < viewports.length; i++) {
    const viewport = viewports[i]!;
    const el = host.children[i] as HTMLDivElement;
    el.style.left = `${viewport.x}px`;
    el.style.top = `${viewport.y}px`;
    el.style.width = `${viewport.width}px`;
    el.style.height = `${viewport.height}px`;
    el.style.outline = `${PREVIEW_OUTLINE_WIDTH}px solid ${viewport.color}`;
  }
}

/** Draw crop outlines: locked GIF area, live C selection, and active recording crop. */
export function installCaptureAreaPreview(readState: () => CapturePreviewState): () => void {
  const api = sandkit.api;
  const unsubscribe = api.events.on("frame:render", () => {
    const state = readState();
    const outline = state.outline ?? "idle";
    // Frozen recording crop is already padded. Locked core gets live block padding.
    const gifBounds =
      state.frozenBounds ??
      (state.lockedGifBounds ? resolveCaptureBounds(api, state.lockedGifBounds, state) : null);
    const liveBounds = getSelectionCellBounds(api, state);
    const previewBounds = gifBounds ?? liveBounds;
    const overlay = state.overlay;
    const previewRect =
      previewBounds && overlay?.enabled ? getSelectionScreenRect(api, previewBounds) : null;

    // DOM preview for simple and advanced — stays visible while grabs copy clean canvas pixels.
    if (previewRect && overlay?.enabled) {
      syncOverlayDomPreview(overlay, previewRect);
    } else {
      hideOverlayDomPreview();
    }

    const boxes: OutlineBox[] = [];
    if (gifBounds) {
      boxes.push({
        bounds: gifBounds,
        color: state.frozenBounds ? frozenOutlineColor(outline) : PREVIEW_OUTLINE_IDLE,
      });
    }
    if (liveBounds && (!gifBounds || !cellBoundsEqual(liveBounds, gifBounds))) {
      boxes.push({ bounds: liveBounds, color: PREVIEW_OUTLINE_IDLE });
    }
    syncCaptureOutlineDom(api, boxes);
  });

  return () => {
    unsubscribe();
    hideOverlayDomPreview();
    hideCaptureOutlineDom();
  };
}
