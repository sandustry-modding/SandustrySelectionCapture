import type { CaptureOverlaySettings } from "../settings/panel";
import type { ScreenRect } from "../selection/screenRect";

function clampAlignPercent(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function escapeOverlayText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Inner HTML for the position:relative overlay frame (simple mode). */
export function buildSimpleOverlayHtml(
  text: string,
  verticalAlign: number,
  horizontalAlign: number,
  fontSize: number,
): string {
  const y = clampAlignPercent(verticalAlign, 88);
  const x = clampAlignPercent(horizontalAlign, 0);
  const escaped = escapeOverlayText(text);
  return `<div style="position:absolute;inset:0;pointer-events:none;">
  <div style="
    position:absolute;
    left:${x}%;
    top:${y}%;
    transform:translate(-${x}%, -${y}%);
    max-width:100%;
    color:#fff;
    font:600 ${fontSize}px/1.2 system-ui,-apple-system,sans-serif;
    text-shadow:-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000;
    white-space:pre-wrap;
    word-break:break-word;
  ">${escaped}</div>
</div>`;
}

export function resolveOverlayInnerHtml(settings: CaptureOverlaySettings): string | null {
  if (!settings.enabled) return null;
  if (settings.advanced) {
    const html = settings.html.trim();
    return html || null;
  }
  const text = settings.text.trim();
  if (!text) return null;
  return buildSimpleOverlayHtml(
    text,
    settings.verticalAlign,
    settings.horizontalAlign,
    settings.fontSize,
  );
}

function simpleFont(fontSize: number): string {
  return `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
}

function simpleLineHeight(fontSize: number): number {
  return fontSize * 1.2;
}

function wrapOverlayLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = words[0]!;
    for (let i = 1; i < words.length; i++) {
      const next = `${current} ${words[i]!}`;
      if (ctx.measureText(next).width <= maxWidth) {
        current = next;
      } else {
        lines.push(current);
        current = words[i]!;
      }
    }
    lines.push(current);
  }
  return lines.length > 0 ? lines : [""];
}

export function drawSimpleOverlayText(
  ctx: CanvasRenderingContext2D,
  text: string,
  verticalAlign: number,
  horizontalAlign: number,
  fontSize: number,
  width: number,
  height: number,
): void {
  const vPct = clampAlignPercent(verticalAlign, 88) / 100;
  const hPct = clampAlignPercent(horizontalAlign, 0) / 100;
  const maxTextWidth = Math.max(1, width);
  const font = simpleFont(fontSize);
  ctx.font = font;
  const lines = wrapOverlayLines(ctx, text, maxTextWidth);
  const lineHeight = simpleLineHeight(fontSize);
  const textHeight = lines.length * lineHeight;
  const blockTop = Math.round(vPct * Math.max(0, height - textHeight));

  ctx.font = font;
  ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(2, Math.round(fontSize / 10));
  ctx.strokeStyle = "#000000";
  ctx.fillStyle = "#ffffff";

  let textY = blockTop;
  for (const line of lines) {
    const lineWidth = ctx.measureText(line).width;
    const textX = Math.round(hPct * Math.max(0, width - lineWidth));
    ctx.strokeText(line, textX, textY);
    ctx.fillText(line, textX, textY);
    textY += lineHeight;
  }
}

/** Draw simple caption on the overlay canvas. */
export function drawSimpleOverlayInScreenRect(
  ctx: CanvasRenderingContext2D,
  settings: CaptureOverlaySettings,
  rect: ScreenRect,
): void {
  if (!settings.enabled || settings.advanced) return;
  const text = settings.text.trim();
  if (!text || rect.width <= 0 || rect.height <= 0) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.width, rect.height);
  ctx.clip();
  ctx.translate(rect.x, rect.y);
  drawSimpleOverlayText(
    ctx,
    text,
    settings.verticalAlign,
    settings.horizontalAlign,
    settings.fontSize,
    rect.width,
    rect.height,
  );
  ctx.restore();
}
