import type { CellBounds } from "../selection/bounds";
import type { CaptureLook } from "./types";

/**
 * Copy the selection crop as a 1× canvas.
 * Replace this with the new capture path.
 */
export async function grabSelectionFrame(
  _api: SandkitApi,
  _bounds: CellBounds,
  _look: CaptureLook,
): Promise<HTMLCanvasElement | null> {
  return null;
}
