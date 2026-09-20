import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { setupGame } from "@modkit/test";

const MOD_ID = "irishbruse.selection-capture";
const HOOK_KEY = `${MOD_ID}:test`;
const CAPTURE_SLOT = `${MOD_ID}:capture-slot`;
const game = await setupGame();

before(async () => {
  await game.clock.install();
  await game.seed();
});

type CellBounds = { minX: number; minY: number; maxX: number; maxY: number };

type CaptureOutcome = {
  result: string;
  width?: number;
  height?: number;
  frameCount?: number;
  magic?: string;
  byteLength?: number;
  pausedHits?: number;
  ticks?: number;
};

type TestHook = {
  capturePng: (args: { bounds: CellBounds; scale?: number }) => Promise<CaptureOutcome>;
  recordGif: (args: {
    bounds: CellBounds | null;
    frames?: number;
    scale?: number;
    abortImmediately?: boolean;
    stopAfterFrames?: number;
  }) => Promise<CaptureOutcome>;
};

type PlayerCrop = {
  bounds: CellBounds;
  pixelWidth: number;
  pixelHeight: number;
};

async function playerCrop(): Promise<PlayerCrop | null> {
  return game.evaluate(() => {
    const api = sandkit.api;
    api.camera.snapToPlayer();
    const pos = api.player.getPositionAtWorld();
    const { cellSize } = api.rendering.getGridMetrics();
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y) || cellSize <= 0) return null;
    const cx = Math.floor(pos.x / cellSize);
    const cy = Math.floor(pos.y / cellSize);
    const bounds = { minX: cx - 2, minY: cy - 2, maxX: cx + 2, maxY: cy + 2 };
    const topLeft = api.rendering.getDrawPositionAtCell(bounds.minX, bounds.minY);
    const bottomRight = api.rendering.getDrawPositionAtCell(bounds.maxX + 1, bounds.maxY + 1);
    return {
      bounds,
      pixelWidth: Math.floor(bottomRight.x) - Math.floor(topLeft.x),
      pixelHeight: Math.floor(bottomRight.y) - Math.floor(topLeft.y),
    };
  });
}

async function hook(): Promise<boolean> {
  return game.evaluate((key: string) => {
    const live = (globalThis as unknown as Record<string, TestHook | undefined>)[key];
    return Boolean(live?.capturePng && live?.recordGif);
  }, HOOK_KEY);
}

type CaptureSlot = { done: boolean; value?: CaptureOutcome };

type GifStart = {
  bounds: CellBounds | null;
  frames?: number;
  scale?: number;
  abortImmediately?: boolean;
  stopAfterFrames?: number;
};

function readCaptureSlot(slotKey: string): CaptureSlot {
  return (
    (globalThis as typeof globalThis & Record<string, CaptureSlot | undefined>)[slotKey] ?? {
      done: false,
    }
  );
}

async function waitForCapture(): Promise<CaptureOutcome> {
  const slot = await game.waitFor(readCaptureSlot, (value) => value.done, {
    args: [CAPTURE_SLOT],
    ticksPerPoll: 1,
    timeoutMs: 20000,
    message: "selection capture did not finish",
  });
  assert.ok(slot.value, "capture finished without a result");
  return slot.value;
}

async function startPng(bounds: CellBounds): Promise<void> {
  await game.evaluate(
    (key: string, slotKey: string, crop: CellBounds) => {
      const live = (globalThis as unknown as Record<string, TestHook>)[key];
      const slots = globalThis as typeof globalThis & Record<string, CaptureSlot>;
      slots[slotKey] = { done: false };
      live.capturePng({ bounds: crop, scale: 1 }).then(
        (value) => {
          slots[slotKey] = { done: true, value };
        },
        () => {
          slots[slotKey] = { done: true, value: { result: "failed" } };
        },
      );
    },
    HOOK_KEY,
    CAPTURE_SLOT,
    bounds,
  );
}

async function startGif(args: GifStart): Promise<void> {
  await game.evaluate(
    (key: string, slotKey: string, gifArgs: GifStart) => {
      const live = (globalThis as unknown as Record<string, TestHook>)[key];
      const slots = globalThis as typeof globalThis & Record<string, CaptureSlot>;
      slots[slotKey] = { done: false };
      live.recordGif(gifArgs).then(
        (value) => {
          slots[slotKey] = { done: true, value };
        },
        () => {
          slots[slotKey] = { done: true, value: { result: "failed" } };
        },
      );
    },
    HOOK_KEY,
    CAPTURE_SLOT,
    args,
  );
}

describe("selection-capture grab", { concurrency: false }, () => {
  test("PNG of a small player crop is a PNG at crop size", async (t) => {
    const ids = await game.orderedModIds();
    if (!ids.includes(MOD_ID) || !(await hook())) {
      t.skip(`${MOD_ID} is not loaded`);
      return;
    }
    const crop = await playerCrop();
    assert.ok(crop);
    await startPng(crop.bounds);
    const png = await waitForCapture();
    assert.equal(png.result, "ok");
    assert.equal(png.magic?.charCodeAt(0), 0x89);
    assert.equal(png.magic?.slice(1), "PNG");
    assert.equal(png.width, crop!.pixelWidth);
    assert.equal(png.height, crop!.pixelHeight);
  });

  test("GIF of two frames is GIF89a at crop size", async (t) => {
    const ids = await game.orderedModIds();
    if (!ids.includes(MOD_ID) || !(await hook())) {
      t.skip(`${MOD_ID} is not loaded`);
      return;
    }
    const crop = await playerCrop();
    assert.ok(crop);
    await startGif({ bounds: crop.bounds, frames: 2, scale: 1 });
    const gif = await waitForCapture();
    assert.equal(gif.result, "ok");
    assert.equal(gif.magic, "GIF89a");
    assert.equal(gif.width, crop!.pixelWidth);
    assert.equal(gif.height, crop!.pixelHeight);
    assert.equal(gif.frameCount, 2);
    assert.ok((gif.byteLength ?? 0) > 16);
  });

  test("GIF abort returns cancelled", async (t) => {
    const ids = await game.orderedModIds();
    if (!ids.includes(MOD_ID) || !(await hook())) {
      t.skip(`${MOD_ID} is not loaded`);
      return;
    }
    const crop = await playerCrop();
    assert.ok(crop);
    await startGif({
      bounds: crop.bounds,
      frames: 4,
      abortImmediately: true,
    });
    const gif = await waitForCapture();
    assert.equal(gif.result, "cancelled");
  });

  test("GIF stop after two frames still encodes", async (t) => {
    const ids = await game.orderedModIds();
    if (!ids.includes(MOD_ID) || !(await hook())) {
      t.skip(`${MOD_ID} is not loaded`);
      return;
    }
    const crop = await playerCrop();
    assert.ok(crop);
    await startGif({
      bounds: crop.bounds,
      frames: 8,
      scale: 1,
      stopAfterFrames: 2,
    });
    const gif = await waitForCapture();
    assert.equal(gif.result, "ok");
    assert.equal(gif.magic, "GIF89a");
    assert.equal(gif.frameCount, 2);
  });

  test("GIF without bounds returns no-selection", async (t) => {
    const ids = await game.orderedModIds();
    if (!ids.includes(MOD_ID) || !(await hook())) {
      t.skip(`${MOD_ID} is not loaded`);
      return;
    }
    const gif = await game.evaluate(async (key: string) => {
      const live = (globalThis as unknown as Record<string, TestHook>)[key];
      return live.recordGif({ bounds: null, frames: 2 });
    }, HOOK_KEY);
    assert.equal(gif.result, "no-selection");
  });

  test("GIF record does not pause the sim", async (t) => {
    const ids = await game.orderedModIds();
    if (!ids.includes(MOD_ID) || !(await hook())) {
      t.skip(`${MOD_ID} is not loaded`);
      return;
    }
    const crop = await playerCrop();
    assert.ok(crop);
    const frames = 8;
    await startGif({
      bounds: crop.bounds,
      frames,
      scale: 1,
    });
    const gif = await waitForCapture();
    assert.equal(gif.result, "ok");
    assert.equal(gif.frameCount, frames);
    assert.equal(gif.pausedHits, 0);
    assert.ok((gif.ticks ?? 0) >= frames - 1);
  });
});
