import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const repositoryRoot = resolve(import.meta.dirname, '..')
const pluginRoot = resolve(repositoryRoot, 'plugins/dsh-continuity')
const outputRoot = resolve(pluginRoot, 'lib')

rmSync(outputRoot, { recursive: true, force: true })
mkdirSync(outputRoot, { recursive: true })
await build({
  entryPoints: [resolve(pluginRoot, 'src/index.ts')],
  outfile: resolve(outputRoot, 'index.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: false,
  packages: 'bundle',
  external: ['node:*', '@deepseek-ai/*'],
  logLevel: 'warning',
})

const manifest = JSON.parse(readFileSync(resolve(pluginRoot, 'package.json'), 'utf8'))
writeFileSync(resolve(outputRoot, 'BUILD.json'), `${JSON.stringify({
  package: manifest.name,
  version: manifest.version,
  dshCompatibility: '0.1.0-rc.5',
  entry: 'lib/index.js',
}, null, 2)}\n`)
process.stdout.write('Built Telos DSH continuity Host plugin.\n')
