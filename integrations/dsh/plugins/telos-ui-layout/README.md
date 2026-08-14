# Telos DSH UI layout compatibility package

This private package makes the Telos-owned Renderer root frame available to
the DSH Client Plugin runtime. It deliberately uses the compatibility package
name `@deepseek-ai/dsh-client-ui-layout` because existing DSH UI plugins depend
on that exact module identity.

The source of the generated `lib/client.js` is under
`apps/desktop/src/renderer/src/workbench`. Do not edit the generated bundle or
publish this package. `UPSTREAM.json` records the pinned DSH source mappings,
source hashes, generated hash, and preserved Slot contract.
