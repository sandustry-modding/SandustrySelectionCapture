import { applyCaptureLook } from "./look";
import { grabSelectionFrame } from "./grab";
import type { CaptureLook, CapturePngResult } from "./types";
import type { CaptureOverlaySettings } from "../settings/panel";
import { DEFAULT_CAPTURE_SCALE, readCaptureScale } from "../settings/mods";
import {
  resolveCaptureBounds,
  type CellBounds,
  type SelectionBoundsOptions,
} from "../selection/bounds";
import { captureDownloadFilename, downloadBlob } from "./download";

export type CapturePngOptions = SelectionBoundsOptions & {
  /** Locked crop used when the C marquee is off. */
  lockedBounds?: CellBounds | null;
  /** When true, download a PNG file instead of copying to the clipboard. */
  download?: boolean;
  /** Post-capture nearest-neighbor upscale. Default 1. */
  scale?: number;
  /** Optional caption overlay composited after upscale. */
  overlay?: CaptureOverlaySettings;
};

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

async function copyPngToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
  const blob = await canvasToPngBlob(canvas);
  if (!blob) {
    console.error(`toBlob returned null`);
    return false;
  }
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    console.error(`clipboard image write unavailable`);
    return false;
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": Promise.resolve(blob) })]);
    console.log(`copied PNG to clipboard`, { bytes: blob.size });
    return true;
  } catch (error) {
    console.error(`clipboard.write failed:`, error);
    return false;
  }
}

/** Crop the C marquee, then copy or download a PNG. */
export async function captureSelectionPng(
  api: SandkitApi,
  look: CaptureLook = { greenscreen: false, showMouse: false },
  options: CapturePngOptions = {},
): Promise<CapturePngResult> {
  const bounds = resolveCaptureBounds(api, options.lockedBounds, options);
  if (!bounds) {
    console.warn(`no selection bounds`);
    return "no-selection";
  }

  const scale = readCaptureScale(options.scale ?? DEFAULT_CAPTURE_SCALE);
  console.log(`PNG capture`, { bounds, scale, download: options.download });

  const restoreLook = applyCaptureLook(look);
  try {
    const frame = await grabSelectionFrame(api, bounds, look);
    if (!frame) return "failed";

    if (options.download) {
      const blob = await canvasToPngBlob(frame);
      if (!blob) return "failed";
      downloadBlob(blob, captureDownloadFilename("png"));
      console.log(`downloaded PNG`, { bytes: blob.size });
      return "ok";
    }

    const ok = await copyPngToClipboard(frame);
    return ok ? "ok" : "failed";
  } catch (error) {
    console.warn(`PNG capture failed:`, error);
    return "failed";
  } finally {
    restoreLook();
  }
}
