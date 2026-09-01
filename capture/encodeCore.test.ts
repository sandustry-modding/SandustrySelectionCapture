import assert from "node:assert/strict";
import { test } from "node:test";
import { encodeRgbaGif, GIF_MIN_FRAMES } from "./encodeCore.ts";

function solidFrame(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return data;
}

function readGifSize(bytes: Uint8Array): { width: number; height: number; magic: string } {
  const magic = String.fromCharCode(
    bytes[0] ?? 0,
    bytes[1] ?? 0,
    bytes[2] ?? 0,
    bytes[3] ?? 0,
    bytes[4] ?? 0,
    bytes[5] ?? 0,
  );
  const width = (bytes[6] ?? 0) | ((bytes[7] ?? 0) << 8);
  const height = (bytes[8] ?? 0) | ((bytes[9] ?? 0) << 8);
  return { magic, width, height };
}

const WIDTH = 16;
const HEIGHT = 12;
const red = solidFrame(WIDTH, HEIGHT, 255, 0, 0);
const green = solidFrame(WIDTH, HEIGHT, 0, 255, 0);
const blue = solidFrame(WIDTH, HEIGHT, 0, 0, 255);

test("encodeRgbaGif writes GIF89a with frame size", () => {
  const encoded = encodeRgbaGif({
    frames: [red, green],
    width: WIDTH,
    height: HEIGHT,
    delay: 20,
    maxBytes: 1024 * 1024,
  });
  assert.notEqual(encoded, "too-large");
  if (encoded === "too-large") return;
  const header = readGifSize(encoded.bytes);
  assert.equal(header.magic, "GIF89a");
  assert.equal(header.width, WIDTH);
  assert.equal(header.height, HEIGHT);
  assert.equal(encoded.frameCount, 2);
  assert.equal(encoded.hitLimit, false);
  assert.equal(encoded.bytes[encoded.bytes.byteLength - 1], 0x3b);
});

test("encodeRgbaGif size cap keeps a prefix that fits", () => {
  const two = encodeRgbaGif({
    frames: [red, green],
    width: WIDTH,
    height: HEIGHT,
    delay: 20,
    maxBytes: 1024 * 1024,
  });
  assert.notEqual(two, "too-large");
  if (two === "too-large") return;

  const capped = encodeRgbaGif({
    frames: [red, green, blue],
    width: WIDTH,
    height: HEIGHT,
    delay: 20,
    maxBytes: two.bytes.byteLength,
  });
  assert.notEqual(capped, "too-large");
  if (capped === "too-large") return;
  assert.equal(capped.frameCount, GIF_MIN_FRAMES);
  assert.equal(capped.hitLimit, true);
  assert.ok(capped.bytes.byteLength <= two.bytes.byteLength);
});

test("encodeRgbaGif assembled file stays at or under maxBytes", () => {
  const frames = [red, green, blue, red, green, blue];
  const encoded = encodeRgbaGif({
    frames,
    width: WIDTH,
    height: HEIGHT,
    delay: 20,
    maxBytes: 5_000_000,
  });
  assert.notEqual(encoded, "too-large");
  if (encoded === "too-large") return;
  assert.ok(encoded.bytes.byteLength <= 5_000_000);
});

test("encodeRgbaGif returns too-large when two frames cannot fit", () => {
  const encoded = encodeRgbaGif({
    frames: [red, green],
    width: WIDTH,
    height: HEIGHT,
    delay: 20,
    maxBytes: 16,
  });
  assert.equal(encoded, "too-large");
});

test("encodeRgbaGif optimize shrinks repeated frames and stays GIF89a", () => {
  const plain = encodeRgbaGif({
    frames: [red, red, red, red],
    width: WIDTH,
    height: HEIGHT,
    delay: 20,
    maxBytes: 1024 * 1024,
  });
  const optimized = encodeRgbaGif({
    frames: [red, red, red, red],
    width: WIDTH,
    height: HEIGHT,
    delay: 20,
    maxBytes: 1024 * 1024,
    optimize: true,
  });
  assert.notEqual(plain, "too-large");
  assert.notEqual(optimized, "too-large");
  if (plain === "too-large" || optimized === "too-large") return;
  const header = readGifSize(optimized.bytes);
  assert.equal(header.magic, "GIF89a");
  assert.equal(header.width, WIDTH);
  assert.equal(header.height, HEIGHT);
  assert.equal(optimized.frameCount, 4);
  assert.equal(optimized.bytes[optimized.bytes.byteLength - 1], 0x3b);
  assert.ok(optimized.bytes.byteLength < plain.bytes.byteLength);
});

function frameWithDot(
  width: number,
  height: number,
  bgR: number,
  bgG: number,
  bgB: number,
  x: number,
  y: number,
): Uint8ClampedArray {
  const data = solidFrame(width, height, bgR, bgG, bgB);
  const i = (y * width + x) * 4;
  data[i] = 0;
  data[i + 1] = 255;
  data[i + 2] = 0;
  data[i + 3] = 255;
  return data;
}

test("encodeRgbaGif optimize crops a moving pixel instead of rewriting the frame", () => {
  const size = 48;
  const frames = [];
  for (let i = 0; i < 8; i++) frames.push(frameWithDot(size, size, 255, 0, 0, 2 + i, 2 + i));
  const plain = encodeRgbaGif({
    frames,
    width: size,
    height: size,
    delay: 20,
    maxBytes: 1024 * 1024,
  });
  const optimized = encodeRgbaGif({
    frames,
    width: size,
    height: size,
    delay: 20,
    maxBytes: 1024 * 1024,
    optimize: true,
  });
  assert.notEqual(plain, "too-large");
  assert.notEqual(optimized, "too-large");
  if (plain === "too-large" || optimized === "too-large") return;
  assert.equal(readGifSize(optimized.bytes).magic, "GIF89a");
  assert.equal(optimized.frameCount, 8);
  assert.ok(optimized.bytes.byteLength < plain.bytes.byteLength * 0.5);
});

test("encodeRgbaGif optimize applies maxBytes to the optimized file, not the live stream", () => {
  const frames = [red, red, red, red, red, red, red, red];
  const plain = encodeRgbaGif({
    frames,
    width: WIDTH,
    height: HEIGHT,
    delay: 20,
    maxBytes: 1024 * 1024,
  });
  const optimized = encodeRgbaGif({
    frames,
    width: WIDTH,
    height: HEIGHT,
    delay: 20,
    maxBytes: 1024 * 1024,
    optimize: true,
  });
  assert.notEqual(plain, "too-large");
  assert.notEqual(optimized, "too-large");
  if (plain === "too-large" || optimized === "too-large") return;
  assert.equal(optimized.frameCount, 8);
  assert.ok(optimized.bytes.byteLength < plain.bytes.byteLength);

  const cap = optimized.bytes.byteLength;
  const plainCapped = encodeRgbaGif({
    frames,
    width: WIDTH,
    height: HEIGHT,
    delay: 20,
    maxBytes: cap,
  });
  const optimizedAtCap = encodeRgbaGif({
    frames,
    width: WIDTH,
    height: HEIGHT,
    delay: 20,
    maxBytes: cap,
    optimize: true,
  });
  assert.notEqual(plainCapped, "too-large");
  assert.notEqual(optimizedAtCap, "too-large");
  if (plainCapped === "too-large" || optimizedAtCap === "too-large") return;
  assert.ok(plainCapped.frameCount < 8);
  assert.equal(plainCapped.hitLimit, true);
  assert.equal(optimizedAtCap.frameCount, 8);
  assert.equal(optimizedAtCap.hitLimit, false);
  assert.ok(optimizedAtCap.bytes.byteLength <= cap);
});
