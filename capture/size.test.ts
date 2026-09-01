import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GIF_60FPS_MAX_PIXELS,
  gifEncodedPixelCount,
  gifSelectionTooLargeFor60Fps,
} from "./size.ts";

test("GIF 60 fps cap is one 1280×720 frame", () => {
  assert.equal(GIF_60FPS_MAX_PIXELS, 1280 * 720);
});

test("gifEncodedPixelCount multiplies crop by upscale", () => {
  assert.equal(gifEncodedPixelCount(320, 180, 2), 640 * 360);
  assert.equal(gifEncodedPixelCount(100, 100, 1), 10_000);
});

test("gifSelectionTooLargeFor60Fps allows 1280×720 and rejects larger", () => {
  assert.equal(gifSelectionTooLargeFor60Fps(1280, 720, 1), false);
  assert.equal(gifSelectionTooLargeFor60Fps(1281, 720, 1), true);
  assert.equal(gifSelectionTooLargeFor60Fps(640, 360, 2), false);
  assert.equal(gifSelectionTooLargeFor60Fps(641, 360, 2), true);
});
