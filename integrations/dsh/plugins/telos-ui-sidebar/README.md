# TELOS DSH sidebar overlay

This package is a generated derivative of DSH's MIT-licensed
`@deepseek-ai/dsh-client-ui-sidebar` client bundle. It keeps the upstream
sidebar implementation and changes only the visible wordmark, collapsed mark,
host-controlled expanded/rail top-inset tokens, and the macOS title-row button
hit regions. Do not edit `lib/client.js` manually.

Run `node scripts/build-telos-dsh-overlays.mjs` (or `pnpm dsh:build`) to
regenerate it from the DSH commit pinned by the TELOS Submodule. The generator
uses exact source anchors and fails if upstream changed either branding call
site, turning an upstream UI change into an explicit sync-review item.

At desktop startup TELOS copies this small package into the writable DSH Web
profile dependency directory and addresses it by package name. This follows
DSH's out-of-tree plugin resolution contract and avoids modifying the pinned
source checkout or relying on unsupported absolute-directory ESM imports.
