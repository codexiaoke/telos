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
pnpm dev
```

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
- Architecture boundaries for Agent Runtimes and external connectors

The DSH source is present for audited, reproducible integration, but it is not yet built, launched, or connected to the desktop shell. OpenCLI and OpenConnector remain planned integrations.

See the [desktop foundation](docs/architecture/0001-foundation.md) and [DSH source integration](docs/architecture/0002-dsh-source-integration.md) decisions for ownership, runtime, and upgrade boundaries.
