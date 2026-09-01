/** GIF encode needs at least this many frames. */
export const GIF_MIN_FRAMES = 2;

export type EncodedGif = {
  bytes: Uint8Array;
  frameCount: number;
  hitLimit: boolean;
  width: number;
  height: number;
};

