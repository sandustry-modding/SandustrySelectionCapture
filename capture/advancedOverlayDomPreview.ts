import { modinfo } from "../modinfo";
import { buildAdvancedOverlayFrameHtml, rasterizeForeignHtml } from "./captureOverlay";
import type { CaptureOverlaySettings } from "./captureSettings";
import { screenRectToViewportRect, type ScreenRect } from "./captureFrame";
import { snapshotOverlayRootHtml } from "./overlayDomSnapshot";
import { overlayRecordingTimeMs } from "./overlayRecording";

const HOST_ID = `${modinfo.id}:advanced-overlay-preview`;

let lastContentKey = "";
let recordingTicksPerFrame = 0;
let recordingFrameIndex = -1;

function getHost(): HTMLDivElement {
  let host = document.getElementById(HOST_ID) as HTMLDivElement | null;
  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
    host.style.position = "fixed";
    host.style.pointerEvents = "none";
    host.style.overflow = "hidden";
    host.style.zIndex = "9998";
    host.style.display = "none";
    const frame = document.createElement("div");
    frame.dataset.role = "frame";
    host.appendChild(frame);
    document.body.appendChild(host);
  }
  return host;
}

function getFrame(host: HTMLDivElement): HTMLDivElement {
  return host.querySelector('[data-role="frame"]') as HTMLDivElement;
}

function overlayRoot(): HTMLElement | null {
  const host = document.getElementById(HOST_ID) as HTMLDivElement | null;
  if (!host || host.style.display === "none") return null;
  const frame = getFrame(host);
  const root = frame.firstElementChild;
  return root instanceof HTMLElement ? root : null;
}

function pauseOverlayAnimations(root: HTMLElement): void {
  for (const anim of root.getAnimations({ subtree: true })) {
    anim.pause();
  }
}

function playOverlayAnimations(root: HTMLElement): void {
  for (const anim of root.getAnimations({ subtree: true })) {
    anim.play();
  }
}

/** Freeze overlay CSS at a sim-aligned timeline offset (ms at 50 UPS). */
export function setAdvancedOverlayAnimationTime(ms: number): void {
  const root = overlayRoot();
  if (!root) return;
  void root.offsetWidth;
  for (const anim of root.getAnimations({ subtree: true })) {
    anim.pause();
    anim.currentTime = ms;
  }
  void root.offsetWidth;
}

export function isOverlayRecordingActive(): boolean {
  return recordingTicksPerFrame > 0;
}

/** Pause wall-clock overlay motion; GIF frames advance via {@link setOverlayRecordingFrame}. */
export function beginOverlayRecording(ticksPerFrame: number): void {
  recordingTicksPerFrame = Math.max(1, Math.round(ticksPerFrame));
  recordingFrameIndex = -1;
  const root = overlayRoot();
  if (root) pauseOverlayAnimations(root);
}

export function setOverlayRecordingFrame(frameIndex: number): void {
  if (recordingTicksPerFrame <= 0) return;
  recordingFrameIndex = frameIndex;
  setAdvancedOverlayAnimationTime(overlayRecordingTimeMs(frameIndex, recordingTicksPerFrame));
}

export function endOverlayRecording(): void {
  recordingTicksPerFrame = 0;
  recordingFrameIndex = -1;
  const root = overlayRoot();
  if (root) playOverlayAnimations(root);
}

function syncRecordingOverlayPose(): void {
  if (recordingTicksPerFrame <= 0) return;
  const root = overlayRoot();
  if (!root) return;
  pauseOverlayAnimations(root);
  if (recordingFrameIndex >= 0) {
    setAdvancedOverlayAnimationTime(
      overlayRecordingTimeMs(recordingFrameIndex, recordingTicksPerFrame),
    );
  }
}

/** Live advanced overlay preview with running CSS animations. */
export function syncAdvancedOverlayDomPreview(
  settings: CaptureOverlaySettings,
  rect: ScreenRect,
): void {
  const html = settings.html.trim();
  if (!settings.enabled || !settings.advanced || !html || rect.width <= 0 || rect.height <= 0) {
    hideAdvancedOverlayDomPreview();
    return;
  }

  const viewport = screenRectToViewportRect(rect);
  if (!viewport) {
    hideAdvancedOverlayDomPreview();
    return;
  }

  const host = getHost();
  const frame = getFrame(host);
  const contentKey = `${rect.width}x${rect.height}:${html}`;

  host.style.display = "block";
  host.style.left = `${viewport.x}px`;
  host.style.top = `${viewport.y}px`;
  host.style.width = `${viewport.width}px`;
  host.style.height = `${viewport.height}px`;

  const scaleX = viewport.width / rect.width;
  const scaleY = viewport.height / rect.height;
  frame.style.width = `${rect.width}px`;
  frame.style.height = `${rect.height}px`;
  frame.style.transformOrigin = "0 0";
  frame.style.transform = `scale(${scaleX}, ${scaleY})`;

  if (contentKey !== lastContentKey) {
    lastContentKey = contentKey;
    frame.innerHTML = buildAdvancedOverlayFrameHtml(html, rect.width, rect.height);
  }

  if (isOverlayRecordingActive()) {
    syncRecordingOverlayPose();
  }
}

/** Rasterize the live overlay at crop pixels (optional upscale via SVG viewBox). */
export async function rasterizeLiveAdvancedOverlay(
  cropWidth: number,
  cropHeight: number,
  outputWidth = cropWidth,
  outputHeight = cropHeight,
): Promise<ImageData | null> {
  const root = overlayRoot();
  if (!root) return null;
  void root.offsetWidth;
  const html = await snapshotOverlayRootHtml(root);
  if (!html) return null;
  return rasterizeForeignHtml(
    html,
    cropWidth,
    cropHeight,
    outputWidth,
    outputHeight,
  );
}

export function hideAdvancedOverlayDomPreview(): void {
  lastContentKey = "";
  const host = document.getElementById(HOST_ID);
  if (host) host.style.display = "none";
}
