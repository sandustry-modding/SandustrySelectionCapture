import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { GIF_MIN_FRAMES, type EncodedGif } from "./gifLimit";

export { GIF_MIN_FRAMES };
export type { EncodedGif };

const GIF_HEADER_BYTES = 6;
const GIF_TRAILER_BYTES = 1;

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

function encodeFrameChunk(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  delay: number,
  first: boolean,
): Uint8Array {
  const pixels = asRgbaBytes(rgba);
  const palette = quantize(pixels, 256, { format: "rgb565" });
  const index = applyPalette(pixels, palette, "rgb565");
  const gif = GIFEncoder({ auto: false });
  gif.writeFrame(index, width, height, {
    palette,
    delay,
    dispose: 1,
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

/** Stream-encode RGBA frames. Stops accepting frames that would pass `maxBytes`. */
export function createGifStream(options: {
  width: number;
  height: number;
  delay: number;
  maxBytes: number;
}): GifStream {
  const width = Math.max(1, Math.round(options.width));
  const height = Math.max(1, Math.round(options.height));
  const delay = Math.max(1, Math.round(options.delay));
  const maxBytes = Math.max(1, Math.round(options.maxBytes));
  const chunks: Uint8Array[] = [];
  let hitLimit = false;

  return {
    width,
    height,
    addFrame(rgba) {
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
}): EncodedGif | "too-large" {
  const stream = createGifStream(options);
  for (const frame of options.frames) {
    const result = stream.addFrame(frame);
    if (!result.accepted) break;
  }
  return stream.finish();
}
