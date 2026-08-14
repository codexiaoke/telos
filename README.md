# TELOS

TELOS is a local-first personal intelligence system. It keeps long-lived personal context, goals, memory, knowledge, permissions, and execution history while delegating agent execution to replaceable runtimes.

The first milestone is intentionally small: a secure Electron shell with a React workspace owned entirely by TELOS. DeepSeek Harness and future capability providers will run headlessly behind TELOS contracts rather than dictate the desktop interface.

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

`pnpm dsh:build` installs the pinned DSH source tree with its frozen lockfile and builds the SDK client plus headless JSON-RPC runtime. It skips DSH's contributor-only Git hook installer because a Submodule shares Git metadata with TELOS, while explicitly rebuilding the reviewed native dependencies needed by the runtime. Launch TELOS with `DEEPSEEK_API_KEY` in its environment until the local credential store is implemented.

Build and validate:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

## Current scope

- Electron desktop lifecycle and secure preload boundary
- Resizable three-column shell: conversations, workspace, and activity
- React Aria Components, Tailwind CSS, Motion, and TELOS design tokens
- A lightweight TELOS Agent Orb for meaningful long-running status animation
- DeepSeek Harness source pinned as an isolated Git Submodule
- TELOS Runtime Contract and source-built DSH adapter over stdio JSON-RPC
- Streaming answer and normalized runtime activity in the desktop shell
- Architecture boundaries for external connectors

The current DSH profile is intentionally executor-less: it performs model conversations but exposes no shell or filesystem tools until interactive approvals can cross the SDK protocol. OpenCLI and OpenConnector remain planned integrations.

See the [desktop foundation](docs/architecture/0001-foundation.md) and [DSH source integration](docs/architecture/0002-dsh-source-integration.md) decisions for ownership, runtime, and upgrade boundaries.
