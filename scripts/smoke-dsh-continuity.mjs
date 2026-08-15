import { createHash, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dirname, '..')
const dshRoot = resolve(repositoryRoot, 'third_party/deepseek-harness')
const cliPath = resolve(dshRoot, 'apps/cli/lib/bin.js')
const patchPath = resolve(repositoryRoot, 'integrations/dsh/plugins/telos-ui-sidebar/telos.web.patch.yml')
const temporaryRoot = mkdtempSync(join(tmpdir(), 'telos-continuity-smoke-'))
const dshHome = join(temporaryRoot, 'dsh-home')
const profileModules = join(dshHome, 'profiles/web/node_modules')
let child
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

  process.stdout.write(`${JSON.stringify({
    status: 'PASS',
    dshUrl: baseUrl,
    schemaVersion: health.schemaVersion,
    rememberedClaimId: remembered.id,
    correctedClaimId: corrected.id,
    recallId: recall.id,
    selectedClaims: recall.selectedClaims.length,
  }, null, 2)}\n`)
} finally {
  if (child !== undefined && child.exitCode === null) {
    const exited = new Promise(resolveExit => child.once('exit', resolveExit))
    child.kill('SIGTERM')
    await Promise.race([exited, new Promise(resolveTimeout => setTimeout(resolveTimeout, 5_000))])
    if (child.exitCode === null) child.kill('SIGKILL')
  }
  rmSync(temporaryRoot, { recursive: true, force: true })
}
