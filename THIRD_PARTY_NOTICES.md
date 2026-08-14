# Third-party notices

## Node.js runtime

Desktop distributions include a standalone Node.js executable exclusively for
the pinned DSH child runtime. The exact Node.js version and source executable
are recorded in `resources/dsh-node/TELOS_NODE_RUNTIME.json`, and the Node.js
license distributed with that executable is copied to
`resources/dsh-node/LICENSE`.

## DeepSeek Harness

`third_party/deepseek-harness` is a Git Submodule of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), maintained through the [codexiaoke fork](https://github.com/codexiaoke/deepseek-harness).

- Pinned source commit: `47f943859bef60e4160492346772ded9b24f765a`
- Version at adoption: `0.1.0-rc.5`
- License: MIT
- License file: `third_party/deepseek-harness/LICENSE`

`integrations/dsh/plugins/telos-ui-sidebar/lib/client.js` is a generated
derivative of DSH's `@deepseek-ai/dsh-client-ui-sidebar` bundle at that pinned
commit. Its `UPSTREAM.json` records source and generated hashes, and
`LICENSE.upstream` carries the license text. The generation changes only the
module identity, a host-controlled window-chrome inset, and the
expanded/collapsed brand marks.

`apps/desktop/src/renderer/src/workbench` and the generated private compatibility
package at `integrations/dsh/plugins/telos-ui-layout` derive the root Slot,
panel-state, theme-presentation, and three-column concession contracts from
DSH's `@deepseek-ai/dsh-client-ui-layout` sources at the same pinned commit.
Telos owns the resulting React structure and presentation while preserving the
DSH package identity and child Slot contract. `UPSTREAM.json` records each
source mapping and hash; `LICENSE.upstream` carries the MIT license text. The
compatibility package is private and must not be published as an upstream DSH
artifact.

## thinking-orbs

Portions of `apps/desktop/src/renderer/src/components/agent-orb/orbEngine.ts` are derived from the geometry and projection approach in [thinking-orbs](https://github.com/Jakubantalik/thinking-orbs) by Jakub Antalik.

- Source commit: `e04f3e87075faa6dd7d42f3073198434d26ba730`
- License: MIT
- Local license copy: `licenses/thinking-orbs-MIT.txt`

The code has been rewritten and reduced for Telos. Telos does not depend on the `thinking-orbs` npm package.
