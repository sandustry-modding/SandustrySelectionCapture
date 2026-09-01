import { captureSelectionPngOutcome, type CapturePngOutcome } from "./capture/png";
import { recordSelectionGifOutcome, type RecordGifOutcome } from "./capture/gif";
import type { CellBounds } from "./selection/bounds";
import { DEFAULT_CAPTURE_OVERLAY } from "./settings/panel";
import { modinfo } from "./modinfo";

export const SELECTION_CAPTURE_TEST_HOOK = `${modinfo.id}:test`;

export type CapturePngHookArgs = {
  bounds: CellBounds;
  scale?: number;
  greenscreen?: boolean;
};

export type RecordGifHookArgs = {
  bounds: CellBounds | null;
  frames?: number;
  ticksPerFrame?: number;
  scale?: number;
  gifSizeLimit?: "1mb" | "2mb" | "5mb" | "none";
  greenscreen?: boolean;
  abortImmediately?: boolean;
};

export type SelectionCaptureTestHook = {
  capturePng: (args: CapturePngHookArgs) => Promise<CapturePngOutcome>;
  recordGif: (args: RecordGifHookArgs) => Promise<RecordGifOutcome>;
};

function hookLook(greenscreen: boolean | undefined) {
  return { greenscreen: greenscreen === true, showMouse: false };
}

export function installSelectionCaptureTestHook(): void {
  const hook: SelectionCaptureTestHook = {
    capturePng(args) {
      return captureSelectionPngOutcome(sandkit.api, hookLook(args.greenscreen), {
        lockedBounds: args.bounds,
        scale: args.scale ?? 1,
        emit: "none",
        overlay: { ...DEFAULT_CAPTURE_OVERLAY },
      });
    },
    recordGif(args) {
      const abort = new AbortController();
      if (args.abortImmediately) abort.abort();
      return recordSelectionGifOutcome(sandkit.api, {
        frames: args.frames ?? 2,
        ticksPerFrame: args.ticksPerFrame ?? 1,
        greenscreen: args.greenscreen === true,
        showMouse: false,
        gifSizeLimit: args.gifSizeLimit ?? "5mb",
        bounds: args.bounds ?? undefined,
        scale: args.scale ?? 1,
        signal: abort.signal,
        overlay: { ...DEFAULT_CAPTURE_OVERLAY },
        download: false,
      });
    },
  };
  (globalThis as typeof globalThis & Record<string, SelectionCaptureTestHook>)[
    SELECTION_CAPTURE_TEST_HOOK
  ] = hook;
}
