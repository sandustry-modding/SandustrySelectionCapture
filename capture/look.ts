import { getSession, type SessionPixi } from "../game/session";
import type { CaptureLook } from "./types";

type VisibleNode = { visible?: boolean; parent?: { filters?: unknown[] | null } };

/** Sky fill when the WebGL backdrop cannot be sampled. */
export const FALLBACK_SKY = "#3d6b78";

/** Chroma-key fill when **Greenscreen** is on. */
export const GREENSCREEN = "#00ff00";

function backgroundNodes(pixi: SessionPixi): VisibleNode[] {
  const nodes: VisibleNode[] = [];
  for (const node of [
    pixi.mountainsSprite,
    pixi.treesSmallSprite,
    pixi.treesSprite,
    pixi.bgL04Sprite,
    pixi.bgL04Extension,
    pixi.edgeMist?.sprite,
  ]) {
    if (node) nodes.push(node);
  }
  return nodes;
}

/**
 * Hide parallax + sky shader for a chroma-key fill.
 * Call the returned function to restore.
 */
export function applyCaptureLook(look: CaptureLook): () => void {
  const restores: Array<() => void> = [];

  if (look.greenscreen) {
    const pixi = getSession()?.rendering?.pixi;
    const previousBody = document.body.style.backgroundColor;
    if (pixi) {
      const nodes = backgroundNodes(pixi);
      const visibility = nodes.map((node) => node.visible !== false);
      const layer = pixi.mountainsSprite?.parent;
      const previousFilters = layer?.filters ?? null;
      for (const node of nodes) node.visible = false;
      pixi.toggleSkyFilter?.(false);
      restores.push(() => {
        nodes.forEach((node, i) => {
          node.visible = visibility[i];
        });
        if (layer) layer.filters = previousFilters;
        else pixi.toggleSkyFilter?.(previousFilters != null && previousFilters.length > 0);
      });
    }
    document.body.style.backgroundColor = GREENSCREEN;
    restores.push(() => {
      document.body.style.backgroundColor = previousBody;
    });
  }

  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    for (let i = restores.length - 1; i >= 0; i--) restores[i]();
  };
}
