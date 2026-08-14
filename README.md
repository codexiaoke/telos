# Telos

Telos is a local-first personal intelligence system. It keeps long-lived personal context, goals, memory, knowledge, permissions, and execution history while delegating agent execution to replaceable runtimes.

The first desktop baseline is the complete source-built DeepSeek Harness Web workbench supervised by Electron. Telos keeps the upstream runtime isolated and pinned, then applies its own desktop lifecycle, security, theme, branding, and later personal-intelligence domains through explicit overlays rather than editing the Submodule.

## Run locally

Requirements:

- Node.js 22.12 or newer
- pnpm 11

Clone with the pinned upstream sources:

```bash
git clone --recurse-submodules https://github.com/codexiaoke/telos.git
cd telos
```

For an existing clone:

```bash
git submodule update --init --recursive
```

```bash
pnpm install
pnpm dsh:build
pnpm dev
```

`pnpm dsh:build` installs the pinned DSH source tree with its frozen lockfile, builds its Host, client-plugin bundles and complete Web app, then generates the Telos Renderer layout compatibility package and sidebar presentation overlay. It skips DSH's contributor-only Git hook installer because a Submodule shares Git metadata with Telos, while explicitly rebuilding the reviewed native dependencies needed by the runtime. For development, put `DEEPSEEK_API_KEY` in the ignored `.env.local` until Telos owns a credential store.

Build and validate:

```bash
pnpm dsh:verify
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

`pnpm dsh:verify` proves that the checked-out Submodule, parent gitlink,
provenance hashes, copied licenses, and generated derivatives agree, then compares
the effective Telos plugin composition with DSH's pinned default Web
composition. The only accepted roster delta is the documented sidebar
presentation replacement; an additional resolution check proves that the
unchanged `ui-layout` identity resolves to Telos Renderer source inside the Web
Profile. `pnpm dsh:upstream` additionally performs a
read-only check of the canonical upstream `master` branch; it never fetches or
moves the Submodule pointer.

## Current scope

- Electron-supervised, loopback-only complete DSH Web Runtime lifecycle
- DSH's full default workbench occupants and plugin roster
- Telos-owned source-level three-column frame, animated startup/recovery page, native window title, light/dark tokens, and generated sidebar brand overlay
- DeepSeek Harness source pinned as an isolated Git Submodule
- Telos Runtime Contract and source-built DSH SDK adapter retained as a secondary headless path
- Real Web conversation, streaming answer, workspace, session, settings, tool, and activity surfaces
- Architecture boundaries for external connectors

OpenCLI, OpenConnector, personal memory, and personal knowledge remain planned additions after the complete DSH parity baseline and upstream-sync gates are stable.

See the [complete DSH Web baseline](docs/architecture/0003-full-dsh-web-baseline.md) for the runtime and parity boundary, the [Telos-owned Renderer decision](docs/architecture/0004-telos-owned-renderer.md) for the source-level UI migration, and the [DSH upstream synchronization runbook](docs/maintenance/dsh-upstream-sync.md) before changing the pinned source commit. The earlier [desktop foundation](docs/architecture/0001-foundation.md) and [DSH source integration](docs/architecture/0002-dsh-source-integration.md) decisions are retained as historical context where ADR 0003 supersedes them.
