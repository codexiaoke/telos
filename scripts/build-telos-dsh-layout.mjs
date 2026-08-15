import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const repositoryRoot = resolve(import.meta.dirname, '..')
const dshRoot = resolve(repositoryRoot, 'third_party/deepseek-harness')
const targetRoot = resolve(repositoryRoot, 'integrations/dsh/plugins/telos-ui-layout')
const targetLib = resolve(targetRoot, 'lib')
const compatibilityId = '@deepseek-ai/dsh-client-ui-layout'
const entry = 'apps/desktop/src/renderer/src/workbench/dsh-client.ts'

const sourceMappings = [
  {
    upstream: 'packages/client/ui-layout/src/client/index.ts',
    telos: entry,
  },
  {
    upstream: 'packages/client/ui-layout/src/client/AppFrame.tsx',
    telos: 'apps/desktop/src/renderer/src/workbench/shell/TelosAppFrame.tsx',
  },
  {
    upstream: 'packages/client/ui-layout/src/client/AppFrame.module.css',
    telos: 'apps/desktop/src/renderer/src/workbench/shell/layout-styles.ts',
  },
  {
    upstream: 'packages/client/ui-layout/src/client/columns.ts',
    telos: 'apps/desktop/src/renderer/src/workbench/shell/layout-model.ts',
  },
  {
    upstream: 'packages/client/ui-layout/src/client/stores.ts',
    telos: 'apps/desktop/src/renderer/src/workbench/shell/layout-store.ts',
  },
  {
    upstream: 'packages/client/ui-layout/src/client/service.ts',
    telos: 'apps/desktop/src/renderer/src/workbench/shell/layout-controller.ts',
  },
  {
    upstream: 'packages/client/ui-layout/src/client/theme-presenter.ts',
    telos: 'apps/desktop/src/renderer/src/workbench/shell/theme-presenter.ts',
  },
]

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

const result = await build({
  absWorkingDir: repositoryRoot,
  entryPoints: [entry],
  bundle: true,
  write: false,
  outfile: 'telos-ui-layout.js',
  format: 'cjs',
  platform: 'browser',
  target: ['es2022'],
  jsx: 'automatic',
  minify: true,
  loader: {
    '.svg': 'dataurl',
    '.ttf': 'dataurl',
  },
  external: [
    'react',
    'react/jsx-runtime',
    '@deepseek-ai/dsh-client-runtime/client',
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },
  legalComments: 'none',
  logLevel: 'warning',
})

const javascriptOutput = result.outputFiles.find(output => output.path.endsWith('.js'))
const cssOutput = result.outputFiles.find(output => output.path.endsWith('.css'))
if (javascriptOutput?.text === undefined || result.outputFiles.some(output => !output.path.endsWith('.js') && !output.path.endsWith('.css'))) {
  throw new Error(`Telos layout build expected JavaScript and optional CSS outputs, found ${String(result.outputFiles.length)}`)
}

const compiled = javascriptOutput.text
const bundledCss = cssOutput?.text
const requiredModules = [...compiled.matchAll(/require\(["']([^"']+)["']\)/g)].map(match => match[1])
const allowedModules = new Set([
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/dsh-client-runtime/client',
])
const unexpectedModules = [...new Set(requiredModules.filter(moduleId => !allowedModules.has(moduleId)))]
if (unexpectedModules.length > 0) {
  throw new Error(`Telos layout bundle has unsupported module-table dependencies: ${unexpectedModules.join(', ')}`)
}
for (const required of allowedModules) {
  if (!requiredModules.includes(required)) {
    throw new Error(`Telos layout bundle does not externalize required module ${required}`)
  }
}
if (compiled.includes('react.production.min') || compiled.includes('react.development.js')) {
  throw new Error('Telos layout bundle contains a private React copy')
}

const generated = [
  'window.__ModuleLoader__.load({',
  `  id: ${JSON.stringify(compatibilityId)},`,
  '  factory: (require) => {',
  '    var module = { exports: {} };',
  '    var exports = module.exports;',
  ...(bundledCss === undefined ? [] : [
    `    var bundledCss = ${JSON.stringify(bundledCss)};`,
    '    document.querySelector(\'style[data-telos-owner="@telos/renderer/editor-dependencies"]\')?.remove();',
    '    var bundledStyle = document.createElement("style");',
    '    bundledStyle.dataset.telosOwner = "@telos/renderer/editor-dependencies";',
    '    bundledStyle.textContent = bundledCss;',
    '    document.head.append(bundledStyle);',
  ]),
  compiled,
  '    return module.exports;',
  '  },',
  '});',
  '',
].join('\n')

mkdirSync(targetLib, { recursive: true })
writeFileSync(resolve(targetLib, 'client.js'), generated)
copyFileSync(resolve(dshRoot, 'LICENSE'), resolve(targetRoot, 'LICENSE.upstream'))

const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dshRoot, encoding: 'utf8' }).trim()
const provenance = {
  schemaVersion: 2,
  upstream: 'https://github.com/deepseek-ai/deepseek-harness',
  commit,
  compatibilityPackage: compatibilityId,
  sourceMappings: sourceMappings.map((mapping) => {
    const upstreamSource = readFileSync(resolve(dshRoot, mapping.upstream))
    const telosSource = readFileSync(resolve(repositoryRoot, mapping.telos))
    return {
      ...mapping,
      upstreamSha256: sha256(upstreamSource),
      telosSha256: sha256(telosSource),
    }
  }),
  generated: 'integrations/dsh/plugins/telos-ui-layout/lib/client.js',
  generatedSha256: sha256(generated),
  externalModules: [...allowedModules],
  preservedSlots: {
    sidebar: { kind: 'single', scope: 'root' },
    conversation: { kind: 'single', scope: 'session-maybe' },
    details: { kind: 'single', scope: 'session' },
    'shell.overlay': { kind: 'list', scope: 'root' },
  },
  preservedLayoutService: ['toggleSidebar', 'openDetails', 'closeDetails'],
}
writeFileSync(resolve(targetRoot, 'UPSTREAM.json'), `${JSON.stringify(provenance, null, 2)}\n`)
process.stdout.write(`Built Telos Renderer layout compatibility bundle from ${commit}.\n`)
