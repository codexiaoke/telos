# ADR 0003: Complete DSH Web baseline inside Telos Desktop

- Status: Accepted
- Date: 2026-08-14
- Supersedes: the DSH UI and primary interactive-runtime decisions in ADR 0001 and ADR 0002

## Context

Telos must first provide the complete functionality of the pinned DeepSeek
Harness Web application before it adds personal memory, knowledge, automation,
or other Telos-only domains. Reimplementing DSH sessions, projections, tools,
permissions, presets, questions, plans, jobs, subagents, and settings behind a
new visual shell would duplicate a large system and make functional parity
unprovable.

The currently implemented `@telos/runtime-dsh` adapter is intentionally small.
It launches one SDK JSON-RPC process for one prompt and cannot expose the full
long-lived DSH Web host, browser plugin roster, interactive requests, or session
management. It remains useful as a headless adapter, but it is not the desktop
product baseline.

## Decision

Telos Desktop will supervise the complete source-built `dsh web` process and
load the application it serves in the Electron window. The DSH Submodule stays
unmodified and pinned to an explicit commit. Telos presentation changes live
outside the Submodule as patch overlays, compatible DSH client plugins, design
tokens, and selectively replaced visual components.

The primary interactive path is:

```text
Electron main process
  -> DSH Web process supervisor
  -> source-built `dsh web --port 0`
  -> DSH Host, API gateway, projections, storage, and agent presets
  -> DSH browser runtime and complete client plugin roster
  -> Telos-compatible theme, shell, and visual overrides
```

The existing headless path remains available for future background use:

```text
Telos runtime contract -> @telos/runtime-dsh -> DSH SDK JSON-RPC child
```

The two paths must not be confused. Only the first establishes DSH Web feature
parity.

## Functional baseline

“All DSH functionality” means every capability enabled by the default
`dsh web` composition at the DSH commit pinned by Telos. It does not mean:

- an experimental or default-disabled row;
- a provider that is present in source but lacks required configuration;
- a platform-specific capability unavailable on the current operating system;
- a future upstream capability that has not passed the Telos upgrade process.

The authoritative upstream roster is composed from the DSH Web profile and
`packages/bundle/web-app/cordis.patch.yml`. Telos must not maintain a handwritten
replacement roster as its source of truth.

## Ownership boundaries

### DSH owns the functional workbench

DSH continues to own its Host services, browser runtime, Remote contracts,
session event model, projections, stores, controllers, tool protocol, and the
default Web plugin roster. Telos must reuse these implementations rather than
imitate them.

### Telos owns the desktop product and presentation

Telos owns Electron lifecycle and security, branding, layout, design tokens,
animation language, navigation framing, and later personal domains. A Telos
visual replacement must preserve the DSH slot, props, event, and Remote
contracts consumed by the component it replaces.

The first desktop overlay is deliberately narrow: Electron translates the
native window-title suffix from `DeepSeek Harness` to `Telos` and injects a
light/dark Telos palette through DSH's `--dsw-*` design-token surface. It does
not select DSH component class names, rewrite the DOM, or modify the Submodule.
The persistent sidebar brand is a generated MIT-derived client plugin: a
fail-loud build transform starts from the pinned DSH sidebar bundle, changes
only its module identity, host-controlled titlebar inset, and two brand marks,
and a Telos-owned `--patch` disables the upstream sidebar row before inserting
that compatible replacement.
If an upstream update removes a token we use, the sync audit must report that
drift before the DSH pointer is advanced.

### The Submodule is read-only product input

Normal Telos development does not edit
`third_party/deepseek-harness`. A generic correction should be contributed to
DSH through its own repository. An unavoidable temporary source patch follows
ADR 0002 and lives on an explicit fork branch with provenance.

## Desktop lifecycle

The Electron main process will own one DSH Web supervisor per application
instance:

1. Resolve development or packaged DSH source-built artifacts and a compatible
   standalone Node.js runtime; release packages include that runtime and do not
   depend on a system installation or Electron's embedded Node;
2. Give DSH a Telos-owned `DSH_HOME` under Electron application data.
3. launch the built DSH CLI with loopback-only binding and an OS-assigned port;
4. capture bounded stdout and stderr for diagnostics;
5. treat the upstream `dsh web: http://127.0.0.1:<port>` line as the first
   readiness signal;
6. verify the URL responds before navigating the application window;
7. surface startup failure without navigating to partial or remote content;
8. send `SIGTERM` during application shutdown and apply a bounded forced stop
   only if graceful shutdown does not finish.

DSH must never bind to all network interfaces from the desktop integration.
External navigation and new-window requests must not silently replace the
trusted local application page.

## Presentation migration

ADR 0004 extends this migration by making `apps/desktop/src/renderer` the
source of Telos-compatible Client Plugin components. The DSH Web bootstrap and
client runtime remain the functional assembly path while root presentation is
replaced from Telos-owned source.

Presentation changes proceed from lowest risk to highest risk:

1. Run the untouched DSH Web application in Electron as the reference mode.
2. Add Telos branding, fonts, colors, spacing, and motion tokens.
3. Replace the application frame, sidebar, and activity-panel presentation
   while retaining DSH slot composition and state.
4. Adapt conversation visuals without replacing DSH session projections,
   controller logic, tool nodes, approvals, questions, or streaming semantics.
5. Add Telos-only client and host plugins after the parity baseline is stable.

Copying an upstream component is allowed only when its provenance and contract
are recorded. Copying the entire DSH Web source into a second unmanaged tree is
not allowed.

## Feature-parity gates

A Telos version may claim parity with its pinned DSH commit only when all of the
following pass:

- the source-built default DSH Web composition starts inside Electron;
- the effective enabled plugin roster has no unexplained removal from the
  pinned upstream roster;
- DSH Web tests relevant to every adapted client package pass;
- Telos desktop tests cover supervisor readiness, failure, and shutdown;
- a real local smoke test creates a session, streams one answer, resumes it,
  and observes the activity/tool surface;
- settings, workspace selection, model selection, permission flow, questions,
  plans, jobs, subagents, deliverables, and trajectory remain reachable when
  their runtime prerequisites are present;
- no credential is committed and no upstream source file is modified.

The untouched DSH Web application remains a runnable reference mode until the
Telos visual migration has an automated parity suite.

## Upstream synchronization

Manual review is required, but it is driven by recorded inputs rather than an
unstructured directory comparison.

Each upgrade records the old and candidate DSH commits and reviews changes in:

- `apps/web`;
- `packages/bundle/web-app`;
- `packages/client`;
- `packages/api/remotes`;
- `packages/host/apiproxy`;
- the default Web profile and agent presets.

Changes are classified as untouched reuse, token/style impact, adapted-source
merge, Remote/projection/session-contract impact, new plugin, or removed/renamed
plugin. Contract changes and plugin roster changes are mandatory review items.

An upgrade is made on an isolated branch and commit. It advances the Submodule
pointer, updates compatibility code and provenance records, runs the parity
gates, and only then becomes the new baseline. A DSH upgrade must not be mixed
with unrelated Telos features.

The executable controls are:

- `pnpm dsh:audit` verifies the parent gitlink, clean Submodule, source remotes,
  pinned notice, license, provenance commit, and source/generated hashes;
- `pnpm dsh:parity` asks the pinned DSH CLI for both the default and
  Telos-patched effective Web configurations and structurally verifies that all
  upstream rows are unchanged except the disabled presentation sidebar, with
  exactly one compatible Telos sidebar inserted;
- `pnpm dsh:upstream` performs the same local audit plus a read-only comparison
  with canonical upstream `master`; it reports an available update without
  fetching it or changing the gitlink.

The complete procedure and acceptance evidence are defined in
`docs/maintenance/dsh-upstream-sync.md`.

## Phased acceptance

### Phase 1: architecture and build baseline

- this ADR is accepted;
- the DSH source commit remains pinned and clean;
- the Telos build produces the full DSH host, client, and Web artifacts.

### Phase 2: supervised full Web runtime

- Electron starts `dsh web` on loopback with an ephemeral port;
- the window navigates only after verified readiness;
- startup failure and graceful shutdown are observable and tested.

### Phase 3: functional parity proof

- the default plugin roster is captured from the effective composition;
- DSH Web and Telos smoke tests pass;
- one real configured-model conversation passes through the full Web UI.

### Phase 4: Telos presentation

- design tokens and motion replace DSH branding;
- the three-column Telos frame is delivered through compatible UI overrides;
- the parity gates show no functional regression.

## Deferred work

Personal memory, graph storage, personal knowledge, long-running Telos goals,
OpenCLI, OpenConnector, additional model orchestration, and new Planes are not
part of this milestone. Their later Cordis plugins must be additive to this
baseline.

## Consequences

- Telos gains DSH functionality immediately instead of rebuilding it feature by
  feature.
- The full DSH build and Web test surface becomes part of desktop delivery.
- UI work must respect DSH client contracts, which constrains arbitrary rewrites
  but preserves behavior.
- DSH updates remain explicit and reviewable, while untouched upstream code can
  advance through a Submodule pointer update.
- Telos-specific domains remain separable from a fast-moving runtime and Web
  implementation.
