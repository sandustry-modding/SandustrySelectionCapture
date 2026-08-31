import type { CaptureOverlaySettings } from "./captureSettings";

const KEY = "irishbruse.selection-capture:overlay";

/** True while the F7 panel is open (caption may already be on overlayCanvas). */
export function isOverlayPanelOpen(): boolean {
  const live = (globalThis as unknown as Record<string, { open?: boolean } | undefined>)[KEY];
  return live?.open === true;
}

let previewOverlayPaint = true;

/** Hide the live overlay on overlayCanvas for one paint so capture can composite after upscale. */
export function setCapturePreviewOverlayPaint(enabled: boolean): void {
  previewOverlayPaint = enabled;
}

export function isCapturePreviewOverlayPaintEnabled(): boolean {
  return previewOverlayPaint;
}

/** Composite overlay after capture (and after upscale). Live preview is suppressed during paint. */
export function shouldCompositeOverlayAfterCapture(overlay: CaptureOverlaySettings): boolean {
  return overlay.enabled;
}
