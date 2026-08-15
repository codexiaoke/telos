import { createHash, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'

const repositoryRoot = resolve(import.meta.dirname, '..')
const dshRoot = resolve(repositoryRoot, 'third_party/deepseek-harness')
const cliPath = resolve(dshRoot, 'apps/cli/lib/bin.js')
const patchPath = resolve(repositoryRoot, 'integrations/dsh/plugins/telos-ui-sidebar/telos.web.patch.yml')
const temporaryRoot = mkdtempSync(join(tmpdir(), 'telos-continuity-smoke-'))
const dshHome = join(temporaryRoot, 'dsh-home')
const profileModules = join(dshHome, 'profiles/web/node_modules')
const require = createRequire(resolve(repositoryRoot, 'apps/desktop/package.json'))
const webRequire = createRequire(resolve(dshRoot, 'apps/web/package.json'))
const { chromium } = webRequire('playwright')
let child
let browser
let output = ''

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function installPackage(sourceRoot, packageName) {
  const target = join(profileModules, ...packageName.split('/'))
  mkdirSync(dirname(target), { recursive: true })
  cpSync(sourceRoot, target, { recursive: true, force: true })
}

function waitForReady(process) {
  return new Promise((resolveReady, reject) => {
    const timer = setTimeout(() => reject(new Error(`DSH continuity smoke timed out.\n${output}`)), 30_000)
    const consume = (chunk) => {
      output += chunk.toString()
      const match = /dsh web: (http:\/\/127\.0\.0\.1:\d+)/.exec(output)
      if (match?.[1] !== undefined) {
        clearTimeout(timer)
        resolveReady(match[1])
      }
    }
    process.stdout.on('data', consume)
    process.stderr.on('data', consume)
    process.once('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`DSH continuity smoke exited early with ${String(code)}.\n${output}`))
    })
  })
}

async function rpc(baseUrl, endpoint, payload) {
  const response = await fetch(`${baseUrl}/telos-continuity/${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `continuity-smoke-${randomUUID()}`,
      method: endpoint,
      payload,
    }),
  })
  const bodyText = await response.text()
  assert(response.ok, `${endpoint} returned HTTP ${String(response.status)}: ${bodyText}`)
  const body = JSON.parse(bodyText)
  assert(body.result?.ok === true, `${endpoint} failed: ${bodyText}`)
  return body.result.value
}

function source(instance) {
  return {
    sourceKind: 'telos.smoke',
    runtimeId: 'dsh',
    sourceInstanceId: instance,
    observedAt: new Date().toISOString(),
    contentHash: createHash('sha256').update(instance).digest('hex'),
    sensitivity: 'personal',
  }
}

try {
  for (const required of [
    cliPath,
    patchPath,
    resolve(repositoryRoot, 'plugins/dsh-continuity/lib/index.js'),
    resolve(repositoryRoot, 'plugins/dsh-continuity/lib/client.js'),
    resolve(repositoryRoot, 'integrations/dsh/plugins/telos-ui-sidebar/lib/client.js'),
    resolve(repositoryRoot, 'integrations/dsh/plugins/telos-ui-layout/lib/client.js'),
  ]) assert(existsSync(required), `required smoke artifact is missing: ${required}`)

  installPackage(resolve(repositoryRoot, 'plugins/dsh-continuity'), '@telos/dsh-continuity')
  installPackage(resolve(repositoryRoot, 'integrations/dsh/plugins/telos-ui-sidebar'), '@telos/dsh-client-ui-sidebar')
  installPackage(resolve(repositoryRoot, 'integrations/dsh/plugins/telos-ui-layout'), '@deepseek-ai/dsh-client-ui-layout')

  child = spawn(process.execPath, [cliPath, 'web', '--patch', patchPath, '--port', '0'], {
    cwd: dshRoot,
    env: {
      ...process.env,
      DSH_HOME: dshHome,
      DSH_TELEMETRY_DISABLED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const baseUrl = await waitForReady(child)
  const indexHtml = await (await fetch(baseUrl)).text()
  assert(indexHtml.includes('"@telos/dsh-continuity"'), 'Web boot graph omitted the continuity Client module')
  const clientResponse = await fetch(`${baseUrl}/plugins/@telos/dsh-continuity/client.js`)
  assert(clientResponse.ok, `continuity Client bundle returned HTTP ${String(clientResponse.status)}`)
  const clientBundle = await clientResponse.text()
  let handoff
  runInNewContext(clientBundle, {
    window: { __ModuleLoader__: { load: value => { handoff = value } } },
  })
  assert(handoff?.id === '@telos/dsh-continuity', 'continuity Client bundle registered the wrong module id')
  const clientModule = handoff.factory(specifier => require(specifier))
  assert(typeof clientModule.apply === 'function', 'continuity Client bundle has no apply export')
  assert(Array.isArray(clientModule.inject), 'continuity Client bundle has no inject declaration')
  const health = await rpc(baseUrl, 'health', {})
  assert(health.schemaVersion === 1, `unexpected continuity schema ${String(health.schemaVersion)}`)
  assert(health.integrity === 'ok', `continuity integrity check failed: ${String(health.integrity)}`)

  const remembered = await rpc(baseUrl, 'memory/remember', {
    statement: 'Smoke user prefers evidence-backed answers',
    predicate: 'prefers.answer_style',
    objectValue: 'evidence-backed',
    kind: 'semantic',
    scope: { type: 'global' },
    sensitivity: 'personal',
    confidence: 1,
    importance: 0.8,
    status: 'confirmed',
    source: source('remember'),
    actor: 'user',
    idempotencyKey: 'smoke:remember',
  })
  const recall = await rpc(baseUrl, 'memory/recall', {
    query: 'What answer style does the smoke user prefer?',
    allowedSensitivities: ['personal'],
    maxClaims: 4,
    maxChars: 800,
  })
  assert(recall.selectedClaims.some(claim => claim.id === remembered.id), 'remembered claim was not recalled')

  const corrected = await rpc(baseUrl, 'memory/correct', {
    claimId: remembered.id,
    statement: 'Smoke user prefers concise evidence-backed answers',
    predicate: 'prefers.answer_style',
    objectValue: 'concise evidence-backed',
    kind: 'semantic',
    scope: { type: 'global' },
    sensitivity: 'personal',
    confidence: 1,
    importance: 0.8,
    status: 'confirmed',
    source: source('correct'),
    actor: 'user',
    idempotencyKey: 'smoke:correct',
  })
  const explanation = await rpc(baseUrl, 'memory/explain', { recallId: recall.id })
  assert(explanation?.id === recall.id, 'recall explanation was not persisted')
  const deletion = await rpc(baseUrl, 'memory/forget', {
    claimId: corrected.id,
    physical: false,
    purgeSourceContent: false,
    actor: 'user',
    idempotencyKey: 'smoke:forget',
  })
  assert(deletion.claimId === corrected.id, 'forget receipt does not identify the corrected claim')
  const claims = await rpc(baseUrl, 'memory/list', { limit: 20 })
  assert(claims.some(claim => claim.id === remembered.id && claim.status === 'superseded'), 'correction history was not retained')
  assert(claims.some(claim => claim.id === corrected.id && claim.status === 'revoked'), 'forgotten claim was not revoked')
  await rpc(baseUrl, 'memory/remember', {
    statement: 'Smoke graph projection remains active',
    predicate: 'tests.graph_projection',
    objectValue: 'active',
    kind: 'semantic',
    scope: { type: 'global' },
    sensitivity: 'personal',
    confidence: 1,
    importance: 0.7,
    status: 'confirmed',
    source: source('graph'),
    actor: 'user',
    idempotencyKey: 'smoke:graph',
  })
  const graph = await rpc(baseUrl, 'graph/list', { limit: 20 })
  assert(graph.some(relation => relation.predicate === 'tests.graph_projection'), 'Host graph projection omitted the smoke relation')

  browser = existsSync(chromium.executablePath())
    ? await chromium.launch({ headless: true })
    : await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-telos-workbench]').waitFor({ state: 'visible', timeout: 30_000 })
  // Complete the two keyless first-run steps in the disposable DSH_HOME.
  const continueOnboarding = page.getByRole('button', { name: /^(Continue|继续)$/ })
  if (await continueOnboarding.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false)) {
    await continueOnboarding.click()
  }
  const configureLater = page.getByRole('button', { name: /^(Configure later|稍后配置)$/ })
  if (await configureLater.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false)) {
    await configureLater.click()
  }
  await page.locator('#root').waitFor({ state: 'visible' })
  await page.waitForFunction(() => document.getElementById('root')?.inert !== true)
  await page.getByRole('button', { name: '打开连续记忆' }).first().click()
  const dialog = page.getByRole('dialog', { name: '连续记忆' })
  await dialog.waitFor({ state: 'visible' })
  await dialog.getByRole('button', { name: '全部', exact: true }).click()
  await dialog.getByText('Smoke user prefers evidence-backed answers', { exact: true }).click()
  await dialog.getByText('telos.smoke', { exact: true }).waitFor()
  await dialog.getByRole('tab', { name: '关系图' }).click()
  const graphPredicate = dialog.getByText('tests.graph_projection', { exact: true }).first()
  if (!await graphPredicate.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false)) {
    throw new Error(`continuity graph view did not render the Host projection:\n${await dialog.innerText()}`)
  }
  await dialog.getByRole('tab', { name: '召回回执' }).click()
  await dialog.getByText('What answer style does the smoke user prefer?', { exact: true }).waitFor()
  await dialog.getByRole('tab', { name: '行动与删除' }).click()
  await dialog.getByText('已撤销', { exact: true }).first().waitFor()
  await page.getByRole('button', { name: '关闭连续记忆' }).click()
  assert(pageErrors.length === 0, `continuity Client page errors:\n${pageErrors.join('\n')}`)

  process.stdout.write(`${JSON.stringify({
    status: 'PASS',
    dshUrl: baseUrl,
    clientModule: handoff.id,
    clientUi: 'PASS',
    schemaVersion: health.schemaVersion,
    rememberedClaimId: remembered.id,
    correctedClaimId: corrected.id,
    recallId: recall.id,
    selectedClaims: recall.selectedClaims.length,
  }, null, 2)}\n`)
} finally {
  if (browser !== undefined) await browser.close()
  if (child !== undefined && child.exitCode === null) {
    const exited = new Promise(resolveExit => child.once('exit', resolveExit))
    child.kill('SIGTERM')
    await Promise.race([exited, new Promise(resolveTimeout => setTimeout(resolveTimeout, 5_000))])
    if (child.exitCode === null) child.kill('SIGKILL')
  }
  rmSync(temporaryRoot, { recursive: true, force: true })
}
