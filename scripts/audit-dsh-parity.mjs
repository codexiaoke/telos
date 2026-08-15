import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'

const repositoryRoot = resolve(import.meta.dirname, '..')
const dshRoot = resolve(repositoryRoot, 'third_party/deepseek-harness')
const dshCli = resolve(dshRoot, 'apps/cli/lib/bin.js')
const sidebarRoot = resolve(repositoryRoot, 'integrations/dsh/plugins/telos-ui-sidebar')
const layoutRoot = resolve(repositoryRoot, 'integrations/dsh/plugins/telos-ui-layout')
const continuityRoot = resolve(repositoryRoot, 'plugins/dsh-continuity')
const patchPath = resolve(sidebarRoot, 'telos.web.patch.yml')
const temporaryRoot = mkdtempSync(join(tmpdir(), 'telos-dsh-parity-'))

const require = createRequire(resolve(dshRoot, 'package.json'))
const yaml = require('js-yaml')
const javascriptType = new yaml.Type('tag:yaml.org,2002:js', {
  kind: 'scalar',
  construct: (source) => ({ javascriptSource: source }),
})
const schema = yaml.DEFAULT_SCHEMA.extend([javascriptType])

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function dumpConfig(arguments_) {
  return execFileSync(process.execPath, [dshCli, 'web', ...arguments_], {
    cwd: dshRoot,
    env: {
      ...process.env,
      DSH_HOME: resolve(temporaryRoot, 'home'),
    },
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
}

function parseRows(source, label) {
  const parsed = yaml.load(source, { schema })
  assert(Array.isArray(parsed), `${label} is not a YAML row array`)
  for (const row of parsed) {
    assert(row !== null && typeof row === 'object', `${label} contains a non-object row`)
    assert(typeof row.id === 'string' && row.id.length > 0, `${label} contains a row without an id`)
  }
  const ids = parsed.map((row) => row.id)
  assert(new Set(ids).size === ids.length, `${label} contains duplicate row ids`)
  return parsed
}

function mapRows(rows) {
  return new Map(rows.map((row) => [row.id, row]))
}

try {
  for (const artifact of [
    dshCli,
    resolve(dshRoot, 'apps/web/dist/index.html'),
    resolve(dshRoot, 'packages/client/ui-sidebar/lib/client.js'),
    resolve(sidebarRoot, 'package.json'),
    resolve(sidebarRoot, 'lib/client.js'),
    resolve(layoutRoot, 'package.json'),
    resolve(layoutRoot, 'lib/client.js'),
    resolve(layoutRoot, 'UPSTREAM.json'),
    resolve(continuityRoot, 'package.json'),
    resolve(continuityRoot, 'lib/index.js'),
    resolve(continuityRoot, 'lib/client.js'),
    resolve(continuityRoot, 'lib/BUILD.json'),
    patchPath,
  ]) {
    assert(existsSync(artifact), `required full-Web artifact is missing: ${artifact}`)
  }

  const defaultRows = parseRows(dumpConfig(['--dump-default-config']), 'default DSH Web config')
  const effectiveRows = parseRows(
    dumpConfig(['--patch', patchPath, '--dump-config']),
    'Telos effective DSH Web config',
  )
  const defaultById = mapRows(defaultRows)
  const effectiveById = mapRows(effectiveRows)

  const layoutRow = effectiveById.get('ui-layout')
  assert(layoutRow?.name === '@deepseek-ai/dsh-client-ui-layout', 'ui-layout package identity changed')
  const layoutManifest = JSON.parse(readFileSync(resolve(layoutRoot, 'package.json'), 'utf8'))
  assert(layoutManifest.name === layoutRow.name, 'layout compatibility manifest does not match the DSH row')
  assert(layoutManifest.private === true, 'layout compatibility package must stay private')
  assert(
    isDeepStrictEqual(layoutManifest.dsh?.client?.inject, [
      '@deepseek-ai/dsh-client-runtime',
      '@deepseek-ai/dsh-client-ui-theme',
    ]),
    'layout compatibility package changed its DSH client dependency edges',
  )

  const profileRoot = resolve(temporaryRoot, 'profile-resolution')
  const installedLayout = resolve(profileRoot, 'node_modules/@deepseek-ai/dsh-client-ui-layout')
  const installedContinuity = resolve(profileRoot, 'node_modules/@telos/dsh-continuity')
  mkdirSync(resolve(profileRoot, 'node_modules/@deepseek-ai'), { recursive: true })
  mkdirSync(resolve(profileRoot, 'node_modules/@telos'), { recursive: true })
  cpSync(layoutRoot, installedLayout, { recursive: true })
  cpSync(continuityRoot, installedContinuity, { recursive: true })
  const profileAnchor = resolve(profileRoot, 'cordis.yml')
  writeFileSync(profileAnchor, '')
  const profileRequire = createRequire(profileAnchor)
  const resolvedLayoutManifest = profileRequire.resolve('@deepseek-ai/dsh-client-ui-layout/package.json')
  assert(
    realpathSync(resolvedLayoutManifest) === realpathSync(resolve(installedLayout, 'package.json')),
    `Profile-local layout derivative does not win package resolution: ${resolvedLayoutManifest}`,
  )
  const resolvedContinuityManifest = profileRequire.resolve('@telos/dsh-continuity/package.json')
  assert(
    realpathSync(resolvedContinuityManifest) === realpathSync(resolve(installedContinuity, 'package.json')),
    `Profile-local continuity plugin does not win package resolution: ${resolvedContinuityManifest}`,
  )

  const requiredSurfaceIds = [
    'modules',
    'connection',
    'api-remotes',
    'client-runtime',
    'ui-layout',
    'ui-sidebar',
    'ui-settings',
    'ui-conversation',
    'ui-tool',
    'ui-workspace',
    'ui-subagent',
    'ui-jobs',
    'ui-goal',
    'ui-model-selection',
    'ui-permission',
    'ui-plan',
    'ui-user-questions',
    'ui-trajectory',
  ]
  for (const id of requiredSurfaceIds) {
    assert(defaultById.has(id), `pinned DSH default Web config is missing required surface ${id}`)
    assert(effectiveById.has(id), `Telos effective Web config removed required surface ${id}`)
  }

  const upstreamSidebar = defaultById.get('ui-sidebar')
  const effectiveSidebar = effectiveById.get('ui-sidebar')
  assert(upstreamSidebar !== undefined, 'default DSH Web config has no ui-sidebar row')
  assert(effectiveSidebar !== undefined, 'Telos effective config has no ui-sidebar row')
  assert(
    isDeepStrictEqual(effectiveSidebar, { ...upstreamSidebar, disabled: true }),
    'the upstream ui-sidebar row changed beyond the declared disabled flag',
  )

  for (const row of defaultRows) {
    if (row.id === 'ui-sidebar') continue
    assert(effectiveById.has(row.id), `Telos effective config removed ${row.id}`)
    assert(
      isDeepStrictEqual(effectiveById.get(row.id), row),
      `Telos effective config unexpectedly changed ${row.id}`,
    )
  }

  const addedIds = effectiveRows
    .map((row) => row.id)
    .filter((id) => !defaultById.has(id))
  assert(
    isDeepStrictEqual(addedIds, ['telos-ui-sidebar', 'telos-continuity']),
    `unexpected Telos-only rows: ${addedIds.join(', ')}`,
  )
  const telosSidebar = effectiveById.get('telos-ui-sidebar')
  assert(telosSidebar.name === '@telos/dsh-client-ui-sidebar', 'Telos sidebar package name changed')
  assert(telosSidebar.disabled !== true, 'Telos sidebar replacement is disabled')
  const telosContinuity = effectiveById.get('telos-continuity')
  assert(telosContinuity?.name === '@telos/dsh-continuity', 'Telos continuity package name changed')
  assert(telosContinuity.disabled !== true, 'Telos continuity plugin is disabled')
  assert(
    isDeepStrictEqual(telosContinuity.config, {
      databasePath: { javascriptSource: "dshHomePath('telos', 'personal-continuity.sqlite')" },
      maxRecallClaims: 8,
      maxRecallChars: 2400,
      graphDepth: 2,
      captureTurnSources: true,
      queueInference: true,
    }),
    'Telos continuity bounded runtime configuration changed',
  )
  const continuityManifest = JSON.parse(readFileSync(resolve(continuityRoot, 'package.json'), 'utf8'))
  assert(continuityManifest.name === '@telos/dsh-continuity', 'continuity manifest identity changed')
  assert(continuityManifest.private === true, 'continuity package must stay private')
  assert(
    isDeepStrictEqual(continuityManifest.dsh?.client?.inject, [
      '@deepseek-ai/dsh-client-connection',
      '@deepseek-ai/dsh-client-runtime',
      '@deepseek-ai/dsh-client-ui-conversation',
      '@deepseek-ai/dsh-client-ui-layout',
      '@deepseek-ai/dsh-client-ui-sidebar',
    ]),
    'continuity Client dependency edges changed',
  )
  assert(
    effectiveRows.length === defaultRows.length + 2,
    `expected ${String(defaultRows.length + 2)} effective rows, found ${String(effectiveRows.length)}`,
  )

  // Reading the tracked file here makes the same patch consumed by Electron
  // part of the audit input, instead of re-creating its contents in this script.
  assert(readFileSync(patchPath, 'utf8').includes('id: telos-ui-sidebar'), 'tracked patch is incomplete')
  assert(readFileSync(patchPath, 'utf8').includes('id: telos-continuity'), 'tracked continuity patch is incomplete')

  process.stdout.write(`[PASS] DSH default Web rows: ${String(defaultRows.length)}\n`)
  process.stdout.write(`[PASS] Unchanged upstream rows: ${String(defaultRows.length - 1)}\n`)
  process.stdout.write('[PASS] Explained upstream delta: ui-sidebar disabled\n')
  process.stdout.write('[PASS] Explained Telos additions: telos-ui-sidebar and telos-continuity enabled\n')
  process.stdout.write('[PASS] Profile resolves the Telos Renderer derivative and continuity Host plugin\n')
  process.stdout.write(`[PASS] Required functional surfaces: ${String(requiredSurfaceIds.length)}\n`)
  process.stdout.write('Telos effective DSH Web composition is structurally equivalent to the pinned default.\n')
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true })
}
