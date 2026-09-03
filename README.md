# Screenshot and GIF recorder

Workshop: [Screenshot and GIF recorder](https://steamcommunity.com/sharedfiles/filedetails/?id=3787806696).

Pixel-perfect PNG and GIF of your **C** selection.

Share a machine, a line, or a whole scene without a blurry screenshot. **Screenshot** copies a nearest-neighbor PNG. **Record GIF** records the live sim and downloads an animation.

## Use

1. Press **C** and drag a box around the area (or select structures).
2. Keep the selection on screen.
3. Press **F7**. Drag the title bar to move the panel; drag the bottom-right corner to resize.
4. Choose **Screenshot** or **Record GIF**. Optional: **Lock** capture area first so you can clear **C** select and still capture that box.

- **F7** — open or close the panel (title-bar ✕ also closes)
- **Screenshot** — copy a PNG; paste with **Ctrl+V** (or download — see **Options → Mods**)
- **Record GIF** — record an animated GIF while the sim runs; the `.gif` downloads

Set keys for **Screenshot** and **Record GIF** in Options → Controls. The panel buttons show those keys when bound.

## Panel

- **Frames** — minimum 2 (default 60). No upper limit.
- **Block padding** — 0–32 (default 1). Extra structure blocks around the crop. Use **0** for a tight crop. Raise it when light halos clip.
- **Greenscreen** — on/off (default off)
- **Show mouse** — on/off (default off)
- **Step sim** — off (default) records while the sim runs. On pauses and steps one tick per frame.
- **Optimize GIF** — off (default). On re-encodes after capture: one shared palette, and later frames store only the rectangle of pixels that changed.
- **GIF size limit** — **1 MB**, **2 MB**, **5 MB**, or **No limit** (default **5 MB**). The saved GIF stays at or under this size. With **Optimize GIF** on, Record GIF captures every requested frame, then drops frames from the end after re-encode if needed. Without it, recording stops when the next live frame would pass the cap. **No limit** keeps every frame.
- **Overlay** — optional caption on PNG/GIF. Simple mode: text, font size, vertical and horizontal align. Advanced mode: custom HTML/CSS with a live animated preview in the capture box (PNG/GIF freeze the current frame). Overlay is drawn after upscale.

Panel settings are saved between sessions.

**GIF countdown** — 0–10 seconds before Record GIF starts (default 3). Set under **Options → Mods**. **0** starts at once. Cancel works during the count.

**Download PNG** — under **Options → Mods**, save a PNG file instead of copying to the clipboard. The panel button switches between **Copy PNG** and **Download PNG**.

**PNG upscale** and **GIF upscale** — under **Options → Mods**, nearest-neighbor upscale after capture (1–8, default 2). Separate settings for screenshot and GIF.

While the panel is open, an **orange** outline shows the live **C** selection and a locked capture area. During GIF capture the outline turns **red**; during encode it turns **blue**. The countdown stays **orange**. Close the panel (F7) to hide all outlines.

**Greenscreen** hides the parallax sky and fills empty pixels with `#00FF00` for chroma key.

**Show mouse** draws the in-game cursor into the PNG or GIF when the pointer tip is inside the selection.

**GIF size limit** keeps the saved file at or under **1 MB**, **2 MB**, or **5 MB** (default **5 MB**). **No limit** (last in the list) keeps every frame. Without **Optimize GIF**, each prefix encodes while you record and capture **stops** when the next frame would pass the cap. With **Optimize GIF** on, capture uses your **Frames** count; the cap applies to the re-encoded file and extra frames drop from the end. Use **1 MB** for Steam Workshop thumbnails. If even two frames are over the cap, crop a smaller box.

**Screenshot** and **Record GIF** both use a locked capture area when one is set; otherwise they use the live **C** selection. **Record GIF** waits for the **Countdown**, then captures one frame per sim tick. With **Step sim** off, the sim keeps running. With **Step sim** on, the sim pauses on each painted frame. Use **Capture area** to pin the crop from your current **C** selection — you can clear select and keep building while the panel stays open and the orange outline shows. Changing **Block padding** while locked updates that outline and the next capture crop. Without **Optimize GIF**, each frame encodes while you record so capture can stop at the size cap. With **Optimize GIF** on, re-encode runs after capture and the size cap applies to that file. Set **PNG upscale** / **GIF upscale** under **Options → Mods** (default 2×). Overlay text is drawn after upscale. The file downloads. The row shows the countdown, then **Recording…**. The button is **Cancel** in all of those cases.

**Record GIF** exits **C** select mode when recording starts (clears the selection and restores the normal cursor) so you can keep building. The crop stays the box you selected. Select mode is not restored when the GIF finishes.

## Limits

- The crop follows selected structure footprints when present, otherwise the marquee content. **Block padding** adds extra structure blocks on every side. Crops align to whole cell pixels.
- Overlay chrome (handles, HUD) is not in the image. Signal wires and structure hover highlights on the overlay canvas are included.
- A selection that is off-screen cannot be captured. Pan the camera and try again.

## Workshop

This mod is published on the Steam Workshop: [Pixel-perfect Screenshot and GIF recorder](https://steamcommunity.com/sharedfiles/filedetails/?id=3787806696).

This mod has its own `package.json`. After a clone, run `npm install` in this folder (root `npm install` does not).

`npm run publish` uploads from `build/` with [`workshop.json`](workshop/workshop.json) and **preview.gif** (or **preview.png**). It uses a dedicated [SteamCMD](https://developer.valvesoftware.com/wiki/SteamCMD) cache. [`workshop.md`](workshop/workshop.md) supplies the Steam description. `README.md`, `CHANGELOG.md`, and [`screenshots/`](workshop/screenshots/) stay in the repo. Change notes for Steam come from `CHANGELOG.md` at upload time.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
