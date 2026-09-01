import * as gifencNs from "gifenc";
import type { EncodedGif } from "./gifLimit.ts";

export type { EncodedGif };

/** Keep in sync with `gifLimit.ts`. */
export const GIF_MIN_FRAMES = 2;

const GIF_HEADER_BYTES = 6;
const GIF_TRAILER_BYTES = 1;
const GIF_GCE_BYTES = 8;
const QUANTIZE_FORMAT = "rgb565";
const QUANTIZE_MAX_PIXELS = 400_000;
const OPAQUE_PALETTE_COLORS = 255;
/** GIF disposal: do not dispose (unchanged pixels keep the previous frame). */
const DISPOSE_KEEP = 1;

type GifencApi = {
  GIFEncoder: typeof import("gifenc").GIFEncoder;
  quantize: typeof import("gifenc").quantize;
  applyPalette: typeof import("gifenc").applyPalette;
};

function gifencApi(): GifencApi {
  const ns = gifencNs as Record<string, unknown>;
  const from = (obj: unknown): GifencApi | null => {
    if (!obj || typeof obj !== "object") return null;
    const rec = obj as Record<string, unknown>;
    if (
      typeof rec.GIFEncoder === "function" &&
      typeof rec.quantize === "function" &&
      typeof rec.applyPalette === "function"
    ) {
      return rec as unknown as GifencApi;
    }
    return null;
  };
  const api = from(ns) ?? from(ns.default);
  if (!api) throw new Error("gifenc API missing");
  return api;
}

const { GIFEncoder, quantize, applyPalette } = gifencApi();

export type GifStreamAddResult = {
  accepted: boolean;
  frameCount: number;
  byteLength: number;
};

export type GifStream = {
  readonly width: number;
  readonly height: number;
  addFrame(rgba: Uint8Array | Uint8ClampedArray): GifStreamAddResult;
  finish(): EncodedGif | "too-large";
};

function writeBytesToStream(
  stream: { writeByte: (value: number) => void; writeBytesView?: (bytes: Uint8Array) => void },
  bytes: Uint8Array,
): void {
  if (typeof stream.writeBytesView === "function") {
    stream.writeBytesView(bytes);
    return;
  }
  for (let i = 0; i < bytes.length; i++) stream.writeByte(bytes[i]!);
}

function encodedByteLength(chunks: Uint8Array[]): number {
  let total = GIF_HEADER_BYTES + GIF_TRAILER_BYTES;
  for (const chunk of chunks) total += chunk.byteLength;
  return total;
}

function asRgbaBytes(rgba: Uint8Array | Uint8ClampedArray): Uint8Array {
  if (
    rgba instanceof Uint8Array &&
    rgba.byteOffset === 0 &&
    rgba.byteLength === rgba.buffer.byteLength
  ) {
    return rgba;
  }
  return new Uint8Array(rgba);
}

function copyRgba(rgba: Uint8Array | Uint8ClampedArray): Uint8Array {
  return new Uint8Array(asRgbaBytes(rgba));
}

function sampleRgbaForQuantize(frames: Uint8Array[]): Uint8Array {
  let pixels = 0;
  for (const frame of frames) pixels += Math.floor(frame.byteLength / 4);
  const stride = Math.max(1, Math.ceil(pixels / QUANTIZE_MAX_PIXELS));
  if (stride === 1) {
    const out = new Uint8Array(pixels * 4);
    let offset = 0;
    for (const frame of frames) {
      const length = Math.floor(frame.byteLength / 4) * 4;
      out.set(frame.subarray(0, length), offset);
      offset += length;
    }
    return out;
  }

  const out = new Uint8Array(Math.ceil(pixels / stride) * 4);
  let offset = 0;
  let pixel = 0;
  for (const frame of frames) {
    for (let i = 0; i + 3 < frame.byteLength; i += 4, pixel++) {
      if (pixel % stride !== 0) continue;
      out[offset] = frame[i]!;
      out[offset + 1] = frame[i + 1]!;
      out[offset + 2] = frame[i + 2]!;
      out[offset + 3] = frame[i + 3]!;
      offset += 4;
    }
  }
  return out.subarray(0, offset);
}

type DirtyRect = { x: number; y: number; w: number; h: number };

type GifWriter = ReturnType<typeof GIFEncoder>;

function paletteTable(opaque: import("gifenc").GifPalette): number[][] {
  if (Array.isArray(opaque)) return opaque.slice() as number[][];
  return [];
}

function deltaIndex(previous: Uint8Array, next: Uint8Array, transparentIndex: number): Uint8Array {
  const out = new Uint8Array(next.length);
  for (let i = 0; i < next.length; i++) {
    out[i] = previous[i] === next[i] ? transparentIndex : next[i]!;
  }
  return out;
}

function dirtyRectOf(
  index: Uint8Array,
  width: number,
  height: number,
  transparentIndex: number,
): DirtyRect | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (index[row + x] === transparentIndex) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function cropIndex(index: Uint8Array, width: number, rect: DirtyRect): Uint8Array {
  const out = new Uint8Array(rect.w * rect.h);
  for (let y = 0; y < rect.h; y++) {
    const src = (rect.y + y) * width + rect.x;
    out.set(index.subarray(src, src + rect.w), y * rect.w);
  }
  return out;
}

function writeUInt16(view: Uint8Array, offset: number, value: number): void {
  view[offset] = value & 0xff;
  view[offset + 1] = (value >> 8) & 0xff;
}

/** gifenc always writes the image at (0, 0). Patch the descriptor origin after writeFrame. */
function writeFrameAt(
  gif: GifWriter,
  index: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  opts: Parameters<GifWriter["writeFrame"]>[3],
): void {
  const start = gif.bytesView().byteLength;
  gif.writeFrame(index, width, height, opts);
  if (x === 0 && y === 0) return;
  const view = gif.bytesView();
  const separator = start + GIF_GCE_BYTES;
  if (view[start] !== 0x21 || view[separator] !== 0x2c) {
    throw new Error("GIF frame layout unexpected");
  }
  writeUInt16(view, separator + 1, x);
  writeUInt16(view, separator + 3, y);
}

function encodeOptimizedBytes(
  frames: Uint8Array[],
  width: number,
  height: number,
  delay: number,
): Uint8Array {
  const sample = sampleRgbaForQuantize(frames);
  const opaque = quantize(sample, OPAQUE_PALETTE_COLORS, { format: QUANTIZE_FORMAT });
  const table = paletteTable(opaque);
  const transparentIndex = Math.min(255, table.length);
  table.push([0, 0, 0]);

  const gif = GIFEncoder({ auto: false });
  gif.writeHeader();
  let previous: Uint8Array | null = null;
  for (let i = 0; i < frames.length; i++) {
    const index = applyPalette(frames[i]!, opaque, QUANTIZE_FORMAT);
    if (i === 0 || !previous) {
      gif.writeFrame(index, width, height, {
        palette: table,
        delay,
        dispose: DISPOSE_KEEP,
        repeat: 0,
        first: true,
      });
      previous = index;
      continue;
    }

    const delta = deltaIndex(previous, index, transparentIndex);
    const rect = dirtyRectOf(delta, width, height, transparentIndex);
    if (!rect) {
      writeFrameAt(gif, new Uint8Array([index[0] ?? 0]), 1, 1, 0, 0, {
        delay,
        first: false,
        dispose: DISPOSE_KEEP,
      });
    } else {
      writeFrameAt(gif, cropIndex(delta, width, rect), rect.w, rect.h, rect.x, rect.y, {
        delay,
        first: false,
        transparent: true,
        transparentIndex,
        dispose: DISPOSE_KEEP,
      });
    }
    previous = index;
  }
  gif.finish();
  return gif.bytes();
}

function encodeFrameChunk(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  delay: number,
  first: boolean,
): Uint8Array {
  const pixels = asRgbaBytes(rgba);
  const palette = quantize(pixels, 256, { format: QUANTIZE_FORMAT });
  const index = applyPalette(pixels, palette, QUANTIZE_FORMAT);
  const gif = GIFEncoder({ auto: false });
  gif.writeFrame(index, width, height, {
    palette,
    delay,
    dispose: DISPOSE_KEEP,
    repeat: 0,
    first,
  });
  const view = gif.bytesView();
  return new Uint8Array(view);
}

function assembleGif(chunks: Uint8Array[]): Uint8Array {
  const gif = GIFEncoder({ auto: false });
  gif.writeHeader();
  for (const chunk of chunks) writeBytesToStream(gif.stream, chunk);
  gif.finish();
  return gif.bytes();
}

function shrinkToMaxBytes(
  frames: Uint8Array[],
  width: number,
  height: number,
  delay: number,
  maxBytes: number,
  encode: (kept: Uint8Array[]) => Uint8Array,
): EncodedGif | "too-large" {
  const kept = frames.slice();
  let hitLimit = false;
  let bytes = encode(kept);
  while (bytes.byteLength > maxBytes && kept.length > GIF_MIN_FRAMES) {
    kept.pop();
    hitLimit = true;
    bytes = encode(kept);
  }
  if (bytes.byteLength > maxBytes) return "too-large";
  return {
    bytes,
    frameCount: kept.length,
    hitLimit,
    width,
    height,
  };
}

/**
 * Stream-encode RGBA frames.
 * Without optimize, stops accepting frames that would pass `maxBytes`.
 * With optimize, stores every frame and applies `maxBytes` to the re-encoded file.
 */
export function createGifStream(options: {
  width: number;
  height: number;
  delay: number;
  maxBytes: number;
  /** After capture, re-encode with a shared palette and cropped frame diffs. */
  optimize?: boolean;
}): GifStream {
  const width = Math.max(1, Math.round(options.width));
  const height = Math.max(1, Math.round(options.height));
  const delay = Math.max(1, Math.round(options.delay));
  const maxBytes = Math.max(1, Math.round(options.maxBytes));
  const optimize = options.optimize === true;
  const chunks: Uint8Array[] = [];
  const stored: Uint8Array[] = [];
  let hitLimit = false;

  return {
    width,
    height,
    addFrame(rgba) {
      if (optimize) {
        stored.push(copyRgba(rgba));
        return {
          accepted: true,
          frameCount: stored.length,
          byteLength: stored.length,
        };
      }

      const chunk = encodeFrameChunk(rgba, width, height, delay, chunks.length === 0);
      const nextBytes = encodedByteLength(chunks) + chunk.byteLength;
      if (nextBytes > maxBytes) {
        hitLimit = true;
        return {
          accepted: false,
          frameCount: chunks.length,
          byteLength: encodedByteLength(chunks),
        };
      }
      chunks.push(chunk);
      return {
        accepted: true,
        frameCount: chunks.length,
        byteLength: encodedByteLength(chunks),
      };
    },
    finish() {
      if (optimize) {
        if (stored.length < GIF_MIN_FRAMES) return "too-large";
        const optimized = shrinkToMaxBytes(stored, width, height, delay, maxBytes, (kept) =>
          encodeOptimizedBytes(kept, width, height, delay),
        );
        if (optimized === "too-large") return "too-large";
        console.log("GIF optimize", {
          frames: stored.length,
          kept: optimized.frameCount,
          bytes: optimized.bytes.byteLength,
          hitLimit: optimized.hitLimit,
        });
        return optimized;
      }

      if (chunks.length < GIF_MIN_FRAMES) return "too-large";
      let bytes = assembleGif(chunks);
      while (bytes.byteLength > maxBytes && chunks.length > GIF_MIN_FRAMES) {
        chunks.pop();
        hitLimit = true;
        bytes = assembleGif(chunks);
      }
      if (bytes.byteLength > maxBytes) return "too-large";
      return {
        bytes,
        frameCount: chunks.length,
        hitLimit,
        width,
        height,
      };
    },
  };
}

/** Encode every frame in one pass (unit tests and worker finish path). */
export function encodeRgbaGif(options: {
  frames: Array<Uint8Array | Uint8ClampedArray>;
  width: number;
  height: number;
  delay: number;
  maxBytes: number;
  optimize?: boolean;
}): EncodedGif | "too-large" {
  const stream = createGifStream(options);
  for (const frame of options.frames) {
    const result = stream.addFrame(frame);
    if (!result.accepted) break;
  }
  return stream.finish();
}
