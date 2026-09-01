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
