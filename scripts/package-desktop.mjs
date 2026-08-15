import { accessSync, chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

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
    join(repositoryRoot, 'plugins/dsh-continuity/lib/index.js'),
    join(repositoryRoot, 'plugins/dsh-continuity/lib/client.js'),
    join(repositoryRoot, 'plugins/dsh-continuity/lib/BUILD.json'),
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

function installSmokePackage(sourceRoot, modulesRoot, packageName) {
  const target = join(modulesRoot, ...packageName.split('/'))
  mkdirSync(dirname(target), { recursive: true })
  cpSync(sourceRoot, target, { recursive: true, force: true })
}

function waitForWebReady(child, output) {
  return new Promise((resolveReady, reject) => {
    const timer = setTimeout(() => reject(new Error(`Packaged DSH Web timed out.\n${output.value}`)), 30_000)
    const consume = (chunk) => {
      output.value += chunk.toString()
      const match = /dsh web: (http:\/\/127\.0\.0\.1:\d+)/.exec(output.value)
      if (match?.[1] === undefined) return
      clearTimeout(timer)
      resolveReady(match[1])
    }
    child.stdout.on('data', consume)
    child.stderr.on('data', consume)
    child.once('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`Packaged DSH Web exited early with ${String(code)}.\n${output.value}`))
    })
  })
}

async function smokePackagedDshWeb(resourcesDirectory, packagedDshRoot, packagedNode, packagedCli) {
  const temporaryHomeRoot = mkdtempSync(join(tmpdir(), 'telos-packaged-dsh-smoke-'))
  const profileModules = join(temporaryHomeRoot, 'profiles/web/node_modules')
  const patchPath = join(resourcesDirectory, 'dsh-overlays/telos-ui-sidebar/telos.web.patch.yml')
  let child
  try {
    installSmokePackage(join(resourcesDirectory, 'dsh-overlays/telos-ui-sidebar'), profileModules, '@telos/dsh-client-ui-sidebar')
    installSmokePackage(join(resourcesDirectory, 'dsh-overlays/telos-ui-layout'), profileModules, '@deepseek-ai/dsh-client-ui-layout')
    installSmokePackage(join(resourcesDirectory, 'dsh-overlays/telos-continuity'), profileModules, '@telos/dsh-continuity')
    const output = { value: '' }
    child = spawn(packagedNode, [packagedCli, 'web', '--patch', patchPath, '--port', '0'], {
      cwd: packagedDshRoot,
      env: { ...process.env, DSH_HOME: temporaryHomeRoot, DSH_TELEMETRY_DISABLED: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const baseUrl = await waitForWebReady(child, output)
    const indexResponse = await fetch(baseUrl, { signal: AbortSignal.timeout(5_000) })
    const indexHtml = await indexResponse.text()
    if (!indexResponse.ok || !indexHtml.includes('"@telos/dsh-continuity"')) {
      throw new Error(`Packaged DSH Web omitted the continuity Client module (${String(indexResponse.status)})`)
    }
    const response = await fetch(`${baseUrl}/telos-continuity/health`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(5_000),
      body: JSON.stringify({
        type: 'client-request',
        rpcId: `packaged-continuity-${randomUUID()}`,
        method: 'health',
        payload: {},
      }),
    })
    const body = await response.json()
    if (!response.ok || body.result?.ok !== true || body.result.value?.integrity !== 'ok') {
      throw new Error(`Packaged continuity health failed (${String(response.status)}): ${JSON.stringify(body)}`)
    }
    process.stdout.write(`Started packaged DSH Web with continuity schema ${String(body.result.value.schemaVersion)}\n`)
  } finally {
    if (child !== undefined && child.exitCode === null) {
      const exited = new Promise(resolveExit => child.once('exit', resolveExit))
      child.kill('SIGTERM')
      await Promise.race([exited, new Promise(resolveTimeout => setTimeout(resolveTimeout, 5_000))])
      if (child.exitCode === null) child.kill('SIGKILL')
    }
    rmSync(temporaryHomeRoot, { recursive: true, force: true })
  }
}

async function verifyPackagedRuntime(expectedManifest) {
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
  accessSync(join(resourcesDirectory, 'dsh-overlays/telos-ui-sidebar/telos.web.patch.yml'))
  accessSync(join(resourcesDirectory, 'dsh-overlays/telos-ui-layout/lib/client.js'))
  accessSync(join(resourcesDirectory, 'dsh-overlays/telos-continuity/lib/index.js'))
  accessSync(join(resourcesDirectory, 'dsh-overlays/telos-continuity/lib/client.js'))
  accessSync(packagedNode)
  accessSync(packagedCli)
  run(packagedNode, [packagedCli, '--version'], packagedDshRoot)
  await smokePackagedDshWeb(resourcesDirectory, packagedDshRoot, packagedNode, packagedCli)
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
await verifyPackagedRuntime(stagedRuntimeManifest)
