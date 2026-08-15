import { spawn } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const repositoryRoot = resolve(import.meta.dirname, '..')
const dshRoot = resolve(repositoryRoot, 'third_party/deepseek-harness')
const cliPath = resolve(dshRoot, 'apps/cli/lib/bin.js')
const pluginRoot = resolve(repositoryRoot, 'plugins/dsh-continuity')
const defaultDshHome = resolve(homedir(), 'Library/Application Support/Telos/runtime/dsh/web-home')
const webRequire = createRequire(resolve(dshRoot, 'apps/web/package.json'))
const { chromium } = webRequire('playwright')

const DEFAULT_CASE_IDS = [
  'manual_u100001_001',
  'manual_u100002_001',
  'manual_u100002_002',
  'manual_u100003_001',
  'manual_u100008_001',
  'manual_u100011_001',
  'manual_u100022_001',
  'manual_u100023_001',
  'manual_u100049_001',
  'manual_u100118_001',
  'manual_u100535_001',
  'manual_u100538_001',
  'manual_u100004_001',
  'manual_u100032_001',
  'manual_u100035_001',
  'manual_u100040_001',
  'manual_u100050_001',
  'manual_u100058_001',
  'manual_u100068_001',
  'manual_u100086_001',
]

const TIME_HINT_TYPES = new Set([
  'today', 'today_afternoon', 'tonight', 'noon', 'recent', 'yesterday',
  'tomorrow', 'tomorrow_morning', 'next_week', 'next_month', 'specific_date',
  'week', 'weekend', 'this_month',
])

function parseArgs(argv) {
  const result = {
    dataset: process.env.STUDY_PILO_MEMORY_DATASET,
    dshHome: process.env.TELOS_DSH_HOME ?? defaultDshHome,
    caseIds: DEFAULT_CASE_IDS,
    limit: undefined,
    report: undefined,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]
    if (arg === '--dataset' && next !== undefined) {
      result.dataset = resolve(next)
      index += 1
    } else if (arg === '--dsh-home' && next !== undefined) {
      result.dshHome = resolve(next)
      index += 1
    } else if (arg === '--cases' && next !== undefined) {
      result.caseIds = next.split(',').map(value => value.trim()).filter(Boolean)
      index += 1
    } else if (arg === '--limit' && next !== undefined) {
      result.limit = Number.parseInt(next, 10)
      index += 1
    } else if (arg === '--report' && next !== undefined) {
      result.report = resolve(next)
      index += 1
    } else {
      throw new Error(`unknown or incomplete argument ${arg}`)
    }
  }
  if (result.dataset === undefined) {
    throw new Error('pass --dataset or set STUDY_PILO_MEMORY_DATASET')
  }
  if (!Number.isSafeInteger(result.limit) && result.limit !== undefined) {
    throw new Error('--limit must be an integer')
  }
  return result
}

function loadJsonl(path) {
  return readFileSync(path, 'utf8').split(/\r?\n/u).filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line)
    } catch (error) {
      throw new Error(`${path}:${String(index + 1)} is invalid JSON`, { cause: error })
    }
  })
}

function selectCases(rows, ids, limit) {
  const byId = new Map(rows.map(row => [row.case_id, row]))
  const selected = ids.map(id => {
    const row = byId.get(id)
    if (row === undefined) throw new Error(`dataset is missing case ${id}`)
    if (!Array.isArray(row.expected_events) || row.expected_events.length !== 1) {
      throw new Error(`case ${id} must contain exactly one expected event`)
    }
    return row
  })
  return limit === undefined ? selected : selected.slice(0, Math.max(1, limit))
}

function installPackage(dshHome, sourceRoot, packageName) {
  const target = join(dshHome, 'profiles/web/node_modules', ...packageName.split('/'))
  mkdirSync(dirname(target), { recursive: true })
  cpSync(sourceRoot, target, { recursive: true, force: true })
}

function prepareWorkspace(temporaryRoot) {
  const path = join(temporaryRoot, 'workspace')
  mkdirSync(path, { recursive: true })
  return path
}

async function connectWorkspace(page, workspacePath) {
  await page.getByRole('textbox', { name: '选择工作区' }).click()
  const dialog = page.getByRole('dialog', { name: '选择工作区目录' })
  try {
    await dialog.waitFor({ timeout: 10_000 })
  } catch (error) {
    const visibleText = (await page.locator('body').innerText()).slice(0, 4000)
    throw new Error(`workspace directory dialog did not open; visible UI:\n${visibleText}`, { cause: error })
  }
  await dialog.getByRole('button', { name: '编辑路径' }).click()
  const pathInput = dialog.getByRole('textbox', { name: '编辑路径' })
  await pathInput.fill(workspacePath)
  await pathInput.press('Enter')
  await dialog.getByRole('button', { name: '打开', exact: true }).click()
  await page.locator('textarea:enabled[placeholder="描述你想要构建的内容"]')
    .waitFor({ timeout: 15_000 })
}

function writePatch(dshHome) {
  const path = join(dshHome, 'telos.study-pilo-eval.patch.yml')
  writeFileSync(path, [
    '- id: directory-picker',
    '  disabled: true',
    '- insert:',
    '    - id: directory-picker-browse',
    "      name: '@deepseek-ai/dsh-host-directory-picker-browse'",
    '    - id: ui-directory-picker-browse',
    "      name: '@deepseek-ai/dsh-client-ui-directory-picker-browse'",
    '    - id: telos-continuity',
    "      name: '@telos/dsh-continuity'",
    '      config:',
    "        databasePath: !!js dshHomePath('telos', 'personal-continuity.sqlite')",
    '        maxRecallClaims: 8',
    '        maxRecallChars: 2400',
    '        graphDepth: 2',
    '        captureTurnSources: true',
    '        queueInference: true',
    '        formationMaxInputBytes: 16000',
    '        formationMaxOutputTokens: 4096',
    '        formationTimeoutMs: 60000',
    '',
  ].join('\n'), { mode: 0o600 })
  return path
}

function waitForReady(child, output) {
  return new Promise((resolveReady, reject) => {
    const timer = setTimeout(() => reject(new Error(`DSH eval timed out during boot.\n${output.value}`)), 30_000)
    const consume = chunk => {
      output.value += chunk.toString()
      const match = /dsh web: (http:\/\/127\.0\.0\.1:\d+)/u.exec(output.value)
      if (match?.[1] !== undefined) {
        clearTimeout(timer)
        resolveReady(match[1])
      }
    }
    child.stdout.on('data', consume)
    child.stderr.on('data', consume)
    child.once('exit', code => {
      clearTimeout(timer)
      reject(new Error(`DSH eval exited early with ${String(code)}.\n${output.value}`))
    })
  })
}

function withDatabase(databasePath, work) {
  const db = new DatabaseSync(databasePath, { readOnly: true })
  try {
    return work(db)
  } finally {
    db.close()
  }
}

function caseState(databasePath) {
  return withDatabase(databasePath, db => {
    const claims = db.prepare(`
      SELECT mc.* FROM memory_claim mc
      WHERE mc.scope_type = 'workspace'
      ORDER BY mc.recorded_at, mc.id
    `).all()
    const entities = db.prepare(`
      SELECT * FROM entity
      WHERE scope_type = 'workspace' AND status <> 'deleted'
      ORDER BY created_at, id
    `).all()
    const receipts = db.prepare(`
      SELECT action, provider, result, source_episode_ids_json, affected_entity_ids_json
      FROM action_receipt
      WHERE scope_type = 'workspace'
      ORDER BY recorded_at, id
    `).all()
    const sources = claims.length === 0 ? [] : db.prepare(`
      SELECT DISTINCT se.* FROM source_episode se
      JOIN claim_source cs ON cs.source_episode_id = se.id
      JOIN memory_claim mc ON mc.id = cs.claim_id
      WHERE mc.scope_type = 'workspace'
      ORDER BY se.recorded_at, se.id
    `).all()
    return { claims, entities, receipts, sources }
  })
}

async function waitForCase(databasePath) {
  const deadline = Date.now() + 100_000
  while (Date.now() < deadline) {
    const state = caseState(databasePath)
    if (state.receipts.some(receipt => receipt.action === 'memory.formation'
      || receipt.action === 'continuity_remember'
      || receipt.action === 'continuity_correct'
      || receipt.action === 'continuity_forget')) return state
    await new Promise(resolveTimeout => setTimeout(resolveTimeout, 250))
  }
  const diagnostic = withDatabase(databasePath, db => db.prepare(`
    SELECT status, attempts, last_error FROM continuity_outbox
    WHERE job_type = 'infer-turn-candidates'
    ORDER BY created_at DESC LIMIT 1
  `).get())
  throw new Error(`memory formation did not finish: ${JSON.stringify(diagnostic)}`)
}

function normalized(value) {
  return String(value).trim().normalize('NFKC').toLocaleLowerCase()
}

function expectedEntityNames(expectedEvent, input) {
  return (expectedEvent.entities ?? []).filter(entity => entity.promote === true).map(entity => {
    const candidates = [entity.name, ...(entity.aliases ?? [])]
      .map(normalized)
      .filter(name => normalized(input).includes(name))
    return { name: entity.name, candidates: candidates.length === 0 ? [normalized(entity.name)] : candidates }
  })
}

function entityMatches(expected, actualName) {
  const actual = normalized(actualName)
  return expected.candidates.some(candidate => actual.includes(candidate) || candidate.includes(actual))
}

function evaluateCase(row, state) {
  const expected = row.expected_events[0]
  const input = row.input.content
  const shouldRemember = expected.memory_action !== 'ignore' && expected.is_qualified_event === true
  const remembered = state.claims.length > 0
  const expectedEntities = expectedEntityNames(expected, input)
  const matchedEntities = expectedEntities.filter(entity =>
    state.entities.some(actual => entityMatches(entity, actual.canonical_name)))
  const timeExpected = shouldRemember && (expected.time_hints ?? []).some(hint => TIME_HINT_TYPES.has(hint.type))
  const timeBounded = state.claims.some(claim => claim.valid_from !== null || claim.valid_to !== null)
  const explicitlyRequestsReview = /待确认|先别确认|不确定/u.test(input)
  const candidateSafe = !explicitlyRequestsReview || state.claims.every(claim => claim.status === 'candidate')
  const sourceTraceComplete = state.sources.every(source =>
    typeof source.session_id === 'string'
    && Number.isSafeInteger(source.seq_start)
    && Number.isSafeInteger(source.seq_end)
    && typeof source.content_hash === 'string')
  const evidenceGrounded = state.sources
    .filter(source => typeof source.content === 'string')
    .every(source => input.includes(source.content))
  return {
    caseId: row.case_id,
    expectedDecision: shouldRemember ? 'remember' : 'ignore',
    actualDecision: remembered ? 'remember' : 'ignore',
    decisionPass: shouldRemember === remembered,
    expectedEntityNames: expectedEntities.map(entity => entity.name),
    actualEntityNames: state.entities.map(entity => entity.canonical_name),
    matchedEntityNames: matchedEntities.map(entity => entity.name),
    entityRecall: expectedEntities.length === 0 ? 1 : matchedEntities.length / expectedEntities.length,
    timeExpected,
    timeBounded,
    timePass: !timeExpected || timeBounded,
    candidateSafe,
    sourceTraceComplete,
    evidenceGrounded,
    claimCount: state.claims.length,
    claimStatuses: state.claims.map(claim => claim.status),
    claimKinds: state.claims.map(claim => claim.kind),
    statements: state.claims.map(claim => claim.statement),
    receiptActions: state.receipts.map(receipt => receipt.action),
  }
}

function ratio(items, predicate) {
  return items.length === 0 ? 1 : items.filter(predicate).length / items.length
}

function summarize(cases) {
  const rememberCases = cases.filter(item => item.expectedDecision === 'remember')
  const ignoreCases = cases.filter(item => item.expectedDecision === 'ignore')
  const timeCases = cases.filter(item => item.timeExpected)
  const entityCases = cases.filter(item => item.expectedEntityNames.length > 0)
  const metrics = {
    decisionAccuracy: ratio(cases, item => item.decisionPass),
    rememberRecall: ratio(rememberCases, item => item.actualDecision === 'remember'),
    explicitIgnoreAccuracy: ratio(ignoreCases, item => item.actualDecision === 'ignore'),
    entityNameRecall: entityCases.length === 0
      ? 1
      : entityCases.reduce((sum, item) => sum + item.entityRecall, 0) / entityCases.length,
    timeBoundCoverage: ratio(timeCases, item => item.timePass),
    confirmationIntentSafety: ratio(cases, item => item.candidateSafe),
    sourceTraceCoverage: ratio(cases, item => item.sourceTraceComplete),
    evidenceGrounding: ratio(cases, item => item.evidenceGrounded),
  }
  const thresholds = {
    decisionAccuracy: 0.9,
    rememberRecall: 0.9,
    explicitIgnoreAccuracy: 1,
    entityNameRecall: 0.6,
    timeBoundCoverage: 0.75,
    confirmationIntentSafety: 1,
    sourceTraceCoverage: 1,
    evidenceGrounding: 1,
  }
  const failures = Object.entries(thresholds)
    .filter(([name, minimum]) => metrics[name] < minimum)
    .map(([name, minimum]) => `${name}=${metrics[name].toFixed(4)} below ${minimum.toFixed(4)}`)
  return { metrics, thresholds, failures }
}

async function runCase(page, row) {
  const composer = page.locator('textarea:enabled[placeholder="描述你想要构建的内容"]')
  await composer.waitFor({ state: 'visible', timeout: 15_000 })
  await composer.fill(row.input.content)
  await page.getByRole('button', { name: /发送消息|Send message/iu }).click()
  const stop = page.getByRole('button', { name: /停止生成|Stop generating/iu })
  const started = await stop.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false)
  if (started) await stop.waitFor({ state: 'hidden', timeout: 120_000 })
}

const options = parseArgs(process.argv.slice(2))
const dataset = loadJsonl(options.dataset)
const selectedCases = selectCases(dataset, options.caseIds, options.limit)
const credentialsPath = join(options.dshHome, '.credentials.yaml')
const settingsPath = join(options.dshHome, 'settings.yaml')
if (!existsSync(credentialsPath) || !existsSync(settingsPath)) {
  throw new Error(`configured Telos DSH credentials/settings are missing under ${options.dshHome}`)
}

const temporaryRoot = mkdtempSync(join(tmpdir(), 'telos-study-pilo-memory-eval-'))
let browser

try {
  browser = existsSync(chromium.executablePath())
    ? await chromium.launch({ headless: true })
    : await chromium.launch({ channel: 'chrome', headless: true })
  const pageErrors = []
  const results = []
  for (const [index, row] of selectedCases.entries()) {
    const caseRoot = join(temporaryRoot, row.case_id)
    const dshHome = join(caseRoot, 'dsh-home')
    const databasePath = join(dshHome, 'telos/personal-continuity.sqlite')
    const output = { value: '' }
    let child
    let page
    try {
      mkdirSync(dshHome, { recursive: true, mode: 0o700 })
      copyFileSync(credentialsPath, join(dshHome, '.credentials.yaml'))
      chmodSync(join(dshHome, '.credentials.yaml'), 0o600)
      copyFileSync(settingsPath, join(dshHome, 'settings.yaml'))
      chmodSync(join(dshHome, 'settings.yaml'), 0o600)
      installPackage(dshHome, pluginRoot, '@telos/dsh-continuity')
      const workspacePath = prepareWorkspace(caseRoot)
      const patchPath = writePatch(dshHome)
      child = spawn(process.execPath, [cliPath, 'web', '--patch', patchPath, '--port', '0'], {
        cwd: dshRoot,
        env: { ...process.env, DSH_HOME: dshHome, DSH_TELEMETRY_DISABLED: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      const baseUrl = await waitForReady(child, output)
      page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
      page.on('pageerror', error => pageErrors.push(`${row.case_id}: ${error.message}`))
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
      await page.locator('#root').waitFor({ state: 'visible', timeout: 30_000 })
      await connectWorkspace(page, workspacePath)
      await runCase(page, row)
      const state = await waitForCase(databasePath)
      const evaluated = evaluateCase(row, state)
      results.push(evaluated)
      process.stdout.write(`${JSON.stringify({
        progress: `${String(index + 1)}/${String(selectedCases.length)}`,
        caseId: row.case_id,
        decision: `${evaluated.expectedDecision}->${evaluated.actualDecision}`,
        entities: `${String(evaluated.matchedEntityNames.length)}/${String(evaluated.expectedEntityNames.length)}`,
        timePass: evaluated.timePass,
        candidateSafe: evaluated.candidateSafe,
      })}\n`)
    } finally {
      if (page !== undefined) await page.close()
      if (child !== undefined && child.exitCode === null) {
        const exited = new Promise(resolveExit => child.once('exit', resolveExit))
        child.kill('SIGTERM')
        await Promise.race([exited, new Promise(resolveTimeout => setTimeout(resolveTimeout, 5_000))])
        if (child.exitCode === null) child.kill('SIGKILL')
      }
    }
  }
  const summary = summarize(results)
  const report = {
    benchmark: 'Telos Study-Pilo Memory Live Eval',
    version: 1,
    generatedAt: new Date().toISOString(),
    dataset: options.dataset,
    model: 'configured-main-model',
    isolated: true,
    caseCount: results.length,
    pageErrors,
    ...summary,
    cases: results,
  }
  if (options.report !== undefined) {
    mkdirSync(dirname(options.report), { recursive: true })
    writeFileSync(options.report, `${JSON.stringify(report, null, 2)}\n`)
  }
  process.stdout.write(`${JSON.stringify({
    status: summary.failures.length === 0 && pageErrors.length === 0 ? 'PASS' : 'FAIL',
    caseCount: results.length,
    metrics: summary.metrics,
    failures: summary.failures,
    pageErrors,
    report: options.report,
  }, null, 2)}\n`)
  if (summary.failures.length > 0 || pageErrors.length > 0) process.exitCode = 1
} finally {
  if (browser !== undefined) await browser.close()
  rmSync(temporaryRoot, { recursive: true, force: true })
}
