import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { setupGame } from "@modkit/test";

const MOD_ID = "irishbruse.selection-capture";
const HOOK_KEY = `${MOD_ID}:test`;
const game = await setupGame();

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
  capturePng: (args: {
    bounds: CellBounds;
    scale?: number;
  }) => Promise<CaptureOutcome>;
  recordGif: (args: {
    bounds: CellBounds | null;
    frames?: number;
    scale?: number;
    abortImmediately?: boolean;
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

describe("selection-capture grab", { concurrency: false }, () => {
  test("PNG of a small player crop is a PNG at crop size", async (t) => {
    const ids = await game.orderedModIds();
    if (!ids.includes(MOD_ID) || !(await hook())) {
      t.skip(`${MOD_ID} is not loaded`);
      return;
    }
    const crop = await playerCrop();
    assert.ok(crop);
    const png = await game.evaluate(
      async (key: string, bounds: CellBounds) => {
        const live = (globalThis as unknown as Record<string, TestHook>)[key];
        return live.capturePng({ bounds, scale: 1 });
      },
      HOOK_KEY,
      crop!.bounds,
    );
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
    const gif = await game.evaluate(
      async (key: string, bounds: CellBounds) => {
        const live = (globalThis as unknown as Record<string, TestHook>)[key];
        return live.recordGif({ bounds, frames: 2, scale: 1 });
      },
      HOOK_KEY,
      crop!.bounds,
    );
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
    const gif = await game.evaluate(
      async (key: string, bounds: CellBounds) => {
        const live = (globalThis as unknown as Record<string, TestHook>)[key];
        return live.recordGif({
          bounds,
          frames: 4,
          abortImmediately: true,
        });
      },
      HOOK_KEY,
      crop!.bounds,
    );
    assert.equal(gif.result, "cancelled");
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
    await game.resumeSimulation();
    const crop = await playerCrop();
    assert.ok(crop);
    const frames = 8;
    const gif = await game.evaluate(
      async (key: string, bounds: CellBounds, frameCount: number) => {
        const live = (globalThis as unknown as Record<string, TestHook>)[key];
        return live.recordGif({
          bounds,
          frames: frameCount,
          scale: 1,
        });
      },
      HOOK_KEY,
      crop!.bounds,
      frames,
    );
    assert.equal(gif.result, "ok");
    assert.equal(gif.frameCount, frames);
    assert.equal(gif.pausedHits, 0);
    assert.ok((gif.ticks ?? 0) >= frames - 1);
  });
});
