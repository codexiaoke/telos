# DSH upstream synchronization runbook

TELOS treats DeepSeek Harness as pinned product source, not as a floating npm
dependency. An upstream update is therefore an explicit product-baseline
change. This runbook preserves the complete DSH Web feature set while keeping
TELOS presentation and future personal-intelligence domains outside the
Submodule.

## What is authoritative

- `.gitmodules` records the TELOS fork used to clone the Submodule.
- The parent repository gitlink records the exact accepted DSH commit.
- `third_party/deepseek-harness` must remain clean during ordinary TELOS work.
- `integrations/dsh/plugins/telos-ui-sidebar/UPSTREAM.json` records the source
  commit and hashes for the only current derived client component.
- `integrations/dsh/plugins/telos-ui-sidebar/telos.web.patch.yml` is the exact
  plugin-roster delta consumed by Electron and the parity audit.
- `THIRD_PARTY_NOTICES.md` records source and license provenance.

Do not copy a new DSH Web tree into TELOS and do not edit the Submodule as part
of a TELOS feature. A generic DSH correction belongs in the DSH fork and should
be proposed upstream. A temporary fork-only patch must retain its own commit
history and rationale.

## 1. Detect drift without changing the workspace

From the TELOS repository root, run:

```bash
pnpm dsh:upstream
```

`UP_TO_DATE` means the accepted gitlink equals canonical upstream `master` at
the time of the check. `UPDATE_AVAILABLE` is informational: the command does
not fetch, merge, check out, regenerate, or commit anything.

## 2. Prepare an isolated upgrade

Create a dedicated TELOS branch. In the Submodule, keep `origin` pointed to
`codexiaoke/deepseek-harness` and configure the canonical remote if needed:

```bash
git -C third_party/deepseek-harness remote add upstream https://github.com/deepseek-ai/deepseek-harness.git
git -C third_party/deepseek-harness fetch upstream master
```

If `upstream` already exists, verify its URL and fetch it. Inspect the candidate
commit before checking it out. Advance the fork branch with fast-forward-only
history where possible; never rewrite a shared DSH branch merely to simplify a
TELOS update.

Review the old-to-candidate diff in at least these areas:

- `apps/web` and `apps/cli`;
- `packages/bundle/web-app` and the default Web profile;
- `packages/client`;
- `packages/api/remotes`;
- `packages/host/apiproxy`;
- agent presets, session events, projections, tools, permissions, questions,
  goals, plans, jobs, subagents, deliverables, settings, and workspace behavior.

Classify each relevant change as untouched reuse, token/style impact,
adapted-source merge, Remote/projection/session-contract impact, new plugin, or
removed/renamed plugin. Plugin-roster and runtime-contract changes always
require explicit review.

Only then check out the chosen candidate in the Submodule and stage that
gitlink with `git add third_party/deepseek-harness` (staging is not committing).
The audit compares the parent index with the checked-out commit so that the
candidate can pass every gate before its final commit. The Submodule itself
must contain no uncommitted files.

## 3. Regenerate the reviewed derivative

Run:

```bash
pnpm dsh:build
```

The build compiles the complete DSH Host, client packages, CLI, and Web app,
then regenerates the TELOS sidebar from the candidate DSH bundle. Its transforms
use exact anchors and fail loudly when upstream presentation code moved. A
failure is a required manual merge, not a reason to weaken or bypass the check.

Review the generated sidebar diff. Update `THIRD_PARTY_NOTICES.md` when the
commit or upstream version changes. Do not hand-edit `UPSTREAM.json`; successful
generation owns its commit and hashes.

## 4. Prove composition and repository integrity

Run:

```bash
pnpm dsh:verify
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

The parity audit dynamically obtains the candidate commit's default Web
composition from DSH itself. It verifies that TELOS retains every default row
unchanged, except for disabling `ui-sidebar`, and adds only the enabled
`telos-ui-sidebar` compatibility package. This avoids maintaining a stale,
handwritten copy of DSH's roster.

Structural parity is necessary but not sufficient. Run DSH tests for every
changed or adapted package and perform a full Electron smoke check:

1. DSH starts on loopback and the complete three-column workbench loads.
2. Workspace, session, settings, model, permission, question, plan, job,
   subagent, deliverable, tool, and trajectory surfaces remain reachable when
   their prerequisites are present.
3. With a locally configured credential, create a real Web session, stream one
   answer, resume the session, and observe activity/tool state.
4. Verify startup failure, reload, and graceful application shutdown behavior.

Record unavailable paid/provider/platform checks as `NOT_RUN` or `BLOCKED`;
never turn a structural audit, Mock, or documentation claim into production
evidence.

## 5. Accept the new baseline

Commit the DSH gitlink, regenerated derivative, provenance, notices, required
compatibility changes, and acceptance evidence as one standalone DSH-upgrade
batch. Do not mix unrelated TELOS features into it. The candidate becomes the
new baseline only after all applicable gates pass and the diff has been
reviewed.

An update appearing upstream does not by itself mean TELOS still has every DSH
function. The accepted guarantee is always scoped to one exact candidate
commit, its effective composition, its build and tests, and its recorded live
smoke evidence.
