declare module "gifenc" {
  export type GifPalette = number[][] | Uint8Array;

  export function GIFEncoder(opts?: { auto?: boolean }): {
    writeHeader(): void;
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: GifPalette;
        delay?: number;
        repeat?: number;
        first?: boolean;
        transparent?: boolean;
        transparentIndex?: number;
        dispose?: number;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    stream: {
      writeByte: (value: number) => void;
      writeBytesView?: (bytes: Uint8Array) => void;
    };
  };

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: string },
  ): GifPalette;

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: GifPalette,
    format?: string,
  ): Uint8Array;
}

declare module "*?worker-text" {
  const source: string;
  export default source;
}
