/** Simulation tick duration at 50 UPS — matches GIF frame delay (`ticksPerFrame * 20` ms). */
export const SIM_MS_PER_TICK = 20;

export function overlayRecordingTimeMs(frameIndex: number, ticksPerFrame: number): number {
  return frameIndex * ticksPerFrame * SIM_MS_PER_TICK;
}
