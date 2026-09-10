# BBCraft 3

A very simplified fork of [bb](https://getbb.app/), dressed up like the classic Warcraft III menus. It uses bb's real agents, projects, conversations, and local backend.

**This does not support all of bb's features.** It's a small, experimental interface with plenty missing and probably some rough edges. Good luck.

[![BBCraft 3 demo: select an agent, start a quest-log conversation, and watch live responses](docs/media/bbcraft-demo.gif)](docs/media/bbcraft-demo.mp4)

[Watch / download the recording (MP4)](https://github.com/jjcm/bbcraft/raw/refs/heads/main/docs/media/bbcraft-demo.mp4). The recording shows the chained Agents window, a new conversation asking for a Warcraft 3 quest log, and live agent responses.

## What works

- Start conversations, send follow-ups, read replies, and stop an agent.
- Choose an available agent and a project; register an existing project folder.
- Browse project files and respond to ordinary approval or question requests.
- Enjoy painted metalwork, animated chains, and cursor-driven material lighting.

The editor is a fixed **1920 × 1088** scene that scales to fit the browser. Agents, Projects, and Settings use full-width windows. Settings also offers actual-size rendering and a lighting toggle.

The full bb shell, split workspaces, terminals, plugin panels, worktree management UI, and advanced provider settings are absent. Conversations are limited to the latest 100 root tasks, and timelines to the latest 100 segments. The underlying bb APIs and CLI are still in the repository.

## Run locally

Use Node.js **22.19+** and **pnpm 9.15.0**, with an installed and authenticated agent provider such as Codex or Claude Code.

```sh
git clone https://github.com/jjcm/bbcraft.git
cd bbcraft
pnpm install --frozen-lockfile
pnpm dev
```

Open the app URL printed by the dev launcher. It starts the web app, bb server, and local host daemon with checkout-specific ports and development data. Choose an agent and project before sending a prompt.

A new conversation follows the project's environment settings. Worktree creation and project setup scripts can take a minute or more; “Workspace setup progress” exposes the setup output. Follow-ups reuse the existing workspace.

## Design

We used [Diffui](https://diffui.ai/) for the designs and generated artwork, including transparent window layers, icons, and matching normal, height/depth, and roughness maps. WebGL applies dynamic lighting to those assets.

[View the original Diffui design file](docs/design/agentic-development-interface.png). The reference is included here for easy viewing; runtime artwork was generated separately.

See [WARCRAFT.md](WARCRAFT.md) for the implementation, asset-generation scripts, and verification commands.

## Development

```sh
pnpm exec turbo run typecheck build lint --filter=@bb/app
pnpm exec turbo run test --filter=@bb/app -- WarcraftApp
```

The fork's GitHub workflow checks this interface. Upstream release and deployment workflows are preserved in `.github/upstream-workflows/` as reference files.

Built on [get-bb/bb](https://github.com/get-bb/bb). The original [MIT license](LICENSE) is preserved.
