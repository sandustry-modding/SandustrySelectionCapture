import { applyCaptureLook } from "./look";
import { grabSelectionFrame, type GrabFrameResult } from "./grab";
import { canvasToRgba, finishCaptureCanvas } from "./compose";
import { getSession } from "../game/session";
import type { CaptureLook, RecordGifResult } from "./types";
import type { CaptureOverlaySettings } from "../settings/panel";
import { gifSizeLimitBytes, type GifSizeLimit } from "../settings/panel";
import { DEFAULT_CAPTURE_SCALE, readCaptureScale } from "../settings/mods";
import { clearMarqueeSelection, type CellBounds } from "../selection/bounds";
import {
  beginOverlayRecording,
  endOverlayRecording,
  setOverlayRecordingFrame,
} from "../overlay/advanced";
import { SIM_MS_PER_TICK } from "../overlay/recording";
import { captureDownloadFilename, downloadBlob, gifBytesToBlob } from "./download";
import { GIF_MIN_FRAMES } from "./gifLimit";
import { openGifEncodeSession, type EncodedGif } from "./gifEncode";
import { isAbortError, setSimulationPaused, throwIfAborted, waitTicks } from "./sim";

const MIN_FRAMES = GIF_MIN_FRAMES;
const MIN_TICKS = 1;
const MAX_TICKS = 30;

export type RecordGifOptions = {
  frames: number;
  ticksPerFrame: number;
  greenscreen: boolean;
  showMouse: boolean;
  /** Cap encoded GIF size. */
  gifSizeLimit: GifSizeLimit;
  /** Extra structure blocks around the core selection. `0` is tight; `1` is the default. */
  blockPadding?: number;
  /** When set, record this crop instead of reading the C marquee. */
  bounds?: CellBounds;
  /** Post-capture nearest-neighbor upscale. Default 1. */
  scale?: number;
  signal?: AbortSignal;
  /** Called after capture, before the worker flush. */
  onEncodeStart?: () => void;
  /** Optional caption overlay composited on each frame after upscale. */
  overlay?: CaptureOverlaySettings;
  /** When false, skip the file download (tests). Default true. */
  download?: boolean;
};

export type RecordGifOutcome = {
  result: RecordGifResult;
  width?: number;
  height?: number;
  frameCount?: number;
  magic?: string;
  byteLength?: number;
};

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampMinInt(value: number, min: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.round(value));
}

function gifMagic(bytes: Uint8Array): string {
  return String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0, bytes[2] ?? 0, bytes[3] ?? 0, bytes[4] ?? 0, bytes[5] ?? 0);
}

function outcome(result: RecordGifResult, encoded?: EncodedGif): RecordGifOutcome {
  if (!encoded) return { result };
  return {
    result,
    width: encoded.width,
    height: encoded.height,
    frameCount: encoded.frameCount,
    magic: gifMagic(encoded.bytes),
    byteLength: encoded.bytes.byteLength,
  };
}

async function grabPaintedFrame(
  api: SandkitApi,
  bounds: CellBounds,
  look: CaptureLook,
): Promise<GrabFrameResult> {
  if (getSession()?.paused === true) setSimulationPaused(false);
  try {
    return await grabSelectionFrame(api, bounds, look, () => setSimulationPaused(true));
  } catch (error) {
    console.warn(`paint wait failed, retry:`, error);
    setSimulationPaused(false);
    try {
      return await grabSelectionFrame(api, bounds, look, () => setSimulationPaused(true));
    } catch (retryError) {
      console.warn(`paint wait failed:`, retryError);
      return { status: "failed" };
    }
  }
}

/**
 * Pause, capture N frames with `ticksPerFrame` sim ticks between them, encode a GIF, and download it.
 */
export async function recordSelectionGifOutcome(
  api: SandkitApi,
  options: RecordGifOptions,
): Promise<RecordGifOutcome> {
  const framesWanted = clampMinInt(options.frames, MIN_FRAMES);
  const ticksPerFrame = clampInt(options.ticksPerFrame, MIN_TICKS, MAX_TICKS);
  const delayMs = Math.max(SIM_MS_PER_TICK, ticksPerFrame * SIM_MS_PER_TICK);
  const look: CaptureLook = {
    greenscreen: options.greenscreen,
    showMouse: options.showMouse,
  };

  const bounds = options.bounds;
  if (!bounds) {
    console.warn(`no GIF bounds`);
    return outcome("no-selection");
  }

  clearMarqueeSelection(api);
  const wasPaused = getSession()?.paused === true;
  const maxBytes = gifSizeLimitBytes(options.gifSizeLimit);
  const scale = readCaptureScale(options.scale ?? DEFAULT_CAPTURE_SCALE);
  console.log(`record start`, {
    bounds,
    framesWanted,
    ticksPerFrame,
    scale,
    maxBytes,
    greenscreen: look.greenscreen,
    showMouse: look.showMouse,
    gifSizeLimit: options.gifSizeLimit,
  });

  throwIfAborted(options.signal);

  const overlay = options.overlay;
  const overlayEnabled = overlay?.enabled === true;
  const advanced = overlayEnabled && overlay.advanced;
  const restoreLook = applyCaptureLook(look);
  let session: Awaited<ReturnType<typeof openGifEncodeSession>> | null = null;
  let hitLimit = false;
  let acceptedFrames = 0;

  try {
    if (advanced) beginOverlayRecording(ticksPerFrame);
    try {
      for (let i = 0; i < framesWanted; i++) {
        if (i > 0) {
          await waitTicks(api, ticksPerFrame, options.signal);
          throwIfAborted(options.signal);
        }

        if (overlay?.advanced) setOverlayRecordingFrame(i);

        const grab = await grabPaintedFrame(api, bounds, look);
        throwIfAborted(options.signal);
        if (grab.status !== "ok") {
          if (i === 0) return outcome(grab.status === "out-of-view" ? "out-of-view" : "failed");
          console.warn(`frame ${i + 1} missing — abort`);
          return outcome("failed");
        }

        const frame = await finishCaptureCanvas(grab.canvas, scale, overlayEnabled ? overlay : undefined, {
          frameIndex: i,
          ticksPerFrame,
        });
        const rgba = canvasToRgba(frame);
        if (!rgba) return outcome("failed");

        if (!session) {
          session = await openGifEncodeSession({
            width: frame.width,
            height: frame.height,
            delay: delayMs,
            maxBytes,
            signal: options.signal,
          });
        }

        const added = await session.addFrame(rgba, options.signal);
        if (!added.accepted) {
          hitLimit = true;
          break;
        }
        acceptedFrames = added.frameCount;
        if (i === 0 || i % 10 === 0) {
          console.log(`captured frame ${i + 1}/${framesWanted}`);
        }
      }
    } finally {
      if (advanced) endOverlayRecording();
    }

    if (acceptedFrames < MIN_FRAMES && !hitLimit) return outcome("failed");
    if (!session) return outcome("failed");

    options.onEncodeStart?.();
    const encoded = await session.finish(options.signal);
    session = null;
    if (encoded === "too-large") return outcome("too-large");

    if (options.download !== false) {
      downloadBlob(gifBytesToBlob(encoded.bytes), captureDownloadFilename("gif"));
    }
    console.log(`GIF ready`, {
      frames: encoded.frameCount,
      bytes: encoded.bytes.byteLength,
      hitLimit: encoded.hitLimit,
    });
    return outcome(encoded.hitLimit ? "ok-capped" : "ok", encoded);
  } catch (error) {
    session?.close();
    if (isAbortError(error)) return outcome("cancelled");
    console.error(`record threw:`, error);
    return outcome("failed");
  } finally {
    restoreLook();
    setSimulationPaused(wasPaused);
  }
}

export async function recordSelectionGif(
  api: SandkitApi,
  options: RecordGifOptions,
): Promise<RecordGifResult> {
  return (await recordSelectionGifOutcome(api, options)).result;
}
