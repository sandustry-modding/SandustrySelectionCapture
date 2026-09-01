---
name: selection-capture
description: "Use when working on irishbruse.selection-capture (Screenshot and GIF recorder): F7 panel, C marquee, PNG clipboard, GIF record, overlay, Options → Mods settings."
---

# Selection capture

Mod id **irishbruse.selection-capture**. Player docs: `README.md`, `CHANGELOG.md`.

PNG/GIF grab copies WebGL + dynamic2D + overlay canvas on the microtask after `frame:render`. Crop outlines are DOM (orange idle, red recording, blue encoding) so they stay visible during grab. GIF encodes each frame in a gifenc worker and stops at the size cap.

## Read

| Branch                                    | File                                       |
| ----------------------------------------- | ------------------------------------------ |
| F7 panel labels, hotkeys, MCP click rules | [references/panel.md](references/panel.md) |
| C marquee cell AABB                       | `selection/bounds.ts`                      |
| Crop outline + live overlay preview       | `preview/crop.ts`                          |
| Frame grab (paint + crop)                 | `capture/grab.ts`                          |
| PNG copy/download                         | `capture/png.ts`                           |
| GIF tick loop + worker encode             | `capture/gif.ts`                           |
| Encoder (Node unit tests)                 | `capture/encodeCore.ts`                    |
| Panel settings                            | `settings/panel.ts`                        |

Live session: **sandustry-mcp**. Do not kill Sandustry. Ask the user for a hard reload after code changes.

Do not click **Record** or change capture settings unless the user asked (starts capture / countdown). Integration tests use `irishbruse.selection-capture:test` (`hook.ts`), not the Record button.
