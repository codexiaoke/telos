# Personal continuity v1 acceptance evidence

Date: 2026-08-15  
Platform: macOS arm64  
Runtime baseline: DSH `0.1.0-rc.5`, source commit
`47f943859bef60e4160492346772ded9b24f765a`

## Passed locally

| Gate | Result | Evidence |
| --- | --- | --- |
| Unit and integration tests | PASS | 72 tests: packages 23, plugins 13, desktop 34, scripts 2 |
| TypeScript | PASS | `pnpm typecheck` |
| Lint | PASS | `pnpm lint` |
| Production build | PASS | `pnpm build` |
| ContinuityBench | PASS | 12/12 scenarios; precision 1.0; stale error 0; scope leak 0; provenance 1.0; correction 1.0; continuation 1.0; deletion 1.0; duplicate injection 0 |
| Recall performance fixture | PASS | p95 0.817 ms; maximum ContextPack 506 characters |
| DSH provenance | PASS | gitlink, clean Submodule, fork origin, derivative hashes, licenses and notices |
| DSH Web parity | PASS | 129 default rows; only `ui-sidebar` replaced; `telos-ui-sidebar` and `telos-continuity` are the two explained additions |
| Source-built continuity smoke | PASS | Real DSH Web, Host RPC, Client module and Chromium UI; remember, recall, correct, candidate confirm, graph, receipts and forget |
| Packaged runtime smoke | PASS | Packaged Node ran DSH `0.1.0-rc.5`; packaged DSH Web loaded the continuity Client and returned schema 1 with SQLite integrity `ok` |
| DMG integrity | PASS | `hdiutil verify` |
| ZIP integrity | PASS | `unzip -tq` |

The Core suite includes schema migration/future-version refusal, transactional
rollback, idempotency, scope and sensitivity gates, valid time, contradictions,
prompt budgets, graph rebuild, physical deletion, recall-copy reporting, outbox
lease recovery, and four concurrent WAL writers. Credential-like content is
rejected before its source is persisted. Physical deletion removes local Recall
Pack plaintext while reporting any DSH session ranges that still require
session deletion.

## Local artifacts

| Artifact | Size | SHA-256 |
| --- | ---: | --- |
| `Telos-0.1.0-mac-arm64.dmg` | 528 MB | `2471c1f7bc49beac1050a91ad06be1b1beea0908c8ae4f63006211e334f82899` |
| `Telos-0.1.0-mac-arm64.zip` | 545 MB | `cf486cdf22c56de9dc759a286664ba50585d8979da333ac26b805442a6b6d293` |
| Unpacked `Telos.app` | 1.8 GB | generated directory, not a release checksum artifact |

## Not passed or not run

| Gate | Result | Reason |
| --- | --- | --- |
| Developer ID signing | NOT_CONFIGURED | No valid local signing identity; the local app is not a distributable signed build |
| Apple notarization | NOT_CONFIGURED | Signing/notarization secrets are absent |
| macOS x64 | NOT_RUN | Requires the native CI matrix |
| Windows x64 | NOT_RUN | Requires the native CI matrix |
| Linux x64 | NOT_RUN | Requires the native CI matrix |
| Community memory-plugin comparison | NOT_RUN | No pinned adapter currently implements the same claim, scope, provenance, correction and deletion contract |

The unsigned local artifact must not be described as a production release.
Platform-independent code gates and the current-platform package are validated;
native platform and signing claims remain open until their actual jobs pass.
