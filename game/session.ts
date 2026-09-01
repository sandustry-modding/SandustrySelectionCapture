type VisibleNode = { visible?: boolean; parent?: { filters?: unknown[] | null } };

export type SessionPixi = {
  app?: {
    canvas?: HTMLCanvasElement;
    view?: HTMLCanvasElement;
    renderer?: {
      events?: {
        cursorStyles?: { default?: string };
        currentCursor?: string;
        setCursor?: (cursor: string) => void;
      };
    };
  };
  cursors?: {
    default?: string;
    marquee?: string;
    demolish?: string;
  };
  mountainsSprite?: VisibleNode;
  treesSmallSprite?: VisibleNode;
  treesSprite?: VisibleNode;
  bgL04Sprite?: VisibleNode;
  bgL04Extension?: VisibleNode;
  edgeMist?: { sprite?: VisibleNode };
  toggleSkyFilter?: (enabled: boolean) => void;
};

export type SessionRendering = {
  canvas?: HTMLCanvasElement;
  overlayCanvas?: HTMLCanvasElement;
  overlayContext?: CanvasRenderingContext2D;
  pixi?: SessionPixi;
};

export type SessionShape = {
  paused?: boolean;
  settings?: { cursorScale?: number };
  input?: {
    mouse?: {
      position?: { x?: number; y?: number };
      available?: boolean;
    };
  };
  rendering?: SessionRendering;
};

export function getSession(): SessionShape | null {
  const session = sandkit.state.session as SessionShape | null | undefined;
  return session ?? null;
}

export function getGameCanvas(): HTMLCanvasElement | null {
  const rendering = getSession()?.rendering;
  return rendering?.canvas ?? rendering?.pixi?.app?.canvas ?? rendering?.pixi?.app?.view ?? null;
}

export function getOverlayCanvas(): HTMLCanvasElement | null {
  const overlay = getSession()?.rendering?.overlayCanvas;
  if (!overlay || overlay.width <= 0 || overlay.height <= 0) return null;
  return overlay;
}
