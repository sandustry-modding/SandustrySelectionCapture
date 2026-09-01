---
name: selection-capture
description: "Use when working on irishbruse.selection-capture (Screenshot and GIF recorder): F7 panel, C marquee, PNG clipboard, GIF record, overlay, Options → Mods settings."
---

# Selection capture

Mod id **irishbruse.selection-capture**. Player docs: `README.md`, `CHANGELOG.md`.

PNG/GIF pixel grab is not implemented. Fill in `capture/grab.ts`, then encode in `capture/gif.ts`.

## Read

| Branch                                    | File                                       |
| ----------------------------------------- | ------------------------------------------ |
| F7 panel labels, hotkeys, MCP click rules | [references/panel.md](references/panel.md) |
| C marquee cell AABB                       | `selection/bounds.ts`                      |
| Crop outline + live overlay preview       | `preview/crop.ts`                          |
| Frame grab hook                           | `capture/grab.ts`                          |
| PNG copy/download                         | `capture/png.ts`                           |
| GIF tick loop + encode hook               | `capture/gif.ts`                           |
| Panel settings                            | `settings/panel.ts`                        |

Live session: **sandustry-mcp**. Do not kill Sandustry. Ask the user for a hard reload after code changes.

Do not click **Record** or change capture settings unless the user asked (starts capture / countdown).
