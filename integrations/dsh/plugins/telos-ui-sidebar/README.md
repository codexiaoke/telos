# Telos DSH sidebar overlay

This package is a generated derivative of DSH's MIT-licensed
`@deepseek-ai/dsh-client-ui-sidebar` client bundle. It keeps the upstream
sidebar implementation and changes only the visible wordmark, collapsed mark,
and host-controlled expanded/rail top-inset tokens. The Electron host owns the
cross-platform title-bar safe area. Do not edit `lib/client.js` manually.

Run `node scripts/build-telos-dsh-overlays.mjs` (or `pnpm dsh:build`) to
regenerate it from the DSH commit pinned by the Telos Submodule. The generator
uses exact source anchors and fails if upstream changed either branding call
site, turning an upstream UI change into an explicit sync-review item.

At desktop startup Telos copies this small package into the writable DSH Web
profile dependency directory and addresses it by package name. This follows
DSH's out-of-tree plugin resolution contract and avoids modifying the pinned
source checkout or relying on unsupported absolute-directory ESM imports.
