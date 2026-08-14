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
const telosVersion = JSON.parse(readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8')).version

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
  '--dsh-sidebar-inline-padding:12px',
  '--dsh-sidebar-inline-padding:16px',
  'sidebar inline rhythm',
)
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
  'font-size:14px;display:flex}',
  'font-size:14px;display:flex;position:relative}',
  'sidebar positioning context',
)
generated = replaceExactlyOnce(
  generated,
  'box-sizing:border-box;flex:none;justify-content:flex-end;align-items:center;gap:8px;height:60px;margin-bottom:8px;padding:8px 0 8px 4px;display:flex;overflow:hidden',
  'box-sizing:border-box;flex:none;align-items:center;height:82px;margin-bottom:4px;padding:0;display:flex;position:relative;overflow:visible;-webkit-app-region:drag',
  'sidebar titlebar layout',
)
generated = replaceExactlyOnce(
  generated,
  'min-width:0;color:inherit;cursor:pointer;background:0 0;border:none;flex:1;align-items:center;padding:0;display:inline-flex;overflow:hidden',
  'min-width:0;height:28px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;align-items:baseline;padding:0;display:inline-flex;position:absolute;left:8px;bottom:0;overflow:visible;cursor:default;user-select:none',
  'sidebar product metadata',
)
generated = replaceExactlyOnce(
  generated,
  'border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex',
  'border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex;-webkit-app-region:no-drag',
  'sidebar icon hit regions',
)
generated = replaceExactlyOnce(
  generated,
  '.cC57AW_iconButton:hover{',
  '.cC57AW_logoRow .cC57AW_toggle{position:absolute;z-index:7;top:12px;right:80px}.cC57AW_iconButton:hover{',
  'sidebar titlebar toggle position',
)
generated = replaceExactlyOnce(
  generated,
  'box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-button-elevated-fill);height:38px;color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:12px;flex:none;justify-content:center;align-items:center;gap:6px;margin:0 2px 8px;padding:8px 16px;font-size:14px;font-weight:500;line-height:22px;display:flex;overflow:hidden',
  'box-sizing:border-box;border:0;background:transparent;height:44px;color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:12px;flex:none;justify-content:flex-start;align-items:center;gap:10px;margin:0 0 10px;padding:0 12px;font-size:16px;font-weight:500;line-height:22px;display:flex;overflow:hidden;-webkit-app-region:no-drag',
  'flat new-session row',
)
generated = replaceExactlyOnce(
  generated,
  'background:var(--dsw-alias-button-floating-hover)',
  'background:var(--dsw-alias-interactive-bg-hover)',
  'new-session hover surface',
)
generated = replaceExactlyOnce(
  generated,
  'padding-left:4px;display:flex;overflow:hidden',
  'padding-left:4px;display:flex;overflow:visible',
  'workspace titlebar overflow',
)

generated = replaceExactlyOnce(
  generated,
  `wide && (0, react_jsx_runtime.jsx)("button", {
\t\t\t\t\t\t\ttype: "button",
\t\t\t\t\t\t\tclassName: clsx(SidebarRoot_module_css_default.brand, SidebarRoot_module_css_default.wide),
\t\t\t\t\t\t\t"aria-label": t("session.new.label"),
\t\t\t\t\t\t\tonClick: () => {
\t\t\t\t\t\t\t\tstartSession();
\t\t\t\t\t\t\t},
\t\t\t\t\t\t\tchildren: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.BrandWordmark, {})
\t\t\t\t\t\t})`,
  `wide && (0, react_jsx_runtime.jsx)("div", {
\t\t\t\t\t\t\tclassName: clsx(SidebarRoot_module_css_default.brand, SidebarRoot_module_css_default.wide),
\t\t\t\t\t\t\t"aria-label": "TELOS v${telosVersion}",
\t\t\t\t\t\t\tchildren: (0, react_jsx_runtime.jsxs)("span", {
\t\t\t\t\t\t\t\tstyle: { display: "inline-flex", alignItems: "baseline", gap: "6px" },
\t\t\t\t\t\t\t\tchildren: [(0, react_jsx_runtime.jsx)("span", {
\t\t\t\t\t\t\t\t\tstyle: { fontSize: "16px", lineHeight: "22px", fontWeight: 650, letterSpacing: "-0.01em" },
\t\t\t\t\t\t\t\t\tchildren: "TELOS"
\t\t\t\t\t\t\t\t}), (0, react_jsx_runtime.jsx)("span", {
\t\t\t\t\t\t\t\t\tstyle: { fontSize: "13px", lineHeight: "18px", fontWeight: 450 },
\t\t\t\t\t\t\t\t\tchildren: "v${telosVersion}"
\t\t\t\t\t\t\t\t})]
\t\t\t\t\t\t\t})
\t\t\t\t\t\t})`,
  'expanded product metadata',
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
    'adopt compact WorkBuddy-style sidebar spacing',
    'add host-controlled expanded and collapsed sidebar top insets',
    'turn the expanded logo row into a productive draggable titlebar',
    'keep sidebar titlebar controls interactive',
    'replace the new-session card with a flat navigation row',
    'replace the expanded wordmark button with product metadata',
    'replace collapsed mark',
  ],
}
writeFileSync(resolve(targetPackage, 'UPSTREAM.json'), `${JSON.stringify(provenance, null, 2)}\n`)
process.stdout.write(`Generated TELOS DSH sidebar overlay from ${commit}.\n`)

execFileSync(process.execPath, [resolve(repositoryRoot, 'scripts/build-telos-dsh-layout.mjs')], {
  cwd: repositoryRoot,
  stdio: 'inherit',
})
