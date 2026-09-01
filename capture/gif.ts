import { applyCaptureLook } from "./look";
import { grabSelectionFrame } from "./grab";
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
import { isAbortError, setSimulationPaused, throwIfAborted, waitTicks } from "./sim";

const MIN_FRAMES = 2;
const MIN_TICKS = 1;
const MAX_TICKS = 30;

export type RecordGifOptions = {
  frames: number;
  ticksPerFrame: number;
  greenscreen: boolean;
  showMouse: boolean;
  /** Cap encoded GIF size (`none` keeps the full file). */
  gifSizeLimit: GifSizeLimit;
  /** Extra structure blocks around the core selection. `0` is tight; `1` is the default. */
  blockPadding?: number;
  /** When set, record this crop instead of reading the C marquee. */
  bounds?: CellBounds;
  /** Post-capture nearest-neighbor upscale. Default 1. */
  scale?: number;
  signal?: AbortSignal;
  /** Called after capture, before encode. */
  onEncodeStart?: () => void;
  /** Optional caption overlay composited on each frame after upscale. */
  overlay?: CaptureOverlaySettings;
};

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampMinInt(value: number, min: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.round(value));
}

/**
 * Pause, capture N frames with `ticksPerFrame` sim ticks between them, encode a GIF, and download it.
 */
export async function recordSelectionGif(
  api: SandkitApi,
  options: RecordGifOptions,
): Promise<RecordGifResult> {
  const framesWanted = clampMinInt(options.frames, MIN_FRAMES);
  const ticksPerFrame = clampInt(options.ticksPerFrame, MIN_TICKS, MAX_TICKS);
  const look: CaptureLook = {
    greenscreen: options.greenscreen,
    showMouse: options.showMouse,
  };

  const bounds = options.bounds;
  if (!bounds) {
    console.warn(`no GIF bounds`);
    return "no-selection";
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

  const overlay = options.overlay;
  const advanced = overlay?.enabled === true && overlay.advanced;
  const frames: HTMLCanvasElement[] = [];
  const restoreLook = applyCaptureLook(look);
  try {
    if (advanced) beginOverlayRecording(ticksPerFrame);
    try {
      for (let i = 0; i < framesWanted; i++) {
        if (i > 0) {
          await waitTicks(api, ticksPerFrame, options.signal);
          throwIfAborted(options.signal);
        }

        if (overlay?.advanced) setOverlayRecordingFrame(i);

        const frame = await grabSelectionFrame(api, bounds, look);
        throwIfAborted(options.signal);
        if (!frame) return "failed";
        frames.push(frame);
      }
    } finally {
      if (advanced) endOverlayRecording();
    }

    if (frames.length < MIN_FRAMES) return "failed";
    options.onEncodeStart?.();
    return "failed";
  } catch (error) {
    if (isAbortError(error)) return "cancelled";
    console.error(`record threw:`, error);
    return "failed";
  } finally {
    restoreLook();
    setSimulationPaused(wasPaused);
  }
}
