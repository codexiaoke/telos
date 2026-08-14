import { accessSync, chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const repositoryRoot = resolve(import.meta.dirname, '..')
const desktopRoot = join(repositoryRoot, 'apps/desktop')
const dshRoot = join(repositoryRoot, 'third_party/deepseek-harness')
const distributionRoot = join(repositoryRoot, 'dist')
const runtimeTarget = `${process.platform}-${process.arch}`
const stageRoot = join(repositoryRoot, '.local/desktop-runtime', runtimeTarget)
const nodeRoot = join(stageRoot, 'dsh-node')
const nodeTarget = process.platform === 'win32'
  ? join(nodeRoot, 'node.exe')
  : join(nodeRoot, 'bin/node')

function run(command, args, cwd, environment = process.env) {
  const executable = process.platform === 'win32' && command === 'corepack' ? 'corepack.cmd' : command
  const result = spawnSync(executable, args, {
    cwd,
    env: environment,
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function assertSupportedNode() {
  const [major = 0, minor = 0] = process.versions.node.split('.').map(Number)
  const supported = (major === 22 && minor >= 19) || major >= 24
  if (!supported) {
    throw new Error(`DSH packaging requires Node ^22.19.0 or >=24.0.0; received ${process.version}`)
  }
  if (!/^node(?:\.exe)?$/i.test(basename(process.execPath))) {
    throw new Error(`Packaging must run under standalone Node.js, not ${process.execPath}`)
  }
}

function assertRuntimeBuilt() {
  const required = [
    join(dshRoot, 'apps/cli/lib/bin.js'),
    join(dshRoot, 'apps/web/dist/index.html'),
    join(dshRoot, 'node_modules/.pnpm'),
    join(repositoryRoot, 'integrations/dsh/plugins/telos-ui-sidebar/lib/client.js'),
    join(repositoryRoot, 'integrations/dsh/plugins/telos-ui-layout/lib/client.js'),
  ]
  for (const path of required) accessSync(path)
}

function stageStandaloneNode() {
  const allowedRoot = join(repositoryRoot, '.local/desktop-runtime')
  if (!stageRoot.startsWith(`${allowedRoot}/`) && stageRoot !== allowedRoot) {
    throw new Error(`Refusing to replace unexpected staging directory: ${stageRoot}`)
  }

  rmSync(stageRoot, { recursive: true, force: true })
  mkdirSync(dirname(nodeTarget), { recursive: true })
  copyFileSync(process.execPath, nodeTarget)
  const nodeInstallationRoot = process.platform === 'win32'
    ? dirname(process.execPath)
    : dirname(dirname(process.execPath))
  const nodeLicense = join(nodeInstallationRoot, 'LICENSE')
  accessSync(nodeLicense)
  copyFileSync(nodeLicense, join(nodeRoot, 'LICENSE'))
  if (process.platform !== 'win32') chmodSync(nodeTarget, 0o755)
  const manifest = {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    source: process.execPath,
    createdAt: new Date().toISOString(),
  }
  writeFileSync(join(nodeRoot, 'TELOS_NODE_RUNTIME.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

function packagedResourceCandidates() {
  if (!existsSync(distributionRoot)) return []
  const candidates = []
  for (const output of readdirSync(distributionRoot, { withFileTypes: true })) {
    if (!output.isDirectory()) continue
    const outputRoot = join(distributionRoot, output.name)
    if (process.platform === 'darwin' && output.name.startsWith('mac')) {
      for (const entry of readdirSync(outputRoot, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name.endsWith('.app')) {
          candidates.push(join(outputRoot, entry.name, 'Contents/Resources'))
        }
      }
    } else if (process.platform === 'win32' && output.name.startsWith('win') && output.name.endsWith('unpacked')) {
      candidates.push(join(outputRoot, 'resources'))
    } else if (process.platform === 'linux' && output.name.startsWith('linux') && output.name.endsWith('unpacked')) {
      candidates.push(join(outputRoot, 'resources'))
    }
  }
  return candidates
}

function verifyPackagedRuntime(expectedManifest) {
  const resourcesDirectory = packagedResourceCandidates().find((candidate) => {
    const manifestPath = join(candidate, 'dsh-node/TELOS_NODE_RUNTIME.json')
    if (!existsSync(manifestPath)) return false
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    return manifest.platform === expectedManifest.platform
      && manifest.arch === expectedManifest.arch
      && manifest.createdAt === expectedManifest.createdAt
  })
  if (resourcesDirectory === undefined) {
    throw new Error(`No freshly packaged ${runtimeTarget} runtime was found under ${distributionRoot}`)
  }

  const packagedDshRoot = join(resourcesDirectory, 'dsh-runtime')
  const packagedNode = process.platform === 'win32'
    ? join(resourcesDirectory, 'dsh-node/node.exe')
    : join(resourcesDirectory, 'dsh-node/bin/node')
  const packagedCli = join(packagedDshRoot, 'apps/cli/lib/bin.js')
  accessSync(join(packagedDshRoot, 'apps/web/dist/index.html'))
  accessSync(join(packagedDshRoot, 'node_modules/.pnpm'))
  accessSync(join(resourcesDirectory, 'dsh-node/LICENSE'))
  accessSync(packagedNode)
  accessSync(packagedCli)
  run(packagedNode, [packagedCli, '--version'], packagedDshRoot)
  process.stdout.write(`Verified packaged DSH runtime in ${resourcesDirectory}\n`)
}

assertSupportedNode()
assertRuntimeBuilt()
const stagedRuntimeManifest = stageStandaloneNode()

run('corepack', ['pnpm', 'build'], repositoryRoot)

const requestedArgs = process.argv.slice(2)
const directoryOnly = requestedArgs.includes('--dir')
const forwardedArgs = requestedArgs.filter(argument => argument !== '--dir')
const platformArgument = process.platform === 'darwin'
  ? '--mac'
  : process.platform === 'win32'
    ? '--win'
    : '--linux'
const builderArgs = [
  'pnpm',
  'exec',
  'electron-builder',
  '--config',
  'electron-builder.yml',
  ...(directoryOnly ? ['--dir'] : [platformArgument]),
  '--publish',
  'never',
  ...forwardedArgs,
]

run('corepack', builderArgs, desktopRoot, {
  ...process.env,
  TELOS_RUNTIME_TARGET: runtimeTarget,
})
verifyPackagedRuntime(stagedRuntimeManifest)
