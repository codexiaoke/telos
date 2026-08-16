# ADR 0008: Telos-owned Computer Use and Browser Control

- Status: Proposed for product and architecture review
- Date: 2026-08-16
- Extends: ADR 0001, ADR 0002, ADR 0003, ADR 0006, ADR 0007

## Context

Telos needs two operating capabilities that DSH does not ship: driving the
user's browser, and operating native desktop applications (Computer Use).
Both are pure *capabilities*, not personal truth; personal state (memory,
goals, receipts, audit) remains owned by `@telos/personal-core`.

Community DSH plugins already implement both, under permissive licenses:

- [`@anionex/dsh-computer-use`](https://github.com/Anionex/dsh-computer-use)
  (MIT) is an Accessibility-first macOS Computer Use bundle with fresh
  observations, stale-state rejection, scoped leases, one-use sensitive-action
  confirmation, and a non-interfering default input route.
- [`@yeesy369/dsh-browser`](https://github.com/xylt369/dsh-browser) (MIT) is a
  browser capability seam (Edge/Playwright) with SSRF-safe navigation, an
  accessibility-ref snapshot, a `tools/pre-execute` permission gate, and a
  gated `evaluate`.

Their architecture is correct and was validated by reading both sources. Telos
adopts that architecture as Telos-owned packages rather than depending on the
community packages, for four reasons:

1. Computer Use is the highest-risk capability in the product. Telos must own
   its safety boundary, its native helper, and its upgrade path rather than
   pinning an unmaintained community bundle.
2. Telos distributes on macOS and Windows. `dsh-computer-use` is macOS-only;
   the Windows provider is greenfield and belongs in a Telos-owned package.
3. Every action must land in Telos's own audit ledger. The community plugins do
   not emit `@telos/personal-core` `ActionReceipt`s; Telos must, so actions
   close the observe-recall-act-observe loop of ADR 0006.
4. Telos already carries a pin + provenance + license discipline
   (`THIRD_PARTY_NOTICES.md`, `dsh:verify`). Adapted MIT code is recorded there,
   not hidden inside an opaque third-party dependency.

## Decision

Telos implements two capability seams as out-of-tree DSH plugins, mirroring the
proven community shape. Neither edits `third_party/deepseek-harness`; both are
Telos-owned and pin their native components.

```text
plugins/dsh-browser        Browser capability seam (ctx.browser)
plugins/dsh-computer-use   Desktop capability seam (ctx.computerUse)

apps/desktop (packaging)   Committed, SHA-256-pinned native helpers
                           macOS: AX helper (Swift, universal arm64+x86_64)
                           Windows: UI Automation helper (future)
```

The domain-neutral action vocabulary, coordinate spaces, target resolution, and
receipt shapes stay inside the plugin packages. The audit ledger is
`@telos/personal-core` `ActionReceipt`, which already exists.

## Architectural principles

### A capability seam is three roles

Both capabilities follow the DSH seam recipe verified against the community
sources and DSH core (`packages/shell/shell`, `packages/subprocess`):

- a **Service Definition** (an abstract `Service` declaring `ctx.browser` /
  `ctx.computerUse`),
- a **Service Provider** (the Playwright/Edge provider, or the native-helper
  backed macOS/Windows provider),
- a **Consumer** (the model-facing `browser_*` / `computer_*` tools plus a
  `tools/pre-execute` or approval policy).

Swapping a provider (Edge → Chrome → remote browser; macOS AX → Windows UIA)
never changes the tools or the Service Definition.

### The execution backend is a pinned native helper process, not Electron main

DSH tools run inside the DSH Web subprocess; screen capture and input injection
require OS GUI APIs. The community `dsh-computer-use` resolves this by spawning
a signed native helper through `ctx.subprocess` with a newline-delimited JSON
protocol (`{ protocolVersion, ...request }` in, `{ ok, value | error }` out),
verified against a committed SHA-256 manifest. Telos adopts exactly this:

- the helper is an opaque transport, not a public API;
- the plugin enforces platform, file type, executable mode, and manifest hash
  before first use;
- process-tree disposal reuses `ctx.subprocess` (the `subagent-codex` pattern).

This removes the need for a bespoke Electron-main RPC bridge and keeps the
native component out of the DSH process.

### Observation-bound actions, never blind replay

Every action references an immutable observation and fails closed when the
world changed. This is the single most important safety invariant and is
borrowed wholesale:

- opaque branded ids: observation id, target handle, confirmation token;
- every action carries the `observationId` it was planned against;
- observations expire and every provider settings change bumps a `generation`
  that invalidates prior observations;
- target resolution is deterministic and fail-closed: exact locator, then
  native identifier, then one unique semantic match (role + accessible name +
  advertised actions + ancestor fingerprint). Ambiguity or low confidence is an
  error, never a guess.

### Read/control leases, durable denials, one-use confirmation

- `read` access (observe AX/screenshot) is granted per Session and persisted;
- `control` access (send input) is granted per turn and is process-local;
- a user rejection for an app/scope is durable for the Session;
- missing grants route through `ctx.approval` and fail closed under
  `approval/policy: never`;
- high-impact actions (communication, sensitive transmission, irreversible
  deletion, account/security changes, financial completion, unrequested
  install, legal acceptance) require a one-use confirmation token minted by
  `computer_confirm` and bound to the exact app, observation, target, and
  action hash.

### Non-interfering by default

The default input route must not steal focus or move the system cursor. The
macOS provider uses semantic Accessibility first, routes keyboard/pointer to
the target pid + window (not the global HID stream), and draws a separate
click-through agent cursor for coordinate fallback. Explicit activation is an
operator-selected compatibility mode, never the default.

### Model-visible means logged

Screenshots and snapshots that reach a model request must be reconstructable
from the session log. Screenshots are committed through `ctx.attachments` and
returned as durable `ImageAttachmentRef`s, never raw bytes or transient paths.

## Browser seam (`plugins/dsh-browser`)

Adapted from the `dsh-browser` architecture:

- `BrowserRuntime extends Service` registers `ctx.browser` (`newPage`, `close`).
- The Playwright/Edge provider owns one browser, one context, one reusable page
  whose navigation state persists across tool calls; `windowVisibility`
  (`visible` / `hidden` / `headless`) and a persistent profile keep login state.
- `snapshot` reads the accessibility tree via Playwright `ariaSnapshot` in AI
  mode, returning actionable refs (`[ref=e1]`), with body text fallback.
- `click` accepts an accessibility ref or a CSS selector; `scroll` reports
  `atBoundary`; `evaluate` is disabled by default.
- Navigation is gated by a URL guard with defense-in-depth against SSRF:
  scheme/credential checks, a hostname blocklist, private/loopback/link-local/
  multicast/reserved IP-literal screening, and resolve-then-validate DNS.
- A `tools/pre-execute` permission gate classifies hosts as allowlist/denylist/
  ask, and routes unknown hosts through `ctx.approval` (with optional
  `remember`).

The browser is a capability, not personal state, so its state stays inside the
plugin and DSH; only its action receipts cross into `@telos/personal-core`.

## Computer Use seam (`plugins/dsh-computer-use`)

Adapted from the `dsh-computer-use` architecture:

- `ComputerUseService extends Service` registers `ctx.computerUse` and is
  provider-independent; it owns the agent-scoped observation store, staleness,
  leases, confirmations, and the post-action settle/re-observe loop.
- The provider is `macos-ax` first, backed by the native helper; a `windows-uia`
  provider is a later, separately reviewed addition.
- Tool vocabulary: `computer_list_apps`, `computer_observe`, `computer_click`,
  `computer_set_value`, `computer_type_text`, `computer_press_key`,
  `computer_scroll`, `computer_drag`, `computer_perform_action`,
  `computer_wait`, `computer_confirm`.
- The full vocabulary is exposed only after the Agent loads the Computer Use
  Skill; before that only `computer_use_activate` is registered, keeping the
  model surface focused.
- OCR, grounding, and pixel interpretation are delegated to Telos's multimodal
  / vision path, not reimplemented in the action layer.

Every successful or failed action emits a `@telos/personal-core` `ActionReceipt`
with the authorization decision, runtime/provider, result, and before/after
observation references, so actions are auditable and can constrain future
actions through `evaluateActionConstraints`.

## Native helper integrity

The macOS helper is a committed ad-hoc-signed universal `arm64 + x86_64`
binary, pinned by a `native/macos/manifest.json` carrying helper version,
source SHA-256, binary SHA-256, architectures, and deployment target. The
plugin refuses to run a helper whose hash differs, and `pnpm check:native`
rejects system-cursor-warp and global pointer-post symbols so the
non-interfering guarantee is mechanically checked. The Windows helper follows
the same pin + integrity contract once implemented.

## Implementation sequence

Each batch is independently reviewable and committed. Browser ships first
because it is lower risk and unblocks real value.

1. **P0 — Browser seam**: `plugins/dsh-browser` Service Definition, URL guard
   (pure, unit-tested), Playwright provider, `browser_*` tools, permission
   gate, `ctx.attachments` screenshot commit. No native component.
2. **P1 — Browser receipts**: emit `@telos/personal-core` `ActionReceipt`s for
   navigation and mutations; wire `evaluate` behind approval only.
3. **P2 — Computer Use contracts + macOS helper**: `plugins/dsh-computer-use`
   Service Definition, types, leases, confirmations, target resolver, and the
   macOS AX native helper with manifest pinning. All provider-independent logic
   unit-tested without a display.
4. **P3 — macOS provider + tools**: native-helper client, `computer_*` tools,
   Skill gating, TCC (Accessibility/Screen Recording) diagnostics, non-
   interfering input fixture (never-active background app) as the release gate.
5. **P4 — Receipts + sensitive-action policy**: `ActionReceipt` integration,
   one-use confirmation for high-impact actions, durable denials, replay.
6. **P5 — Windows provider** (separate ADR once macOS is accepted): UI
   Automation helper, same seam, same safety invariants.

## Acceptance matrix

### Browser

- SSRF guard rejects non-http(s), embedded credentials, blocked hostnames, and
  every private/loopback/link-local/reserved literal and resolved address;
- `snapshot` returns accessibility refs that `click` can consume without stale
  refs guessing;
- `evaluate` is absent from the model surface until explicitly enabled and
  approval-gated;
- screenshots surface as durable attachment refs, never raw bytes;
- a navigation or mutation emits a personal-core `ActionReceipt`.

### Computer Use

- no action executes without a fresh, unexpired, same-generation observation;
- stale locators fail closed with `COMPUTER_STALE_OBSERVATION`; rebinding only
  via a unique native identifier or unique semantic match, else ambiguity/
  low-confidence errors;
- read grants persist per Session; control grants are per turn; a rejection is
  durable for the Session;
- `approval/policy: never` blocks ungranted apps with a reported error and is
  not recorded as a user rejection;
- high-impact actions require a one-use confirmation token bound to app,
  observation, target, and action hash, invalidated on target change;
- the default input route does not move the system cursor, inject global HID
  events, or raise the target app; the never-active fixture proves it;
- the native helper hash is verified before use and non-interfering symbols are
  rejected at the native gate;
- every action emits a personal-core `ActionReceipt` with before/after evidence.

### Packaging and upgrade

- the packaged desktop includes the helper binaries, manifest, and licenses;
- `THIRD_PARTY_NOTICES.md` records the adapted MIT sources;
- `dsh:verify` continues to confirm the DSH Submodule is clean and the Telos
  plugins are out-of-tree parity deltas, not Submodule edits;
- disabling the Telos plugins leaves the pinned default DSH composition usable.

## Rejected alternatives

### Depend directly on `@anionex/dsh-computer-use` and `@yeesy369/dsh-browser`

This cedes the highest-risk safety boundary to an unmaintained community
package, keeps Computer Use macOS-only, and skips Telos's audit ledger. The
browser could be a dependency candidate, but Computer Use cannot.

### Add screen/input tools directly to `ctx.tools` without a seam

This welds the macOS provider and the tool schemas together, preventing a
Windows provider or a remote provider without rewriting the consumer. A seam is
required by DSH's own capability design.

### Fork the community repos

Forking recreates the DSH-fork maintenance burden ADR 0002 rejected. Telos
adapts the architecture and records attribution, but owns the packages.

### Drive a cloud computer-use product (Codex, OpenAI CUA)

A cloud backend violates local-first expectations, outsources credentials and
screen content, and replaces the Telos action layer. Codex remains a design
reference, not a provider.

## Consequences

- Telos gains browser and desktop operation as auditable capabilities behind
  one safety model.
- A new native component (macOS AX helper, later Windows UIA helper) enters the
  build and packaging path with TCC/Accessibility permission UX on macOS.
- The browser seam is low risk and ships first; Computer Use is gated on the
  macOS provider passing the never-active input fixture.
- Action receipts flow into personal-core, so computer/browser actions become
  first-class facts in continuity recall and constraint checks.
