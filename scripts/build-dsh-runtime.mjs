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

run(['install', '--frozen-lockfile'])
run(['run', 'build:lib:host'])

accessSync(resolve(dshRoot, 'packages/sdk/client/lib/index.js'))
accessSync(resolve(dshRoot, 'packages/examples/jsonrpc-demo/lib/packaged-bin.js'))
process.stdout.write('DSH source runtime is built and ready.\n')
