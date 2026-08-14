# ADR 0002: DeepSeek Harness source integration

- Status: Accepted
- Date: 2026-08-14

## Context

DeepSeek Harness is the first Agent Runtime selected for TELOS. It is not the personal domain core and does not own the TELOS UI. At adoption time DSH is a developer preview that warns of compatibility-breaking changes, publishes from a single `master` branch without stable Git tags, and reports version `0.1.0-rc.5` at commit `47f943859bef60e4160492346772ded9b24f765a`.

TELOS needs inspectable source, reproducible builds, controlled upgrades, and a clean path for contributing generic improvements upstream. Installing DSH itself from npm or copying its source into the TELOS history would weaken those properties.

## Decision

TELOS tracks DSH as an isolated Git Submodule:

| Item | Value |
|---|---|
| Upstream | `https://github.com/deepseek-ai/deepseek-harness.git` |
| Maintained fork | `https://github.com/codexiaoke/deepseek-harness.git` |
| TELOS path | `third_party/deepseek-harness` |
| Initial pinned commit | `47f943859bef60e4160492346772ded9b24f765a` |

The TELOS commit records the exact DSH commit. The fork's `master` mirrors upstream and carries no TELOS product code. Any unavoidable temporary source patch lives on a clearly named `telos-patches/<base-sha>` branch and must reference an upstream issue or pull request.

The nested DSH repository keeps its own package manager version, lockfile, patches, native dependencies, TypeScript configuration, and build gates. `third_party/deepseek-harness` is deliberately excluded from the TELOS pnpm workspace. A source checkout still installs DSH's reviewed third-party dependencies with DSH's own frozen lockfile; TELOS does not download DSH itself as an npm package.

The TELOS build wrapper restores the DSH workspace with lifecycle scripts disabled, then explicitly rebuilds the native packages admitted by the pinned DSH workspace before running the Host library build. This avoids DSH's contributor-only Git-hook `postinstall`, which cannot safely configure worktree-local hooks from a Submodule, without modifying the DSH checkout or silently skipping runtime native dependencies.

## Runtime boundary

The `@telos/runtime-dsh` adapter launches a DSH runtime built from the pinned source as a child process. It uses DSH's existing SDK client, JSON-RPC server, and newline-delimited stdio protocol instead of the DSH Web UI or internal Cordis services. The adapter loads the built SDK entry from the Submodule at runtime, so the TELOS workspace does not install DSH from the npm registry.

The communication path is:

```text
TELOS React UI
  -> TELOS Local Gateway
  -> TELOS Runtime Contract
  -> runtime-dsh adapter
  -> source-built DSH child process over stdio JSON-RPC
```

TELOS will own the external Cordis composition used for that process. DSH events will be translated into TELOS runtime events before reaching the UI or durable personal state. The React renderer and Personal Core must not import DSH packages or depend on DSH event shapes directly.

The first composition is `integrations/dsh/profiles/telos-default/cordis.yml`. It contains the SDK server, the official DeepSeek provider, an executor-less Agent spine, JSONL session evidence, and token metering. It deliberately exposes no shell or filesystem tool while the interactive approval path is absent from the SDK protocol.

The first adapter runs one active session per DSH child process. This makes process termination a session-scoped fallback instead of risking unrelated work while protocol-level cancellation is unavailable. Process pooling is deferred until the SDK negotiates capabilities and supports cancel, close, and interactive requests.

The DSH session log may be retained as execution evidence, but it is not the truth source for personal goals, memory, permissions, or durable action receipts.

## Upstream synchronization

Fetching an upstream commit and approving it for TELOS are separate operations.

1. Fetch `deepseek-ai/deepseek-harness` into the fork and fast-forward the fork's `master` without TELOS changes.
2. Select a candidate upstream commit; never point a product build at a moving branch.
3. Open a TELOS pull request that advances only the Submodule pointer and any required compatibility changes.
4. Build DSH from its source and frozen lockfile.
5. Run the DSH gates relevant to the touched runtime surface.
6. Run TELOS adapter contract tests and JSON-RPC schema validation.
7. Smoke-test process startup, initialization, prompt admission, session events, status transitions, subagents, graceful shutdown, and crash recovery.
8. Merge the pointer update only when all gates pass. Upstream watcher automation may create an upgrade pull request, but it must not auto-merge one.

For a maintainer checkout, add the official source as the Submodule's `upstream` remote when it is absent:

```bash
git -C third_party/deepseek-harness remote add upstream https://github.com/deepseek-ai/deepseek-harness.git
git -C third_party/deepseek-harness fetch upstream master
```

Updating the Fork and updating TELOS remain explicit, reviewable commits:

```bash
git -C third_party/deepseek-harness switch master
git -C third_party/deepseek-harness merge --ff-only upstream/master
git -C third_party/deepseek-harness push origin master
git add third_party/deepseek-harness
```

## Compatibility policy

The TELOS Runtime Contract is stable from the product's perspective. `runtime-dsh` advertises the capabilities supported by its pinned DSH version and maps unsupported operations explicitly rather than faking them.

The initial DSH SDK protocol has known gaps that the adapter must account for:

- no negotiated protocol version;
- no per-prompt cancellation or per-session close;
- no server-to-client request path for interactive approval or user questions.

Generic protocol improvements should be contributed to DSH upstream. TELOS-specific integration stays in an out-of-tree DSH plugin so it can later be published with the `dsh-plugin` topic. Core-source patches are the last resort.

## Distribution

Development builds use the checked-out source tree. Release automation will build a platform runtime from the pinned source and include the resulting artifacts and licenses in the TELOS desktop package. End users will not need Git, pnpm, or a separately installed DSH runtime.

## Consequences

- A full clone must initialize Submodules.
- DSH source history and dependencies consume additional disk space and build time.
- Upstream changes cannot silently change a released TELOS build.
- TELOS can audit, patch, roll back, and reproduce the exact Agent Runtime source.
- Product code remains insulated from DSH's fast-moving internal architecture.
