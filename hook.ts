import { captureSelectionPngOutcome, type CapturePngOutcome } from "./capture/png";
import { recordSelectionGifOutcome, type RecordGifOutcome } from "./capture/gif";
import { getSession } from "./game/session";
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
  scale?: number;
  gifSizeLimit?: "1mb" | "2mb" | "5mb" | "none";
  greenscreen?: boolean;
  abortImmediately?: boolean;
  stepSimulation?: boolean;
  optimizeGif?: boolean;
};

export type RecordGifHookOutcome = RecordGifOutcome & {
  pausedHits: number;
  ticks: number;
};

export type SelectionCaptureTestHook = {
  capturePng: (args: CapturePngHookArgs) => Promise<CapturePngOutcome>;
  recordGif: (args: RecordGifHookArgs) => Promise<RecordGifHookOutcome>;
};

function hookLook(greenscreen: boolean | undefined) {
  return { greenscreen: greenscreen === true, showMouse: false };
}

async function watchRecordGif(
  run: () => Promise<RecordGifOutcome>,
): Promise<RecordGifHookOutcome> {
  let pausedHits = 0;
  let ticks = 0;
  let watch = true;
  const countTick = () => {
    if (!watch) return;
    ticks += 1;
    sandkit.api.schedule.nextTick(countTick);
  };
  sandkit.api.schedule.nextTick(countTick);
  const pollId = window.setInterval(() => {
    if (getSession()?.paused === true) pausedHits += 1;
  }, 1);
  try {
    const outcome = await run();
    return { ...outcome, pausedHits, ticks };
  } finally {
    watch = false;
    window.clearInterval(pollId);
  }
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
      return watchRecordGif(() =>
        recordSelectionGifOutcome(sandkit.api, {
          frames: args.frames ?? 2,
          greenscreen: args.greenscreen === true,
          showMouse: false,
          gifSizeLimit: args.gifSizeLimit ?? "5mb",
          bounds: args.bounds ?? undefined,
          scale: args.scale ?? 1,
          signal: abort.signal,
          overlay: { ...DEFAULT_CAPTURE_OVERLAY },
          stepSimulation: args.stepSimulation === true,
          optimizeGif: args.optimizeGif === true,
          download: false,
        }),
      );
    },
  };
  (globalThis as typeof globalThis & Record<string, SelectionCaptureTestHook>)[
    SELECTION_CAPTURE_TEST_HOOK
  ] = hook;
}
