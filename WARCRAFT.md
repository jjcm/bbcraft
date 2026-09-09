# bb · Warcraft Edition

A working source fork of [bb](https://github.com/get-bb/bb), on the `warcraft-classic` branch. The React app has classic Warcraft III menu styling; the server, local host daemon, provider integrations, CLI, plugin system, and database contracts remain upstream bb.

## Run

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Use the App URL printed at startup. bb derives the ports and development data directory from the checkout, so this fork has a separate database from your installed bb. For this checkout the app is at `http://localhost:16164`, with data under `~/.bb-dev/code-demobuild-bb-warcraft-b1141c2cee7f`.

The header's New Task button uses bb's existing `thread.new` command. Agents and Projects open their existing settings pages. Settings uses the existing `settings.open` command. The sidebar toggle, shortcuts, project creation, provider pickers, message composer, file panels, and terminals retain their normal behavior.

The same operations remain available through `pnpm bb:dev`, including `project create`, `provider list`, `thread spawn`, `thread send`, and `terminal`. Existing provider sign-in is used by the local daemon.

## Artwork and lighting

`apps/app/public/warcraft` contains 13 generated artwork/material assets and 36 generated normal, height, and roughness maps. Eleven assets have native transparency. All artwork was generated through Diffui. The design reference is a specification, and is not used as a screenshot background.

`components/warcraft/WarcraftArt.tsx` assembles the header, chains, iron frames, corner ornaments, menu icons, and crest. `lighting.ts` uses WebGL2 to relight them with a pointer-following warm key light, cool fill, normal relief, roughness-dependent highlights, and small height parallax. Nine-slice rendering keeps frame corners intact when the sidebar or content panel changes size. The approach follows the sibling `tarot` project's lighting.

Each scene releases GPU textures, buffers, and programs on unmount. Drawing is capped around 30 fps, stops after the pointer settles, and pauses when the document is hidden. Reduced-motion preference removes the entrance animation and parallax. CSS/image fallbacks remain available if WebGL or a texture fails.

The two main windows descend from above, overshoot, and settle on their chains. The horizontal header stays in place. Compact layouts retain bb's existing persistent sidebar drawer and a horizontal command bar.

`manifest.json` records original dimensions, alpha coverage, map types, and matching crop bounds. Diffuse images and their maps are cropped together so lighting stays registered. Original downloads and generation receipts are kept in gitignored `.diffui/`.

To regenerate assets, obtain a fresh Diffui build markdown with a valid build token, then run:

```sh
python3 scripts/warcraft/generate-assets.py /path/to/build.md
node scripts/warcraft/prepare-assets.mjs
```

Pass asset names after the markdown path to recover individual assets. Requests resume from their generation receipts. The shipped frontend contains only local asset URLs.

## Verification

```sh
pnpm exec turbo run typecheck build lint --filter=@bb/app
pnpm exec turbo run test --filter=@bb/app -- AppLayout ui/sidebar.test.tsx
```

Production build, lint, type checking, and 60 targeted tests passed. The fork's development server and daemon were checked through the real bb CLI. A Codex task was created in the local `bb Warcraft` project, completed, and displayed its response in the browser. Browser checks also cover the menu routes, local project picker, hanging panels, active GPU lighting, and compact sidebar behavior.
