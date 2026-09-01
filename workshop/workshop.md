# Pixel-perfect Screenshot and GIF recorder

**Pixel-perfect PNG and GIF of your C selection.**

Share a machine, a line, or a whole scene without a blurry screenshot. **Screenshot** copies or downloads a PNG. **Record GIF** records the live sim and downloads an animation.

## How to use

1. Press **C** and drag a box around the area (or select structures).
2. Keep the selection on screen.
3. Press **F7** to open the panel.
4. **Screenshot** — copy a PNG (paste with Ctrl+V) or download a file (see Options → Mods).
5. **Record GIF** — downloads an animated GIF while the sim keeps running.

Set keys for Screenshot and Record GIF in Options → Controls. The panel shows those keys when bound.

## Features

- Nearest-neighbor upscale — set **PNG upscale** and **GIF upscale** under Options → Mods (1–8×, default 2×)
- GIF of the live sim (2+ frames, no upper frame limit)
- Block padding (0–32) — extra structure blocks around the crop; use 0 for tight, raise when light halos clip
- Greenscreen (#00FF00) for chroma key
- Show mouse — draw the in-game cursor when it is inside the selection
- **Step sim** — optional pause-and-step GIF capture (off by default; the sim keeps running)
- **Optimize GIF** — optional re-encode after capture (shared palette and cropped frame diffs; off by default)
- **GIF countdown** (0–10 s) under Options → Mods before Record GIF starts
- **Capture area** lock — pin the crop for screenshot and GIF; clear C select and keep playing
- Optional 1 MB, 2 MB, 5 MB, or No limit GIF size cap (default 5 MB). The saved GIF stays at or under the cap. With Optimize GIF on, the cap applies after re-encode. No limit keeps every frame.
- **Overlay** — simple caption (text, font size, align) or advanced HTML/CSS with live preview in the capture box
- Orange crop preview for live C select, locked capture area, and countdown; red while recording; blue while encoding
- Panel settings saved between sessions
- Cancel during countdown, GIF capture, or encode
- HUD and marquee handles stay out of the image
- Record GIF exits C select mode when capture starts so you can keep playing during the capture

## Limits

- The crop follows structure footprints when present, otherwise the marquee content; block padding adds extra structure blocks on every side
- Crops align to whole cell pixels
- A selection that is off-screen cannot be captured — pan the camera and try again
- A size cap cannot fit a GIF if two frames already exceed the limit — crop smaller
