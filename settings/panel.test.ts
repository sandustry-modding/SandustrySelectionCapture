import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import {
  DEFAULT_CAPTURE_SETTINGS,
  GIF_SIZE_LIMIT_OPTIONS,
  gifSizeLimitBytes,
  gifSizeLimitLabel,
  loadCaptureSettings,
  normalizeCaptureOverlay,
  normalizeCaptureSettings,
  saveCaptureSettings,
  type CaptureSettings,
} from "./panel.ts";
import type { CellBounds } from "../selection/bounds.ts";

const STORAGE_KEY = "irishbruse.selection-capture.settings";

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => {
      storage.set(key, value);
    },
    removeItem: (key) => {
      storage.delete(key);
    },
    clear: () => storage.clear(),
    key: () => null,
    length: 0,
  };
});

afterEach(() => {
  delete (globalThis as { localStorage?: Storage }).localStorage;
});

test("normalizeCaptureSettings clamps invalid values", () => {
  assert.deepEqual(
    normalizeCaptureSettings({
      frames: 999,
      ticksPerFrame: 0,
      blockPadding: -5,
      greenscreen: true,
      showMouse: "yes",
      gifSizeLimit: "3mb",
    } as unknown as Partial<CaptureSettings>),
    {
      frames: 999,
      ticksPerFrame: 1,
      blockPadding: -5,
      greenscreen: true,
      showMouse: false,
      gifSizeLimit: "5mb",
      lockedGifBounds: null,
      overlay: {
        enabled: false,
        advanced: false,
        text: "",
        verticalAlign: 88,
        horizontalAlign: 0,
        fontSize: 32,
        html: "",
      },
    },
  );
});

test("normalizeCaptureSettings keeps a valid locked GIF bounds", () => {
  const locked = { minX: 1, minY: 2, maxX: 5, maxY: 6 };
  assert.deepEqual(normalizeCaptureSettings({ lockedGifBounds: locked }).lockedGifBounds, locked);
  assert.equal(
    normalizeCaptureSettings({ lockedGifBounds: { minX: 1 } as CellBounds }).lockedGifBounds,
    null,
  );
});

test("normalizeCaptureSettings maps legacy limit1Mb true to 1mb", () => {
  assert.equal(
    normalizeCaptureSettings({ limit1Mb: true } as Partial<CaptureSettings> & {
      limit1Mb: boolean;
    }).gifSizeLimit,
    "1mb",
  );
});

test("normalizeCaptureSettings keeps none as no limit", () => {
  assert.equal(normalizeCaptureSettings({ gifSizeLimit: "none" }).gifSizeLimit, "none");
});

test("GIF_SIZE_LIMIT_OPTIONS lists No limit last", () => {
  assert.deepEqual(
    GIF_SIZE_LIMIT_OPTIONS.map((option) => option.value),
    ["1mb", "2mb", "5mb", "none"],
  );
  assert.equal(GIF_SIZE_LIMIT_OPTIONS.at(-1)?.label, "No limit");
});

test("gifSizeLimitBytes and gifSizeLimitLabel cover each option", () => {
  assert.equal(gifSizeLimitBytes("1mb"), 1_000_000);
  assert.equal(gifSizeLimitBytes("2mb"), 2_000_000);
  assert.equal(gifSizeLimitBytes("5mb"), 5_000_000);
  assert.equal(gifSizeLimitBytes("none"), Number.MAX_SAFE_INTEGER);
  assert.equal(gifSizeLimitLabel("1mb"), "1 MB");
  assert.equal(gifSizeLimitLabel("2mb"), "2 MB");
  assert.equal(gifSizeLimitLabel("5mb"), "5 MB");
  assert.equal(gifSizeLimitLabel("none"), "No limit");
});

test("normalizeCaptureOverlay clamps vertical align and fills defaults", () => {
  assert.deepEqual(
    normalizeCaptureOverlay({
      enabled: true,
      advanced: true,
      text: 123,
      verticalAlign: 500,
      html: null,
    }),
    {
      enabled: true,
      advanced: true,
      text: "",
      verticalAlign: 100,
      horizontalAlign: 0,
      fontSize: 32,
      html: "",
    },
  );
});

test("saveCaptureSettings and loadCaptureSettings round-trip", () => {
  const settings = {
    frames: 24,
    ticksPerFrame: 3,
    blockPadding: 2,
    greenscreen: true,
    showMouse: true,
    gifSizeLimit: "2mb" as const,
    lockedGifBounds: { minX: 0, minY: 0, maxX: 3, maxY: 3 },
    overlay: {
      enabled: true,
      advanced: false,
      text: "Test caption",
      verticalAlign: 75,
      horizontalAlign: 0,
      fontSize: 32,
      html: "",
    },
  };
  saveCaptureSettings(settings);
  assert.equal(storage.get(STORAGE_KEY), JSON.stringify(settings));
  assert.deepEqual(loadCaptureSettings(), settings);
});

test("loadCaptureSettings returns defaults when storage is empty", () => {
  assert.deepEqual(loadCaptureSettings(), DEFAULT_CAPTURE_SETTINGS);
});
