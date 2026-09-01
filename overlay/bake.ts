import { drawSimpleOverlayText } from "./simple";
import type { CaptureOverlaySettings } from "../settings/panel";

const XHTML_NS = "http://www.w3.org/1999/xhtml";

function wrapOverlayFrame(innerHtml: string, width: number, height: number): string {
  return `<div xmlns="${XHTML_NS}" style="
    position:relative;
    width:${width}px;
    height:${height}px;
    overflow:hidden;
    margin:0;
    padding:0;
    box-sizing:border-box;
    font:16px/normal system-ui,sans-serif;
    color:#000;
  ">${innerHtml}</div>`;
}

function readImageFromSvg(
  svg: string,
  width: number,
  height: number,
): Promise<ImageData | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      requestAnimationFrame(() => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, width, height);
        try {
          resolve(ctx.getImageData(0, 0, width, height));
        } catch (error) {
          console.warn("advanced overlay readback failed:", error);
          resolve(null);
        }
      });
    };
    img.onerror = () => {
      console.warn("advanced overlay SVG load failed");
      resolve(null);
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** Rasterize an XHTML root inside SVG foreignObject. */
export async function rasterizeForeignHtml(
  rootHtml: string,
  width: number,
  height: number,
  outputWidth = width,
  outputHeight = height,
): Promise<ImageData | null> {
  if (width <= 0 || height <= 0 || !rootHtml.trim()) return null;
  const outW = Math.max(1, Math.round(outputWidth));
  const outH = Math.max(1, Math.round(outputHeight));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}" viewBox="0 0 ${width} ${height}">
    <foreignObject width="${width}" height="${height}">${rootHtml}</foreignObject>
  </svg>`;
  return readImageFromSvg(svg, outW, outH);
}

/** Advanced overlay via SVG foreignObject when the live preview host is missing. */
export async function rasterizeAdvancedOverlayHtml(
  innerHtml: string,
  cropWidth: number,
  cropHeight: number,
  outputWidth = cropWidth,
  outputHeight = cropHeight,
): Promise<ImageData | null> {
  if (cropWidth <= 0 || cropHeight <= 0 || !innerHtml.trim()) return null;
  return rasterizeForeignHtml(
    wrapOverlayFrame(innerHtml, cropWidth, cropHeight),
    cropWidth,
    cropHeight,
    outputWidth,
    outputHeight,
  );
}

export function rasterizeSimpleOverlay(
  settings: CaptureOverlaySettings,
  width: number,
  height: number,
): ImageData | null {
  const text = settings.text.trim();
  if (!text || width <= 0 || height <= 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  drawSimpleOverlayText(
    ctx,
    text,
    settings.verticalAlign,
    settings.horizontalAlign,
    settings.fontSize,
    width,
    height,
  );
  return ctx.getImageData(0, 0, width, height);
}
