# TELOS

TELOS is a local-first personal intelligence system. It keeps long-lived personal context, goals, memory, knowledge, permissions, and execution history while delegating agent execution to replaceable runtimes.

The first milestone is intentionally small: a secure Electron shell with a React workspace owned entirely by TELOS. DeepSeek Harness and future capability providers will run headlessly behind TELOS contracts rather than dictate the desktop interface.

## Run locally

Requirements:

- Node.js 22.12 or newer
- pnpm 11

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
- Architecture boundaries for DeepSeek Harness and external connectors

DeepSeek Harness, OpenCLI, and OpenConnector are planned integrations and are not bundled in this initial runnable baseline.

See [the foundation decision](docs/architecture/0001-foundation.md) for ownership and integration boundaries.
