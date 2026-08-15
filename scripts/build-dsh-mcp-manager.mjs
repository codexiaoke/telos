import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const repositoryRoot = resolve(import.meta.dirname, '..')
const pluginRoot = resolve(repositoryRoot, 'plugins/dsh-mcp-manager')
const outputRoot = resolve(pluginRoot, 'lib')
const manifest = JSON.parse(readFileSync(resolve(pluginRoot, 'package.json'), 'utf8'))

rmSync(outputRoot, { recursive: true, force: true })
mkdirSync(outputRoot, { recursive: true })
await build({
  entryPoints: [resolve(pluginRoot, 'src/index.ts')],
  outfile: resolve(outputRoot, 'index.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'bundle',
  external: ['node:*', '@deepseek-ai/*'],
  logLevel: 'warning',
})

const clientResult = await build({
  entryPoints: [resolve(pluginRoot, 'src/client/index.ts')],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'cjs',
  target: 'es2022',
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime'],
  define: { 'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production') },
  legalComments: 'none',
  logLevel: 'warning',
})
if (clientResult.outputFiles.length !== 1 || clientResult.outputFiles[0]?.text === undefined) {
  throw new Error(`Telos MCP manager Client build expected one output, found ${String(clientResult.outputFiles.length)}`)
}
const compiledClient = clientResult.outputFiles[0].text.replace(/^"use strict";\n/, '')
const requiredModules = [...compiledClient.matchAll(/require\(["']([^"']+)["']\)/g)].map(match => match[1])
const allowedModules = new Set(['react', 'react/jsx-runtime'])
const unexpectedModules = [...new Set(requiredModules.filter(moduleId => !allowedModules.has(moduleId)))]
if (unexpectedModules.length > 0) throw new Error(`Telos MCP manager Client has unsupported dependencies: ${unexpectedModules.join(', ')}`)
const generatedClient = [
  'window.__ModuleLoader__.load({',
  `  id: ${JSON.stringify(manifest.name)},`,
  '  factory: (require) => {',
  '    var module = { exports: {} };',
  compiledClient,
  '    return module.exports;',
  '  },',
  '});',
  '',
].join('\n')
writeFileSync(resolve(outputRoot, 'client.js'), generatedClient)
writeFileSync(resolve(outputRoot, 'BUILD.json'), `${JSON.stringify({
  package: manifest.name,
  version: manifest.version,
  dshCompatibility: '0.1.0-rc.5',
  entry: 'lib/index.js',
  clientEntry: 'lib/client.js',
}, null, 2)}\n`)
process.stdout.write('Built Telos DSH MCP manager Host and Client plugin.\n')
