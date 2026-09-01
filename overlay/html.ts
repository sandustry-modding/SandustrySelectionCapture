/** Starter markup for advanced mode. CSS animations run in the live preview. */
export const DEFAULT_ADVANCED_OVERLAY_HTML = `<style>
  @keyframes pixel-blink {
    0%, 49% { opacity: 1; }
    50%, 100% { opacity: 0; }
  }

  @keyframes sand-flow {
    0% { transform: translateY(-4px); opacity: 0; }
    50% { opacity: 1; }
    100% { transform: translateY(6px); opacity: 0; }
  }

  @keyframes alert-bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-2px); }
  }

  @property --sand {
    syntax: "<integer>";
    initial-value: 980;
    inherits: false;
  }

  @keyframes sand-count {
    from { --sand: 980; }
    to { --sand: 1420; }
  }

  .sand-hud {
    position: absolute;
    inset: 0;
    pointer-events: none;
    font-family: monospace;
    font-size: 11px;
    color: #e0e0e0;
    image-rendering: pixelated;
    box-sizing: border-box;
    padding: 10px;
  }

  /* Top Left: Sand Counter */
  .hud-top {
    position: absolute;
    top: 10px;
    left: 10px;
  }

  .hud-badge {
    background: #181824;
    border: 2px solid #3b3b4f;
    padding: 4px 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 2px 2px 0px #000;
  }

  .sand-stream {
    position: relative;
    width: 6px;
    height: 10px;
    background: #2a2a3d;
    overflow: hidden;
  }

  .sand-grain {
    position: absolute;
    left: 2px;
    width: 2px;
    height: 2px;
    background: #ffaa00;
    animation: sand-flow 0.8s steps(4) infinite;
  }
  .sand-grain:nth-child(2) { animation-delay: 0.4s; }

  .stat-label { color: #8888a0; }
  .stat-val {
    color: #ffffff;
    font-weight: bold;
    min-width: 4ch;
    animation: sand-count 14s linear infinite alternate;
    counter-reset: sand var(--sand);
  }
  .stat-val::after { content: counter(sand); }

  /* Bottom Right: Warning */
  .hud-bottom {
    position: absolute;
    bottom: 10px;
    right: 10px;
  }

  .warning-bar {
    background: #2a1515;
    border: 2px solid #ff3c3c;
    color: #ff5555;
    padding: 4px 8px;
    font-size: 10px;
    font-weight: bold;
    box-shadow: 2px 2px 0px #000;
    animation: alert-bounce 0.6s steps(2) infinite;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .alert-dot {
    width: 4px;
    height: 4px;
    background: #ff3c3c;
    animation: pixel-blink 0.4s steps(1) infinite;
  }
</style>

<div class="sand-hud">
  <div class="hud-top">
    <div class="hud-badge">
      <div class="sand-stream">
        <div class="sand-grain"></div>
        <div class="sand-grain"></div>
      </div>
      <span class="stat-label">SAND:</span>
      <span class="stat-val"></span>
    </div>
  </div>

  <div class="hud-bottom">
    <div class="warning-bar">
      <div class="alert-dot"></div>
      <span>OVERFLOW WARNING</span>
    </div>
  </div>
</div>`;

/** position:relative frame for advanced overlay HTML. */
export function buildAdvancedOverlayFrameHtml(
  innerHtml: string,
  width: number,
  height: number,
): string {
  return `<div style="
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
