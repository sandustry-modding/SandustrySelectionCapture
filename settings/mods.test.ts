import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_CAPTURE_SCALE,
  DEFAULT_COUNTDOWN,
  readCaptureScale,
  readCountdownSeconds,
} from "./mods.ts";

test("readCountdownSeconds clamps to 0–10 and defaults to 3", () => {
  assert.equal(readCountdownSeconds(undefined), DEFAULT_COUNTDOWN);
  assert.equal(readCountdownSeconds("bad"), DEFAULT_COUNTDOWN);
  assert.equal(readCountdownSeconds(-1), 0);
  assert.equal(readCountdownSeconds(99), 10);
  assert.equal(readCountdownSeconds(5.7), 6);
  assert.equal(readCountdownSeconds(0), 0);
});

test("readCaptureScale defaults to 1 and clamps to 1–8", () => {
  assert.equal(readCaptureScale(undefined), DEFAULT_CAPTURE_SCALE);
  assert.equal(readCaptureScale("bad"), DEFAULT_CAPTURE_SCALE);
  assert.equal(readCaptureScale(0), 1);
  assert.equal(readCaptureScale(99), 8);
  assert.equal(readCaptureScale(2.6), 3);
  assert.equal(readCaptureScale(1), 1);
});
