# TELOS

TELOS is a local-first personal intelligence system. It keeps long-lived personal context, goals, memory, knowledge, permissions, and execution history while delegating agent execution to replaceable runtimes.

The first desktop baseline is the complete source-built DeepSeek Harness Web workbench supervised by Electron. TELOS keeps the upstream runtime isolated and pinned, then applies its own desktop lifecycle, security, theme, branding, and later personal-intelligence domains through explicit overlays rather than editing the Submodule.

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

`pnpm dsh:build` installs the pinned DSH source tree with its frozen lockfile, builds its Host, client-plugin bundles, complete Web app, and the small TELOS sidebar overlay. It skips DSH's contributor-only Git hook installer because a Submodule shares Git metadata with TELOS, while explicitly rebuilding the reviewed native dependencies needed by the runtime. For development, put `DEEPSEEK_API_KEY` in the ignored `.env.local` until TELOS owns a credential store.

Build and validate:

```bash
pnpm dsh:verify
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

`pnpm dsh:verify` proves that the checked-out Submodule, parent gitlink,
provenance hashes, copied license, and generated overlay agree, then compares
the effective TELOS plugin composition with DSH's pinned default Web
composition. The only accepted roster delta is the documented sidebar
presentation replacement. `pnpm dsh:upstream` additionally performs a
read-only check of the canonical upstream `master` branch; it never fetches or
moves the Submodule pointer.

## Current scope

- Electron-supervised, loopback-only complete DSH Web Runtime lifecycle
- DSH's full default three-column workbench and plugin roster
- TELOS native window title, light/dark design-token palette, and generated sidebar brand overlay
- DeepSeek Harness source pinned as an isolated Git Submodule
- TELOS Runtime Contract and source-built DSH SDK adapter retained as a secondary headless path
- Real Web conversation, streaming answer, workspace, session, settings, tool, and activity surfaces
- Architecture boundaries for external connectors

OpenCLI, OpenConnector, personal memory, and personal knowledge remain planned additions after the complete DSH parity baseline and upstream-sync gates are stable.

See the [complete DSH Web baseline](docs/architecture/0003-full-dsh-web-baseline.md) for the current ownership, presentation, parity, and upgrade boundaries, and the [DSH upstream synchronization runbook](docs/maintenance/dsh-upstream-sync.md) before changing the pinned source commit. The earlier [desktop foundation](docs/architecture/0001-foundation.md) and [DSH source integration](docs/architecture/0002-dsh-source-integration.md) decisions are retained as historical context where ADR 0003 supersedes them.
