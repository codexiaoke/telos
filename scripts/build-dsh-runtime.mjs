import { accessSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const repositoryRoot = resolve(import.meta.dirname, '..')
const dshRoot = resolve(repositoryRoot, 'third_party/deepseek-harness')

accessSync(resolve(dshRoot, 'pnpm-lock.yaml'))

function run(args) {
  const result = spawnSync('corepack', ['pnpm', ...args], {
    cwd: dshRoot,
    env: process.env,
    stdio: 'inherit',
  })

  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

// DSH's root postinstall configures contributor Git hooks. A Submodule shares
// its Git metadata with the parent repository, so Telos skips lifecycle scripts
// during restore and rebuilds only the reviewed native dependencies required by
// the source build/runtime.
run(['install', '--frozen-lockfile', '--ignore-scripts'])
run(['--config.verify-deps-before-run=false', 'rebuild', 'esbuild', 'node-pty', 'koffi', '@deepseek-ai/dsh-subprocess-local'])
// The desktop's primary interactive path is the complete DSH Web application,
// so a valid runtime build must contain host libraries, browser-side client
// bundles, and the frontend dist. The headless SDK adapter uses a subset of the
// same source build and remains covered by the artifact checks below.
run(['--config.verify-deps-before-run=false', 'run', 'build'])

const overlayBuild = spawnSync(process.execPath, [resolve(repositoryRoot, 'scripts/build-telos-dsh-overlays.mjs')], {
  cwd: repositoryRoot,
  env: process.env,
  stdio: 'inherit',
})
if (overlayBuild.error) throw overlayBuild.error
if (overlayBuild.status !== 0) process.exit(overlayBuild.status ?? 1)

const continuityBuild = spawnSync('corepack', ['pnpm', '--filter', '@telos/dsh-continuity', 'build'], {
  cwd: repositoryRoot,
  env: process.env,
  stdio: 'inherit',
})
if (continuityBuild.error) throw continuityBuild.error
if (continuityBuild.status !== 0) process.exit(continuityBuild.status ?? 1)

const workbenchBuild = spawnSync('corepack', ['pnpm', '--filter', '@telos/dsh-workbench-files', 'build'], {
  cwd: repositoryRoot,
  env: process.env,
  stdio: 'inherit',
})
if (workbenchBuild.error) throw workbenchBuild.error
if (workbenchBuild.status !== 0) process.exit(workbenchBuild.status ?? 1)

accessSync(resolve(dshRoot, 'packages/sdk/client/lib/index.js'))
accessSync(resolve(dshRoot, 'packages/examples/jsonrpc-demo/lib/bin.js'))
accessSync(resolve(dshRoot, 'python/sdk-runtime/node_modules/@deepseek-ai/dsh-sdk-jsonrpc-server'))
accessSync(resolve(dshRoot, 'apps/cli/lib/bin.js'))
accessSync(resolve(dshRoot, 'apps/web/dist/index.html'))
accessSync(resolve(repositoryRoot, 'integrations/dsh/plugins/telos-ui-sidebar/lib/client.js'))
accessSync(resolve(repositoryRoot, 'integrations/dsh/plugins/telos-ui-sidebar/telos.web.patch.yml'))
accessSync(resolve(repositoryRoot, 'integrations/dsh/plugins/telos-ui-layout/lib/client.js'))
accessSync(resolve(repositoryRoot, 'integrations/dsh/plugins/telos-ui-layout/UPSTREAM.json'))
accessSync(resolve(repositoryRoot, 'plugins/dsh-continuity/lib/index.js'))
accessSync(resolve(repositoryRoot, 'plugins/dsh-continuity/lib/client.js'))
accessSync(resolve(repositoryRoot, 'plugins/dsh-continuity/lib/BUILD.json'))
accessSync(resolve(repositoryRoot, 'plugins/dsh-workbench-files/lib/index.js'))
accessSync(resolve(repositoryRoot, 'plugins/dsh-workbench-files/lib/BUILD.json'))
process.stdout.write('DSH source runtime and complete Web application are built and ready.\n')
