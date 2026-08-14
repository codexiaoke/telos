import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dirname, '..')
const dshRoot = resolve(repositoryRoot, 'third_party/deepseek-harness')
const sourcePackage = resolve(dshRoot, 'packages/client/ui-sidebar')
const targetPackage = resolve(repositoryRoot, 'integrations/dsh/plugins/telos-ui-sidebar')
const sourceClient = resolve(sourcePackage, 'lib/client.js')
const targetLib = resolve(targetPackage, 'lib')

function replaceExactlyOnce(source, anchor, replacement, label) {
  const occurrences = source.split(anchor).length - 1
  if (occurrences !== 1) {
    throw new Error(`TELOS DSH overlay expected one ${label} anchor, found ${String(occurrences)}`)
  }
  return source.replace(anchor, replacement)
}

const upstreamId = '@deepseek-ai/dsh-client-ui-sidebar'
const telosId = '@telos/dsh-client-ui-sidebar'
const upstream = readFileSync(sourceClient, 'utf8')
let generated = upstream.replaceAll(upstreamId, telosId)

generated = replaceExactlyOnce(
  generated,
  'padding:6px var(--dsh-sidebar-inline-padding)',
  'padding:var(--telos-sidebar-top-inset,6px) var(--dsh-sidebar-inline-padding)',
  'expanded sidebar top inset',
)
generated = replaceExactlyOnce(
  generated,
  'padding:18px 10px 6px',
  'padding:var(--telos-sidebar-rail-top-inset,18px) 10px 6px',
  'collapsed sidebar top inset',
)
generated = replaceExactlyOnce(
  generated,
  'children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.BrandWordmark, {})',
  `children: (0, react_jsx_runtime.jsx)("span", {
\t\t\t\t\t\t\t\tstyle: { fontSize: "16px", lineHeight: "24px", fontWeight: 700, letterSpacing: "0.16em" },
\t\t\t\t\t\t\t\tchildren: "TELOS"
\t\t\t\t\t\t\t})`,
  'expanded wordmark',
)

generated = replaceExactlyOnce(
  generated,
  `(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FishLogo, {
\t\t\t\t\t\t\t\t\tclassName: SidebarRoot_module_css_default.railFish,
\t\t\t\t\t\t\t\t\tsize: 24
\t\t\t\t\t\t\t\t})`,
  `(0, react_jsx_runtime.jsx)("span", {
\t\t\t\t\t\t\t\t\tclassName: SidebarRoot_module_css_default.railFish,
\t\t\t\t\t\t\t\t\tstyle: { fontSize: "17px", lineHeight: "24px", fontWeight: 750 },
\t\t\t\t\t\t\t\t\tchildren: "T"
\t\t\t\t\t\t\t\t})`,
  'collapsed mark',
)

generated = generated.replace(/\n\/\/# sourceMappingURL=client\.js\.map\s*$/, '\n')
mkdirSync(targetLib, { recursive: true })
writeFileSync(resolve(targetLib, 'client.js'), generated)
copyFileSync(resolve(dshRoot, 'LICENSE'), resolve(targetPackage, 'LICENSE.upstream'))

const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dshRoot, encoding: 'utf8' }).trim()
const provenance = {
  schemaVersion: 1,
  upstream: 'https://github.com/deepseek-ai/deepseek-harness',
  commit,
  source: 'packages/client/ui-sidebar/lib/client.js',
  sourceSha256: createHash('sha256').update(upstream).digest('hex'),
  generatedSha256: createHash('sha256').update(generated).digest('hex'),
  transformations: [
    'replace module id',
    'add host-controlled expanded and collapsed sidebar top insets',
    'replace expanded wordmark',
    'replace collapsed mark',
  ],
}
writeFileSync(resolve(targetPackage, 'UPSTREAM.json'), `${JSON.stringify(provenance, null, 2)}\n`)
process.stdout.write(`Generated TELOS DSH sidebar overlay from ${commit}.\n`)

execFileSync(process.execPath, [resolve(repositoryRoot, 'scripts/build-telos-dsh-layout.mjs')], {
  cwd: repositoryRoot,
  stdio: 'inherit',
})
