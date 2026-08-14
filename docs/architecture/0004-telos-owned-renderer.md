# ADR 0004: Telos-owned Renderer over the DSH client runtime

- Status: Accepted
- Date: 2026-08-14
- Extends: ADR 0003

## Context

ADR 0003 established the complete, source-built DSH Web application as the
functional reference baseline. That was necessary to prove that Telos could
retain DSH sessions, projections, tools, permissions, questions, plans, jobs,
subagents, settings, workspaces, and activity surfaces without reimplementing
them.

The reference mode currently navigates the Electron `BrowserWindow` from the
local Telos Vite page to the loopback DSH Web URL after the Host becomes ready.
Consequently, `apps/desktop/src/renderer` is visible only during startup or a
startup failure. Theme tokens and a generated sidebar derivative can change
presentation, but they do not give Telos sufficient ownership of the product
frame for a highly customized personal-intelligence system.

DSH's `apps/web` is not the visible workbench implementation. Its entry mounts
`AppWebEntry`; the Host injects `window.__DSH_BOOT__`, and the client module
system fetches the actual UI packages as DSH Client Plugins. The shipped
`@deepseek-ai/dsh-client-ui-layout` package occupies the built-in `root` Slot
and declares four child Slots:

- `sidebar`;
- `conversation`;
- `details`;
- `shell.overlay`.

This is the stable seam Telos needs: it can own the root React component while
retaining the upstream occupants of every functional child Slot.

## Decision

`apps/desktop/src/renderer` becomes the authoritative source layer for Telos
desktop presentation. It has two independent build entries:

1. a small local bootstrap/recovery application loaded while DSH starts;
2. a DSH-compatible Client Plugin entry that registers the Telos application
   frame into the DSH Slot runtime.

The normal interactive page may continue to be served from the DSH loopback
Host. The serving URL does not determine presentation ownership: after plugin
assembly, the root React tree is supplied by Telos Renderer source.

The first compatible replacement is `ui-layout`. It retains the complete DSH
layout service and Slot contract while changing component structure, styling,
motion, and future Telos navigation seams. Later visual packages can migrate
one at a time; DSH business state and behavior remain upstream until Telos has
an explicit domain reason to replace them.

## Exact package identity

DSH Client Plugin dependency edges use npm package names. Shipped packages such
as `ui-sidebar` and `ui-conversation` declare an injection dependency on
`@deepseek-ai/dsh-client-ui-layout`. Replacing the Loader row with a differently
named `@telos/*` module would leave those graph edges unresolved or require
patching every dependent package.

Telos therefore installs a private compatibility derivative under the exact
package identity `@deepseek-ai/dsh-client-ui-layout` in the writable Web
Profile's own `node_modules`. This is deliberately not the shared
`profiles/node_modules` fallback, whose upstream symlinks are healed and owned
by DSH. Node resolution from `profiles/web` selects the profile-specific Telos
package before that upstream fallback. The default `ui-layout` Loader row and
all downstream graph edges remain unchanged.

The tracked distribution directory is named for its ownership rather than its
runtime identity:

```text
integrations/dsh/plugins/telos-ui-layout/
  package.json              # private; compatibility name is the DSH package id
  lib/index.js              # no-op Host half
  lib/client.js             # generated DSH Client Plugin bundle
  UPSTREAM.json             # source mappings, commit, and hashes
  LICENSE.upstream
```

It must never be published as an upstream DSH package.

## Renderer source structure

```text
apps/desktop/src/renderer/src/
  bootstrap/                # startup, failure details, retry/recovery
  workbench/
    dsh-client.ts           # Client Plugin apply entry
    shell/                  # Telos root frame and layout state
  features/                 # later memory, knowledge, goals, automation
  components/               # Telos-owned reusable React components
  lib/                      # presentation utilities and adapters
```

The DSH Client Plugin build imports only the `workbench` entry and its closure.
Bootstrap-only IPC code must not leak into the DSH bundle. Conversely, DSH Slot
and Remote contracts must stay behind the workbench adapter boundary rather
than spreading through feature presentation.

## Build and React boundary

The generated client bundle uses the DSH closure-factory protocol:

```text
window.__ModuleLoader__.load({ id, factory(require) { ... } })
```

React, `react/jsx-runtime`, and DSH platform modules stay external. At runtime
they resolve from the module table seeded by the DSH Web shell, preventing a
second React instance and preserving Context and Hook identity. The local
bootstrap application's React dependency is a separate build concern and must
not be bundled into the Client Plugin.

CSS owned by the plugin is embedded and installed with an owner marker so HMR
or plugin disposal can retract it. Generated artifacts are not hand-edited.

## Source derivation

The first Telos frame is a source derivative of the pinned DSH `ui-layout`
package because these behaviors are compatibility obligations, not visual
preferences:

- root Slot registration and child declarations;
- `ctx.layout` service shape;
- sidebar and details panel actions;
- session-change details closing;
- strict/session-maybe Slot lifetime behavior;
- panel width constraints and narrow-window concession behavior;
- theme snapshot presentation.

Telos may change DOM structure, visual tokens, component composition, motion,
and additional Telos-owned children. Every derived source mapping and hash is
recorded against the pinned DSH commit. The copied MIT license travels with the
distribution.

An upstream update that changes one of the compatibility obligations is a
mandatory manual merge. A purely visual upstream change can be consciously
ignored and recorded as such.

## Functional ownership

During this phase:

- Telos owns the root frame and desktop visual system;
- DSH continues to own the occupants of `sidebar`, `conversation`, `details`,
  and their nested Slots;
- Electron main owns window/process lifecycle, filesystem/native capabilities,
  security fences, and IPC;
- future personal domains own durable memory, knowledge, goals, permissions,
  and automation state outside DSH session history.

Replacing a root component does not authorize copying business state into
React local state. DSH session facts continue to arrive through standard Slot
Hooks, projections, and Remote contracts.

## Migration order

1. Keep the untouched DSH `ui-layout` as the runnable reference.
2. Build the Telos layout derivative from Renderer source.
3. Install it as the Profile-local compatibility package and prove all four
   child Slots still render.
4. Reduce the local bootstrap application to startup/recovery responsibilities.
5. Migrate sidebar, details/activity, conversation chrome, and settings only in
   separately accepted batches.
6. Add Telos personal features through additive Slots and Host/Remote plugins
   before replacing upstream business surfaces.

The migration does not copy the complete DSH Web source tree into Telos.

## Verification gates

A Telos Renderer layout build is accepted only when:

- the DSH Submodule remains clean and pinned;
- the generated package resolves from the Telos DSH Profile under the exact
  compatibility name;
- provenance source and generated hashes match;
- the Client Plugin bundle externalizes React and DSH platform identities;
- the effective default DSH roster remains complete;
- `sidebar`, `conversation`, `details`, and `shell.overlay` are declared and
  rendered with the original kinds and scopes;
- layout service actions continue to drive upstream sidebar and details
  plugins;
- source-level layout tests, Telos repository gates, and relevant upstream DSH
  layout tests pass;
- Electron loads the Telos frame and a real configured-model conversation
  still streams through the full Web path.

The untouched layout remains selectable as a reference or emergency fallback
until the source derivative passes these gates on every supported platform.

## Rejected alternatives

### Directly edit the Submodule

This hides product changes inside an upstream checkout, dirties the locked
input, and makes updates and attribution ambiguous.

### Maintain a wholesale DSH Web fork inside Telos

The Web entry is only a bootstrap and most functionality is already modular.
Copying the whole tree creates a much larger merge surface without increasing
Telos UI control.

### Keep the local Electron page and rebuild DSH behavior through IPC

This returns to the discarded minimal-SDK architecture and would require
reimplementing the mature client runtime, projections, Slots, permissions, and
session lifecycle.

### Embed the complete DSH page inside a Telos page

An iframe or nested WebContents creates focus, navigation, accessibility,
dialog, drag-region, and lifecycle boundaries while still leaving DSH in
control of the inner UI. It is not needed when the client plugin seam already
supports root replacement.

## Consequences

- Telos gains full control of its React component tree without abandoning the
  verified DSH functional baseline.
- Runtime compatibility becomes an explicit adapter and provenance problem,
  rather than an unmanaged visual fork.
- The build is more involved than Electron Vite alone because it emits both a
  bootstrap app and a DSH closure-factory bundle.
- Exact package substitution is intentionally invisible to the YAML roster, so
  resolution-path and artifact audits must complement structural parity checks.
- Future UI migration can be gradual and independently reversible.
