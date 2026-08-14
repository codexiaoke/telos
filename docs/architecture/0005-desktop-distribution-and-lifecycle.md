# 0005 Desktop distribution and lifecycle

Status: Accepted for the first distributable TELOS desktop baseline

## Context

TELOS is not only an Electron renderer. A usable desktop release also owns the
application lifecycle, the system tray, a single running instance, diagnostics,
signed installers, release metadata, updates, and the complete source-pinned DSH
runtime that the desktop starts as a child process.

The DSH runtime cannot be placed inside Electron's `asar` archive. It contains
native dependencies, workspace links, a complete Web application, and must run
under a supported standalone Node.js executable. The current DSH release requires
Node `^22.19.0 || >=24.0.0`.

A production-only `pnpm deploy` of `@deepseek-ai/dsh` is not yet a valid complete
Web runtime closure. Some packages loaded through DSH profiles and peer dependency
contracts are not materialized by that deployment alone. Therefore package size
must not be optimized by silently removing runtime capabilities.

## Decision

### Packaging stack

TELOS uses `electron-builder` with the existing `electron-vite` build. This keeps
the current application architecture intact and supplies installers, signing,
GitHub Release publishing metadata, and `electron-updater` compatibility without
introducing a second Electron build system.

The desktop package contains three independent payloads:

1. the TELOS Electron application and its production dependencies;
2. an unpacked, source-pinned and already-built DSH runtime under
   `resources/dsh-runtime` plus TELOS-owned overlays under
   `resources/dsh-overlays`;
3. an official standalone Node.js distribution under `resources/dsh-node`.

All three payloads are built or staged on the target operating system and CPU
architecture. Native DSH dependencies must never be copied from a different
platform runner.

The first distributable baseline uses a correctness-first DSH runtime snapshot.
It excludes repository metadata, source maps, tests, caches, and contributor-only
artifacts, but it retains the built workspace and installed dependency layout.
Before an installer is accepted, the packaged runtime must pass a launch smoke
test. A later size-optimization phase may replace this snapshot only with an
explicit deployment manifest whose dependency closure passes the same smoke test.

### Application lifecycle

The main process owns one application lifecycle controller:

- acquire Electron's single-instance lock before starting services;
- restore and focus the existing window when a second launch occurs;
- create the tray only after Electron is ready and retain its object for the
  lifetime of the process;
- closing the window hides TELOS instead of terminating long-running work;
- the tray and application menu expose an explicit quit action;
- an explicit quit stops DSH before the Electron process exits;
- macOS activation recreates or restores the main window.

The close-to-tray policy starts as a product default and must later become a user
setting. The implementation keeps an `isQuitting` guard so shutdown is never
mistaken for a normal window close.

### Updates

The update service is main-process only. Renderer code does not import
`electron-updater` and cannot install an update directly.

- development builds report updates as unavailable;
- packaged builds check after a startup delay and then at a bounded interval;
- downloads require an explicit user action in the first release;
- an update is installed only after the user chooses restart and install;
- failures are logged and represented as observable state, never as an unhandled
  rejection;
- tray and application menu actions call the same update service.

GitHub Releases is the first update provider. Release tags use `vX.Y.Z`. The
release workflow creates a draft release so installers can be checked before
publication. macOS updates are produced only from signed and notarized builds;
Windows releases are signed before public distribution.

### Release workflow

Each operating system builds its own payload on a native runner. A release job:

1. checks out TELOS with the DSH submodule;
2. installs the pinned pnpm and dependency lockfiles;
3. runs TELOS tests, type checks, lint, and DSH sync/parity checks;
4. builds DSH and the TELOS overlays;
5. stages an official Node distribution compatible with DSH;
6. packages and signs the target installer;
7. uploads installers, blockmaps, and update metadata to one draft release.

Signing identities, notarization credentials, and GitHub tokens are CI secrets.
They are never stored in repository files or local environment examples.

## Initial target matrix

| Platform | Architectures | Installer | Update artifact |
| --- | --- | --- | --- |
| macOS | arm64, x64 | DMG and ZIP | ZIP metadata and blockmap |
| Windows | x64 | NSIS | installer metadata and blockmap |
| Linux | x64 | AppImage and deb | AppImage metadata |

macOS arm64 is the first local acceptance target. Other matrix entries are
considered implemented only after their native CI jobs pass; configuration alone
is not acceptance evidence.

## Consequences

- The first installer is intentionally larger than the eventual optimized build.
- Tray behavior and long-running DSH work share one explicit lifecycle rather
  than relying on Electron's default `window-all-closed` behavior.
- Update behavior is testable without contacting GitHub by injecting an updater
  adapter into the state machine.
- DSH updates remain source-pinned. A TELOS release never downloads an arbitrary
  new DSH runtime at application startup.
- Publishing a release remains a deliberate action. Merging the workflow does
  not by itself create or publish a GitHub Release.

## References

- Electron distribution overview: <https://www.electronjs.org/docs/latest/tutorial/distribution-overview>
- Electron application lifecycle and single-instance API: <https://www.electronjs.org/docs/latest/api/app>
- Electron tray guide: <https://www.electronjs.org/docs/latest/tutorial/tray>
- Electron code signing guide: <https://www.electronjs.org/docs/latest/tutorial/code-signing>
- electron-builder extra resources: <https://www.electron.build/docs/contents>
- electron-builder auto update: <https://www.electron.build/docs/features/auto-update>
- Cherry Studio release workflow reference: <https://github.com/CherryHQ/cherry-studio/blob/main/.github/workflows/release.yml>
