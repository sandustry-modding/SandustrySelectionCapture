import { applyCaptureLook } from "./look";
import { grabSelectionFrame } from "./grab";
import { finishCaptureCanvas } from "./compose";
import { getSession } from "../game/session";
import type { CaptureLook, CapturePngResult } from "./types";
import type { CaptureOverlaySettings } from "../settings/panel";
import { DEFAULT_CAPTURE_SCALE, readCaptureScale } from "../settings/mods";
import {
  resolveCaptureBounds,
  type CellBounds,
  type SelectionBoundsOptions,
} from "../selection/bounds";
import { captureDownloadFilename, downloadBlob } from "./download";
import { setSimulationPaused } from "./sim";

export type CapturePngOptions = SelectionBoundsOptions & {
  /** Locked capture core used when the C marquee is off. Block padding applies live. */
  lockedBounds?: CellBounds | null;
  /** When true, download a PNG file instead of copying to the clipboard. */
  download?: boolean;
  /** Post-capture nearest-neighbor upscale. Default 2. */
  scale?: number;
  /** Optional caption overlay composited after upscale. */
  overlay?: CaptureOverlaySettings;
  /** Skip clipboard and download (tests). */
  emit?: "clipboard" | "download" | "none";
};

export type CapturePngOutcome = {
  result: CapturePngResult;
  width?: number;
  height?: number;
  magic?: string;
  byteLength?: number;
};

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

async function blobMagic(blob: Blob): Promise<{ magic: string; byteLength: number }> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const magic = String.fromCharCode(...bytes.subarray(0, 4));
  return { magic, byteLength: bytes.byteLength };
}

async function copyPngToClipboard(blob: Blob): Promise<boolean> {
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

export async function captureSelectionPngOutcome(
  api: SandkitApi,
  look: CaptureLook = { greenscreen: false, showMouse: false },
  options: CapturePngOptions = {},
): Promise<CapturePngOutcome> {
  const bounds = resolveCaptureBounds(api, options.lockedBounds, options);
  if (!bounds) {
    console.warn(`no selection bounds`);
    return { result: "no-selection" };
  }

  const scale = readCaptureScale(options.scale ?? DEFAULT_CAPTURE_SCALE);
  console.log(`PNG capture`, { bounds, scale, download: options.download });

  const wasPaused = getSession()?.paused === true;
  if (wasPaused) setSimulationPaused(false);
  const restoreLook = applyCaptureLook(look);
  try {
    const grab = await grabSelectionFrame(
      api,
      bounds,
      look,
      wasPaused ? () => setSimulationPaused(true) : undefined,
    );
    if (grab.status !== "ok") {
      return { result: grab.status === "out-of-view" ? "out-of-view" : "failed" };
    }

    const frame = await finishCaptureCanvas(grab.canvas, scale, options.overlay);
    const blob = await canvasToPngBlob(frame);
    if (!blob) return { result: "failed" };
    const meta = await blobMagic(blob);
    const emit =
      options.emit ?? (options.download ? "download" : "clipboard");

    if (emit === "download") {
      downloadBlob(blob, captureDownloadFilename("png"));
      console.log(`downloaded PNG`, { bytes: blob.size });
      return { result: "ok", width: frame.width, height: frame.height, ...meta };
    }
    if (emit === "none") {
      return { result: "ok", width: frame.width, height: frame.height, ...meta };
    }

    const ok = await copyPngToClipboard(blob);
    return {
      result: ok ? "ok" : "failed",
      width: frame.width,
      height: frame.height,
      ...meta,
    };
  } catch (error) {
    console.warn(`PNG capture failed:`, error);
    return { result: "failed" };
  } finally {
    restoreLook();
    setSimulationPaused(wasPaused);
  }
}

/** Crop the C marquee, then copy or download a PNG. */
export async function captureSelectionPng(
  api: SandkitApi,
  look: CaptureLook = { greenscreen: false, showMouse: false },
  options: CapturePngOptions = {},
): Promise<CapturePngResult> {
  return (await captureSelectionPngOutcome(api, look, options)).result;
}
