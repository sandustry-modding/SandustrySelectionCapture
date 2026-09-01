/** Simulation tick duration at 50 UPS — matches GIF frame delay (20 ms). */
export const SIM_MS_PER_TICK = 20;

export function overlayRecordingTimeMs(frameIndex: number): number {
  return frameIndex * SIM_MS_PER_TICK;
}
