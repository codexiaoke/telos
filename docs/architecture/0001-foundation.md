# ADR 0001: Runnable desktop foundation

- Status: Partially superseded by ADR 0003
- Date: 2026-08-14

## Decision

TELOS starts as a pnpm monorepo with an Electron desktop application and a React renderer. The first milestone proves that the desktop product can start, render, build, and expose a minimal typed preload API without giving the renderer direct Node.js access.

The initial application is a personal workspace, not a chat client. Its first visible shell has three resizable regions: conversations on the left, the current workspace in the center, and observable Agent activity on the right. Goals, projects, memory, knowledge, automations, and runs will enter this shell as product objects rather than being reduced to chat messages.

The renderer uses React, TypeScript, React Aria Components, Tailwind CSS, Motion, Lucide icons, and `react-resizable-panels`. TELOS owns its components and design tokens; no DSH Web UI code is reused.

> Supersession note: ADR 0003 replaces the last sentence for the DSH-first
> milestone. TELOS now adopts the complete DSH Web application as its initial
> functional baseline and changes presentation through out-of-tree overlays and
> compatible client plugins. The Electron security boundary and the long-term
> TELOS ownership boundaries in this ADR remain in force.

## Ownership boundaries

### Electron

Owns the window lifecycle, operating-system integration, local process supervision, notifications, and the minimal preload bridge. It does not own personal domain state or agent orchestration.

### React renderer

Owns product presentation and user interaction. It cannot directly access Node.js, the shell, or arbitrary local files.

### TELOS Local Gateway

Will be the renderer's single local API and event-stream boundary. The UI will not connect directly to DeepSeek Harness, OpenCLI, OpenConnector, or model providers. The gateway will apply permissions, normalize runtime events, and isolate external API churn.

### DeepSeek Harness

Will be an optional headless Agent Runtime for in-flight model calls, planning loops, tool execution, and runtime plugins. It will be pinned as an upstream dependency and accessed through a TELOS compatibility adapter rather than copied into this repository. It does not own the TELOS UI, personal truth, user policy, or durable permissions.

### TELOS Personal Core

Will own goals, projects, tasks, personal events, memory, knowledge, long-running automations, user policy, durable permissions, and action records. Its domain code must not depend on Electron or DeepSeek Harness.

## Planned capability providers

OpenCLI and OpenConnector are complementary integrations:

- OpenCLI will provide typed access to logged-in browser sessions, website adapters, and selected desktop or local CLI automation.
- OpenConnector will provide OAuth/API-based SaaS connections, action schemas, credential isolation, and inspectable execution logs.

Neither project will become a TELOS truth source. Both will sit behind a future capability-provider contract, TELOS permission checks, and durable TELOS action receipts.

## Data direction

SQLite will be the initial local truth source. Full-text, vector, and graph structures will be treated as rebuildable indexes or projections. Personal memories must retain provenance, observed time, confidence, lifecycle state, and deletion semantics.

## Upgrade direction

Only a dedicated DSH bridge and TELOS DSH plugins may import unstable DSH APIs. Upstream upgrades will be isolated, version-pinned, compatibility-tested changes.
