# Screenshot / GIF recorder panel

Floating overlay (not a Debug tab). A11y title **Screenshot and GIF recorder** (matches `modinfo.name`). **F7** toggles the panel; title-bar ✕ also closes. Panel can sit over the HUD during play.

## Selection

**C** — drag a cell marquee for the crop. Optional **Block padding** (−32–32, default 1) expands the box in cell units. **Capture area → Lock** pins the crop so you can clear **C** select and keep playing; **Clear** drops the lock.

## Panel controls

| Control        | Notes                                                                              |
| -------------- | ---------------------------------------------------------------------------------- |
| Frames         | spinbutton, min 2, default **60**                                                  |
| Ticks / frame  | 1–30, default **1**                                                                |
| Block padding  | −32–32 cell margin, default **1**                                                  |
| Greenscreen    | toggle                                                                             |
| Show mouse     | toggle (default **off**)                                                           |
| GIF size limit | **1 MB** / **2 MB** / **5 MB** / **No limit**, default **5 MB**. Cap options stop recording at that size |
| Overlay        | optional caption (simple text or advanced HTML/CSS)                                |
| Capture area   | **Lock** / **Clear** locked crop                                                   |
| Record GIF     | button; rebind under Options → Controls (category **Screenshot and GIF recorder**) |
| Screenshot     | **Copy PNG** or **Download PNG** (see Options → Mods)                              |

## Options → Mods

| Setting       | Notes                                   |
| ------------- | --------------------------------------- |
| GIF countdown | 0–10 s before GIF start (default **3**) |
| Download PNG  | off = clipboard; on = file download     |
| PNG upscale   | 1–8× nearest-neighbor (default **1**)   |
| GIF upscale   | 1–8× nearest-neighbor (default **1**)   |

## Toasts and outlines

- Large GIF crop — too large for 60 fps (over 1280×720 encoded px after upscale).
- While the panel is open: **orange** outline for live **C** selection or locked area; **red** while recording; **blue** while encoding.

Do not click **Record** or change capture settings unless the user asked (starts capture / countdown).
