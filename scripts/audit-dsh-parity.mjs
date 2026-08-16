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
const mcpManagerRoot = resolve(repositoryRoot, 'plugins/dsh-mcp-manager')
const multimodalRoot = resolve(repositoryRoot, 'plugins/dsh-multimodal')
const personalizationRoot = resolve(repositoryRoot, 'plugins/dsh-personalization')
const multiRootWorkspaceRoot = resolve(repositoryRoot, 'plugins/dsh-multi-root-workspace')
const workbenchFilesRoot = resolve(repositoryRoot, 'plugins/dsh-workbench-files')
const workReportRoot = resolve(repositoryRoot, 'plugins/dsh-work-report')
const computerUseRoot = resolve(repositoryRoot, 'plugins/dsh-computer-use')
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
    resolve(mcpManagerRoot, 'package.json'),
    resolve(mcpManagerRoot, 'lib/index.js'),
    resolve(mcpManagerRoot, 'lib/client.js'),
    resolve(mcpManagerRoot, 'lib/BUILD.json'),
    resolve(multimodalRoot, 'package.json'),
    resolve(multimodalRoot, 'lib/index.js'),
    resolve(multimodalRoot, 'lib/client.js'),
    resolve(multimodalRoot, 'lib/BUILD.json'),
    resolve(personalizationRoot, 'package.json'),
    resolve(personalizationRoot, 'lib/index.js'),
    resolve(personalizationRoot, 'lib/client.js'),
    resolve(personalizationRoot, 'lib/BUILD.json'),
    resolve(multiRootWorkspaceRoot, 'package.json'),
    resolve(multiRootWorkspaceRoot, 'lib/index.js'),
    resolve(multiRootWorkspaceRoot, 'lib/client.js'),
    resolve(multiRootWorkspaceRoot, 'lib/BUILD.json'),
    resolve(workbenchFilesRoot, 'package.json'),
    resolve(workbenchFilesRoot, 'lib/index.js'),
    resolve(workbenchFilesRoot, 'lib/BUILD.json'),
    resolve(workReportRoot, 'package.json'),
    resolve(workReportRoot, 'lib/index.js'),
    resolve(workReportRoot, 'lib/client.js'),
    resolve(workReportRoot, 'lib/BUILD.json'),
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
      '@deepseek-ai/dsh-client-connection',
      '@deepseek-ai/dsh-client-runtime',
      '@deepseek-ai/dsh-client-ui-theme',
    ]),
    'layout compatibility package changed its DSH client dependency edges',
  )

  const profileRoot = resolve(temporaryRoot, 'profile-resolution')
  const installedLayout = resolve(profileRoot, 'node_modules/@deepseek-ai/dsh-client-ui-layout')
  const installedContinuity = resolve(profileRoot, 'node_modules/@telos/dsh-continuity')
  const installedMcpManager = resolve(profileRoot, 'node_modules/@telos/dsh-mcp-manager')
  const installedMultimodal = resolve(profileRoot, 'node_modules/@telos/dsh-multimodal')
  const installedPersonalization = resolve(profileRoot, 'node_modules/@telos/dsh-personalization')
  const installedMultiRootWorkspace = resolve(profileRoot, 'node_modules/@telos/dsh-multi-root-workspace')
  const installedWorkbenchFiles = resolve(profileRoot, 'node_modules/@telos/dsh-workbench-files')
  const installedWorkReport = resolve(profileRoot, 'node_modules/@telos/dsh-work-report')
  mkdirSync(resolve(profileRoot, 'node_modules/@deepseek-ai'), { recursive: true })
  mkdirSync(resolve(profileRoot, 'node_modules/@telos'), { recursive: true })
  cpSync(layoutRoot, installedLayout, { recursive: true })
  cpSync(continuityRoot, installedContinuity, { recursive: true })
  cpSync(mcpManagerRoot, installedMcpManager, { recursive: true })
  cpSync(multimodalRoot, installedMultimodal, { recursive: true })
  cpSync(personalizationRoot, installedPersonalization, { recursive: true })
  cpSync(multiRootWorkspaceRoot, installedMultiRootWorkspace, { recursive: true })
  cpSync(workbenchFilesRoot, installedWorkbenchFiles, { recursive: true })
  cpSync(workReportRoot, installedWorkReport, { recursive: true })
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
  const resolvedMcpManagerManifest = profileRequire.resolve('@telos/dsh-mcp-manager/package.json')
  assert(
    realpathSync(resolvedMcpManagerManifest) === realpathSync(resolve(installedMcpManager, 'package.json')),
    `Profile-local MCP manager plugin does not win package resolution: ${resolvedMcpManagerManifest}`,
  )
  const resolvedMultimodalManifest = profileRequire.resolve('@telos/dsh-multimodal/package.json')
  assert(
    realpathSync(resolvedMultimodalManifest) === realpathSync(resolve(installedMultimodal, 'package.json')),
    `Profile-local multimodal plugin does not win package resolution: ${resolvedMultimodalManifest}`,
  )
  const resolvedPersonalizationManifest = profileRequire.resolve('@telos/dsh-personalization/package.json')
  assert(
    realpathSync(resolvedPersonalizationManifest) === realpathSync(resolve(installedPersonalization, 'package.json')),
    `Profile-local personalization plugin does not win package resolution: ${resolvedPersonalizationManifest}`,
  )
  const resolvedMultiRootWorkspaceManifest = profileRequire.resolve('@telos/dsh-multi-root-workspace/package.json')
  assert(
    realpathSync(resolvedMultiRootWorkspaceManifest) === realpathSync(resolve(installedMultiRootWorkspace, 'package.json')),
    `Profile-local multi-root workspace plugin does not win package resolution: ${resolvedMultiRootWorkspaceManifest}`,
  )
  const resolvedWorkbenchFilesManifest = profileRequire.resolve('@telos/dsh-workbench-files/package.json')
  assert(
    realpathSync(resolvedWorkbenchFilesManifest) === realpathSync(resolve(installedWorkbenchFiles, 'package.json')),
    `Profile-local workbench files plugin does not win package resolution: ${resolvedWorkbenchFilesManifest}`,
  )
  const resolvedWorkReportManifest = profileRequire.resolve('@telos/dsh-work-report/package.json')
  assert(
    realpathSync(resolvedWorkReportManifest) === realpathSync(resolve(installedWorkReport, 'package.json')),
    `Profile-local work report plugin does not win package resolution: ${resolvedWorkReportManifest}`,
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
    'directory-picker',
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

  const upstreamDirectoryPicker = defaultById.get('directory-picker')
  const effectiveDirectoryPicker = effectiveById.get('directory-picker')
  assert(upstreamDirectoryPicker !== undefined, 'default DSH Web config has no directory-picker row')
  assert(effectiveDirectoryPicker !== undefined, 'Telos effective config has no directory-picker row')
  assert(
    isDeepStrictEqual(effectiveDirectoryPicker, { ...upstreamDirectoryPicker, disabled: true }),
    'the upstream directory-picker row changed beyond the declared disabled flag',
  )

  for (const row of defaultRows) {
    if (row.id === 'ui-sidebar' || row.id === 'directory-picker') continue
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
    isDeepStrictEqual(addedIds, ['telos-directory-picker-native', 'telos-ui-sidebar', 'telos-continuity', 'telos-mcp-manager', 'telos-multimodal', 'telos-personalization', 'telos-multi-root-workspace', 'telos-workbench-files', 'telos-work-report', 'telos-computer-use']),
    `unexpected Telos-only rows: ${addedIds.join(', ')}`,
  )
  const telosSidebar = effectiveById.get('telos-ui-sidebar')
  assert(telosSidebar.name === '@telos/dsh-client-ui-sidebar', 'Telos sidebar package name changed')
  assert(telosSidebar.disabled !== true, 'Telos sidebar replacement is disabled')
  const telosDirectoryPicker = effectiveById.get('telos-directory-picker-native')
  assert(telosDirectoryPicker?.name === '@deepseek-ai/dsh-host-directory-picker-native', 'Telos native directory picker package name changed')
  assert(telosDirectoryPicker.disabled !== true, 'Telos native directory picker backend is disabled')
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
      formationMaxInputBytes: 16000,
      formationMaxOutputTokens: 4096,
      formationTimeoutMs: 60000,
    }),
    'Telos continuity bounded runtime configuration changed',
  )
  const telosMcpManager = effectiveById.get('telos-mcp-manager')
  assert(telosMcpManager?.name === '@telos/dsh-mcp-manager', 'Telos MCP manager package name changed')
  assert(telosMcpManager.disabled !== true, 'Telos MCP manager plugin is disabled')
  assert(
    isDeepStrictEqual(telosMcpManager.config, {
      storePath: { javascriptSource: "dshHomePath('telos', 'mcp-servers.json')" },
    }),
    'Telos MCP manager storage configuration changed',
  )
  const telosMultimodal = effectiveById.get('telos-multimodal')
  assert(telosMultimodal?.name === '@telos/dsh-multimodal', 'Telos multimodal package name changed')
  assert(telosMultimodal.disabled !== true, 'Telos multimodal plugin is disabled')
  assert(
    isDeepStrictEqual(telosMultimodal.config, {
      storePath: { javascriptSource: "dshHomePath('telos', 'multimodal-settings.json')" },
    }),
    'Telos multimodal storage configuration changed',
  )
  const telosPersonalization = effectiveById.get('telos-personalization')
  assert(telosPersonalization?.name === '@telos/dsh-personalization', 'Telos personalization package name changed')
  assert(telosPersonalization.disabled !== true, 'Telos personalization plugin is disabled')
  assert(
    isDeepStrictEqual(telosPersonalization.config, {
      instructionsPath: { javascriptSource: "dshHomePath('AGENTS.md')" },
    }),
    'Telos personalization instructions path changed',
  )
  const telosWorkbenchFiles = effectiveById.get('telos-workbench-files')
  assert(telosWorkbenchFiles?.name === '@telos/dsh-workbench-files', 'Telos workbench files package name changed')
  assert(telosWorkbenchFiles.disabled !== true, 'Telos workbench files plugin is disabled')
  const telosMultiRootWorkspace = effectiveById.get('telos-multi-root-workspace')
  assert(telosMultiRootWorkspace?.name === '@telos/dsh-multi-root-workspace', 'Telos multi-root workspace package name changed')
  assert(telosMultiRootWorkspace.disabled !== true, 'Telos multi-root workspace plugin is disabled')
  assert(
    isDeepStrictEqual(telosMultiRootWorkspace.config, {
      storePath: { javascriptSource: "dshHomePath('telos', 'workspace-groups.json')" },
    }),
    'Telos multi-root workspace storage configuration changed',
  )
  const telosWorkReport = effectiveById.get('telos-work-report')
  assert(telosWorkReport?.name === '@telos/dsh-work-report', 'Telos work report package name changed')
  assert(telosWorkReport.disabled !== true, 'Telos work report plugin is disabled')
  assert(
    isDeepStrictEqual(telosWorkReport.config, {
      rootPath: { javascriptSource: "dshHomePath('telos', 'work-report')" },
    }),
    'Telos work report storage configuration changed',
  )
  const telosComputerUse = effectiveById.get('telos-computer-use')
  assert(telosComputerUse?.name === '@telos/dsh-computer-use', 'Telos computer use package name changed')
  assert(telosComputerUse.disabled !== true, 'Telos computer use plugin is disabled')
  assert(
    isDeepStrictEqual(telosComputerUse.config, {
      observationTtlMs: 0,
      settleMs: 100,
      maxSettleMs: 1500,
      allowAllApps: true,
      interaction: {
        focusPolicy: 'activate',
        keyboardPolicy: 'activate',
        pointerInputPolicy: 'targeted',
        cursorVisualization: 'hidden',
        cursorAutoHideMs: 0,
      },
    }),
    'Telos computer use interaction configuration changed',
  )
  const continuityManifest = JSON.parse(readFileSync(resolve(continuityRoot, 'package.json'), 'utf8'))
  assert(continuityManifest.name === '@telos/dsh-continuity', 'continuity manifest identity changed')
  assert(continuityManifest.private === true, 'continuity package must stay private')
  assert(
    isDeepStrictEqual(continuityManifest.dsh?.client?.inject, [
      '@deepseek-ai/dsh-client-connection',
      '@deepseek-ai/dsh-client-runtime',
      '@deepseek-ai/dsh-client-ui-settings',
    ]),
    'continuity Client dependency edges changed',
  )
  const mcpManagerManifest = JSON.parse(readFileSync(resolve(mcpManagerRoot, 'package.json'), 'utf8'))
  assert(mcpManagerManifest.name === '@telos/dsh-mcp-manager', 'MCP manager manifest identity changed')
  assert(mcpManagerManifest.private === true, 'MCP manager package must stay private')
  assert(
    isDeepStrictEqual(mcpManagerManifest.dsh?.client?.inject, [
      '@deepseek-ai/dsh-client-connection',
      '@deepseek-ai/dsh-client-runtime',
      '@deepseek-ai/dsh-client-ui-settings',
    ]),
    'MCP manager Client dependency edges changed',
  )
  const multimodalManifest = JSON.parse(readFileSync(resolve(multimodalRoot, 'package.json'), 'utf8'))
  assert(multimodalManifest.name === '@telos/dsh-multimodal', 'multimodal manifest identity changed')
  assert(multimodalManifest.private === true, 'multimodal package must stay private')
  assert(
    isDeepStrictEqual(multimodalManifest.dsh?.client?.inject, [
      '@deepseek-ai/dsh-client-connection',
      '@deepseek-ai/dsh-client-runtime',
      '@deepseek-ai/dsh-client-ui-conversation',
      '@deepseek-ai/dsh-client-ui-model-selection',
      '@deepseek-ai/dsh-client-ui-settings',
    ]),
    'multimodal Client dependency edges changed',
  )
  const personalizationManifest = JSON.parse(readFileSync(resolve(personalizationRoot, 'package.json'), 'utf8'))
  assert(personalizationManifest.name === '@telos/dsh-personalization', 'personalization manifest identity changed')
  assert(personalizationManifest.private === true, 'personalization package must stay private')
  assert(
    isDeepStrictEqual(personalizationManifest.dsh?.client?.inject, [
      '@deepseek-ai/dsh-client-connection',
      '@deepseek-ai/dsh-client-runtime',
      '@deepseek-ai/dsh-client-ui-settings',
    ]),
    'personalization Client dependency edges changed',
  )
  const multiRootWorkspaceManifest = JSON.parse(readFileSync(resolve(multiRootWorkspaceRoot, 'package.json'), 'utf8'))
  assert(multiRootWorkspaceManifest.name === '@telos/dsh-multi-root-workspace', 'multi-root workspace manifest identity changed')
  assert(multiRootWorkspaceManifest.private === true, 'multi-root workspace package must stay private')
  assert(
    isDeepStrictEqual(multiRootWorkspaceManifest.dsh?.client?.inject, [
      '@deepseek-ai/dsh-client-connection',
      '@deepseek-ai/dsh-client-runtime',
      '@deepseek-ai/dsh-client-ui-workspace',
    ]),
    'multi-root workspace Client dependency edges changed',
  )
  const workReportManifest = JSON.parse(readFileSync(resolve(workReportRoot, 'package.json'), 'utf8'))
  assert(workReportManifest.name === '@telos/dsh-work-report', 'work report manifest identity changed')
  assert(workReportManifest.private === true, 'work report package must stay private')
  assert(
    isDeepStrictEqual(workReportManifest.dsh?.client?.inject, [
      '@deepseek-ai/dsh-client-connection',
      '@deepseek-ai/dsh-client-runtime',
      '@deepseek-ai/dsh-client-ui-settings',
    ]),
    'work report Client dependency edges changed',
  )
  assert(
    effectiveRows.length === defaultRows.length + 10,
    `expected ${String(defaultRows.length + 10)} effective rows, found ${String(effectiveRows.length)}`,
  )

  // Reading the tracked file here makes the same patch consumed by Electron
  // part of the audit input, instead of re-creating its contents in this script.
  assert(readFileSync(patchPath, 'utf8').includes('id: telos-ui-sidebar'), 'tracked patch is incomplete')
  assert(readFileSync(patchPath, 'utf8').includes('id: telos-continuity'), 'tracked continuity patch is incomplete')
  assert(readFileSync(patchPath, 'utf8').includes('id: telos-mcp-manager'), 'tracked MCP manager patch is incomplete')
  assert(readFileSync(patchPath, 'utf8').includes('id: telos-multimodal'), 'tracked multimodal patch is incomplete')
  assert(readFileSync(patchPath, 'utf8').includes('id: telos-personalization'), 'tracked personalization patch is incomplete')
  assert(readFileSync(patchPath, 'utf8').includes('id: telos-multi-root-workspace'), 'tracked multi-root workspace patch is incomplete')
  assert(readFileSync(patchPath, 'utf8').includes('id: telos-workbench-files'), 'tracked workbench files patch is incomplete')
  assert(readFileSync(patchPath, 'utf8').includes('id: telos-work-report'), 'tracked work report patch is incomplete')
  assert(readFileSync(patchPath, 'utf8').includes('id: telos-computer-use'), 'tracked computer use patch is incomplete')
  assert(
    readFileSync(resolve(computerUseRoot, 'lib/index.js'), 'utf8').includes('computer_open_app'),
    'computer use build is missing deterministic app launch',
  )
  assert(
    readFileSync(resolve(computerUseRoot, 'lib/index.js'), 'utf8').includes('computer_use'),
    'computer use build is missing the screenshot/action feedback loop',
  )

  process.stdout.write(`[PASS] DSH default Web rows: ${String(defaultRows.length)}\n`)
  process.stdout.write(`[PASS] Unchanged upstream rows: ${String(defaultRows.length - 2)}\n`)
  process.stdout.write('[PASS] Explained upstream delta: ui-sidebar and directory-picker disabled\n')
  process.stdout.write('[PASS] Explained Telos additions: native picker backend, multi-root workspace, sidebar, continuity, MCP manager, multimodal settings, personalization, workbench files, work report, and computer use enabled\n')
  process.stdout.write('[PASS] Profile resolves the Telos Renderer derivative and all Telos Host plugins\n')
  process.stdout.write(`[PASS] Required functional surfaces: ${String(requiredSurfaceIds.length)}\n`)
  process.stdout.write('Telos effective DSH Web composition is structurally equivalent to the pinned default.\n')
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true })
}
