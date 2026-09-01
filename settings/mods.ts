/** Keep in sync with `countdownSeconds` in `../modinfo.ts`. */
export const MIN_COUNTDOWN = 0;
export const MAX_COUNTDOWN = 10;
export const DEFAULT_COUNTDOWN = 3;

/** Keep in sync with `pngScale` / `gifScale` in `../modinfo.ts`. */
export const MIN_CAPTURE_SCALE = 1;
export const MAX_CAPTURE_SCALE = 8;
export const DEFAULT_CAPTURE_SCALE = 1;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Whole seconds to wait before GIF capture. `0` starts at once. */
export function readCountdownSeconds(value: unknown): number {
  return clampInt(value, MIN_COUNTDOWN, MAX_COUNTDOWN, DEFAULT_COUNTDOWN);
}

/** Post-capture nearest-neighbor upscale factor. `1` keeps native crop pixels. */
export function readCaptureScale(value: unknown): number {
  return clampInt(value, MIN_CAPTURE_SCALE, MAX_CAPTURE_SCALE, DEFAULT_CAPTURE_SCALE);
}

export function modCountdownSeconds(api: SandkitApi): number {
  return readCountdownSeconds(api.settings.get("countdownSeconds"));
}

export function modDownloadPng(api: SandkitApi): boolean {
  return api.settings.get("downloadPng") === true;
}

export function modPngScale(api: SandkitApi): number {
  return readCaptureScale(api.settings.get("pngScale"));
}

export function modGifScale(api: SandkitApi): number {
  return readCaptureScale(api.settings.get("gifScale"));
}
