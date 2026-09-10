# BBCraft 3 · Warcraft Edition

A simplified interface backed by [bb](https://github.com/get-bb/bb), published as [jjcm/bbcraft](https://github.com/jjcm/bbcraft). The frontend follows the supplied Warcraft III menu design and calls bb's existing browser SDK. The server, local daemon, providers, database, and CLI remain upstream bb.

## Run

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the URL printed by the launcher. Ports and development data directories are isolated per checkout.

## Interface

The scene is exactly **1920 × 1088** CSS pixels. The header, windows, controls, and artwork have fixed positions. By default the scene scales uniformly to fit the browser. Settings → Fit window can be disabled to show actual size with scrolling. There is no responsive panel reflow, resizing, tiling, or nine-slice artwork in this interface.

- **New Task / New Chat:** start a conversation in the chosen project with the chosen agent.
- **Conversations:** select real bb tasks, retaining separate unsent drafts.
- **Agents:** choose an available provider for a new conversation in a full-width window.
- **Projects:** select a project or register an existing folder on a paired machine in a full-width window.
- **Chat:** send prompts, read Markdown replies, follow progress, stop work, and answer ordinary approval or question requests. Enter sends; Shift+Enter inserts a newline. Failed sends retain the draft.
- **View Files:** search project files and read text files in the task's actual workspace.
- **Settings:** toggle lighting, choose fit or actual size, and replay the window entrance in a full-width window. Agents, Projects, and Settings have no conversation sidebar and return to the current chat without losing its draft.

This is deliberately a small UI. The full bb shell, workspace splits, terminals, plugin panels, worktree management, and advanced provider settings are not mounted. Their APIs and CLI remain available. Plugin-specific interaction controls require the CLI or provider's own interface. Conversation listing is capped at 100 root tasks; the timeline requests the latest 100 segments.

## Artwork and lighting

Diffui generated a new **1920 × 1088 artwork plate**, directly guided by the reference, with text, message content, and pictograms cleared for live HTML. Its two conversation windows are separate alpha layers. A further Diffui generation supplies a full-width menu window and a clean header with an uninterrupted bottom rail. Chains pass behind the stationary header. The moving layers are clipped at the header's lower edge, with an opening for the exposed upper-right chain. That chain is excluded from the stationary header asset and moves with the conversation or menu window, including its anchor.

Windows descend vertically using a sampled damped spring: 620 ms, frequency 24, damping ratio 0.86, and approximately 6 px of overshoot. There is no window rotation. The right conversation window starts 40 ms after the left. Opening a menu or returning to chat replays the relevant window entrance. The supplied [Warcraft III recording](https://www.youtube.com/watch?v=XvxYTaz-77c) was inspected frame by frame as a motion reference.

A separate generation provides **12 painted icons**. All artwork generations have matching normal, height, and roughness maps. The preparation script extracts the generated layers and icons with matching map coordinates. The original design is only a reference; no design screenshot or design crop is shipped as artwork.

`ClassicArt.tsx` and `lighting.ts` apply cursor-driven WebGL2 lighting to the fixed artwork layers. Pointer coordinates account for scene scaling. Normal relief, subtle height parallax, warm highlights, cool fill, and roughness-dependent shine follow the sibling tarot implementation. Drawing stops after the cursor settles and pauses when the document is hidden. Reduced motion removes entrance motion and parallax. Local image fallbacks work without WebGL.

Runtime assets are in `apps/app/public/warcraft`; `classic-*-manifest.json` files document coordinates. Earlier reusable assets remain available for future variations. Raw generation receipts and source images live in gitignored `.diffui/`.

To regenerate with a valid Diffui build markdown:

```sh
python3 scripts/warcraft/generate-classic.py /path/to/build.md
python3 scripts/warcraft/generate-classic.py /path/to/build.md icons
python3 scripts/warcraft/generate-classic.py /path/to/build.md menu
node scripts/warcraft/prepare-classic.mjs
```

## Code and verification

`main.tsx` mounts `components/warcraft/WarcraftApp.tsx` directly. It does not mount or restyle bb's original `AppLayout`. `ClassicPanels.tsx` contains the small agent, project, file, and decision views. Product actions use the existing `sdk.projects`, `sdk.providers`, `sdk.hosts`, and `sdk.threads` surfaces. The same actions remain available through `pnpm bb:dev`.

```sh
pnpm exec turbo run typecheck build lint --filter=@bb/app
pnpm exec turbo run test --filter=@bb/app -- WarcraftApp
```

Build, lint, type checking, and four interface tests pass. Tests cover failed-send draft retention, independent conversation drafts, sidebar-free menu navigation and return, and correct project/provider selection on creation, and response/status refresh after workspace setup completes in a background tab. Browser checks confirmed the 1920 × 1088 stage, full-width Agents/Projects/Settings windows, active GPU lighting, menu scrolling, the vertical spring timing, agent and project controls, project file reading, and task creation. A real “Implement Quest System” task was submitted through the new composer and completed through Codex.

Task status, conversation lists, replies, and pending interactions keep polling in background tabs and refresh on focus. Workspace setup output is available while starting, and backend timeline errors are surfaced. New worktree tasks can run project setup scripts before the provider starts; follow-ups reuse the prepared workspace.
