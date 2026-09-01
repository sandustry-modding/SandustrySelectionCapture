import assert from "node:assert/strict";
import { test } from "node:test";
import { overlayRecordingTimeMs, SIM_MS_PER_TICK } from "./recording.ts";

test("overlayRecordingTimeMs aligns overlay pose with GIF frame ticks", () => {
  assert.equal(SIM_MS_PER_TICK, 20);
  assert.equal(overlayRecordingTimeMs(0), 0);
  assert.equal(overlayRecordingTimeMs(3), 60);
  assert.equal(overlayRecordingTimeMs(10), 200);
});
