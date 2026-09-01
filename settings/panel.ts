import type { CellBounds } from "../selection/bounds";

const STORAGE_KEY = "irishbruse.selection-capture.settings";

const MIN_BLOCK_PADDING = -32;
const MAX_BLOCK_PADDING = 32;
const DEFAULT_BLOCK_PADDING = 1;

const MB = 1000 * 1000;

function clampBlockPadding(value: number): number {
  return Math.min(MAX_BLOCK_PADDING, Math.max(MIN_BLOCK_PADDING, Math.round(value)));
}

const MIN_FRAMES = 2;

/** Cap for encoded GIF size. `"none"` records every frame. */
export type GifSizeLimit = "1mb" | "2mb" | "5mb" | "none";

export type CaptureOverlaySettings = {
  enabled: boolean;
  advanced: boolean;
  /** Simple mode caption text. */
  text: string;
  /** Simple mode vertical position, 0 = top edge, 100 = bottom edge. */
  verticalAlign: number;
  /** Simple mode horizontal position, 0 = left edge, 100 = right edge. */
  horizontalAlign: number;
  /** Simple mode font size in 1× crop pixels. Capture multiplies by upscale. */
  fontSize: number;
  /** Advanced mode HTML/CSS inside a position:relative frame. */
  html: string;
};

export const DEFAULT_CAPTURE_OVERLAY: CaptureOverlaySettings = {
  enabled: false,
  advanced: false,
  text: "",
  verticalAlign: 88,
  horizontalAlign: 0,
  fontSize: 32,
  html: "",
};

const MIN_OVERLAY_FONT_SIZE = 8;
const MAX_OVERLAY_FONT_SIZE = 128;

function clampOverlayFontSize(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_OVERLAY_FONT_SIZE, Math.max(MIN_OVERLAY_FONT_SIZE, Math.round(n)));
}

function clampOverlayAlignPercent(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function normalizeCaptureOverlay(raw: unknown): CaptureOverlaySettings {
  const base = DEFAULT_CAPTURE_OVERLAY;
  if (!raw || typeof raw !== "object") return { ...base };
  const value = raw as Partial<CaptureOverlaySettings>;
  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : base.enabled,
    advanced: typeof value.advanced === "boolean" ? value.advanced : base.advanced,
    text: typeof value.text === "string" ? value.text : base.text,
    verticalAlign: clampOverlayAlignPercent(value.verticalAlign, base.verticalAlign),
    horizontalAlign: clampOverlayAlignPercent(value.horizontalAlign, base.horizontalAlign),
    fontSize: clampOverlayFontSize(value.fontSize, base.fontSize),
    html: typeof value.html === "string" ? value.html : base.html,
  };
}

export type CaptureSettings = {
  frames: number;
  blockPadding: number;
  greenscreen: boolean;
  showMouse: boolean;
  /** Pause the sim on each GIF frame and step one tick between captures. */
  stepSimulation: boolean;
  /** After capture, re-encode with a shared palette and cropped frame diffs. */
  optimizeGif: boolean;
  gifSizeLimit: GifSizeLimit;
  /** Locked GIF crop from the last Lock GIF area action. */
  lockedGifBounds: CellBounds | null;
  overlay: CaptureOverlaySettings;
};

export const DEFAULT_CAPTURE_SETTINGS: CaptureSettings = {
  frames: 60,
  blockPadding: DEFAULT_BLOCK_PADDING,
  greenscreen: false,
  showMouse: false,
  stepSimulation: false,
  optimizeGif: false,
  gifSizeLimit: "5mb",
  lockedGifBounds: null,
  overlay: { ...DEFAULT_CAPTURE_OVERLAY },
};

export const GIF_SIZE_LIMIT_OPTIONS: { value: GifSizeLimit; label: string }[] = [
  { value: "1mb", label: "1 MB" },
  { value: "2mb", label: "2 MB" },
  { value: "5mb", label: "5 MB" },
  { value: "none", label: "No limit" },
];

function clampMinInt(value: unknown, min: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.round(n));
}

function clampBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function isGifSizeLimit(value: unknown): value is GifSizeLimit {
  return value === "1mb" || value === "2mb" || value === "5mb" || value === "none";
}

function normalizeCellBounds(raw: unknown): CellBounds | null {
  if (!raw || typeof raw !== "object") return null;
  const bounds = raw as Partial<CellBounds>;
  const { minX, minY, maxX, maxY } = bounds;
  if (![minX, minY, maxX, maxY].every((n) => Number.isFinite(n))) return null;
  if (maxX! < minX! || maxY! < minY!) return null;
  return { minX: minX!, minY: minY!, maxX: maxX!, maxY: maxY! };
}

/** Bytes for encode. `"none"` is `Number.MAX_SAFE_INTEGER` (no practical cap). 1 MB is 1,000,000 bytes. */
export function gifSizeLimitBytes(limit: GifSizeLimit): number {
  switch (limit) {
    case "1mb":
      return MB;
    case "2mb":
      return 2 * MB;
    case "5mb":
      return 5 * MB;
    case "none":
      return Number.MAX_SAFE_INTEGER;
  }
}

/** Short label for toasts (`1 MB`, `No limit`). */
export function gifSizeLimitLabel(limit: GifSizeLimit): string {
  switch (limit) {
    case "1mb":
      return "1 MB";
    case "2mb":
      return "2 MB";
    case "5mb":
      return "5 MB";
    case "none":
      return "No limit";
  }
}

type StoredCaptureSettings = Omit<Partial<CaptureSettings>, "gifSizeLimit"> & {
  gifSizeLimit?: GifSizeLimit;
  /** Pre-0.4.2 boolean. Maps to `gifSizeLimit: "1mb"` when true. */
  limit1Mb?: boolean;
};

function normalizeGifSizeLimit(raw: StoredCaptureSettings): GifSizeLimit {
  if (isGifSizeLimit(raw.gifSizeLimit)) return raw.gifSizeLimit;
  if (raw.limit1Mb === true) return "1mb";
  return DEFAULT_CAPTURE_SETTINGS.gifSizeLimit;
}

export function normalizeCaptureSettings(
  raw: StoredCaptureSettings | null | undefined,
): CaptureSettings {
  const base = DEFAULT_CAPTURE_SETTINGS;
  if (!raw || typeof raw !== "object") return { ...base };
  return {
    frames: clampMinInt(raw.frames, MIN_FRAMES, base.frames),
    blockPadding: clampBlockPadding(Number(raw.blockPadding ?? base.blockPadding)),
    greenscreen: clampBool(raw.greenscreen, base.greenscreen),
    showMouse: clampBool(raw.showMouse, base.showMouse),
    stepSimulation: clampBool(raw.stepSimulation, base.stepSimulation),
    optimizeGif: clampBool(raw.optimizeGif, base.optimizeGif),
    gifSizeLimit: normalizeGifSizeLimit(raw),
    lockedGifBounds: normalizeCellBounds(raw.lockedGifBounds),
    overlay: normalizeCaptureOverlay(raw.overlay),
  };
}

export function loadCaptureSettings(): CaptureSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CAPTURE_SETTINGS };
    return normalizeCaptureSettings(JSON.parse(raw) as StoredCaptureSettings);
  } catch (error) {
    console.warn("capture settings load failed:", error);
    return { ...DEFAULT_CAPTURE_SETTINGS };
  }
}

export function saveCaptureSettings(settings: CaptureSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeCaptureSettings(settings)));
  } catch (error) {
    console.warn("capture settings save failed:", error);
  }
}

export {
  MIN_FRAMES,
  MIN_BLOCK_PADDING,
  MAX_BLOCK_PADDING,
  MIN_OVERLAY_FONT_SIZE,
  MAX_OVERLAY_FONT_SIZE,
};
