import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { PersonalContinuityStore } from '@telos/personal-core'
import { ContinuityGateway } from '../src/gateway.js'

const stores: PersonalContinuityStore[] = []

function fixture(): { gateway: ContinuityGateway; store: PersonalContinuityStore } {
  let sequence = 0
  const store = new PersonalContinuityStore({
    databasePath: ':memory:',
    now: () => new Date('2026-08-15T00:00:00.000Z'),
    idFactory: prefix => `${prefix}-${String(++sequence)}`,
  })
  stores.push(store)
  return { gateway: new ContinuityGateway({ store }), store }
}

function rememberPayload(suffix: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    statement: `Telos decision ${suffix}`,
    predicate: 'project.decision',
    objectValue: suffix,
    kind: 'semantic',
    scope: { type: 'workspace', id: 'workspace-a' },
    sensitivity: 'personal',
    confidence: 1,
    importance: 0.9,
    status: 'confirmed',
    source: {
      sourceKind: 'telos.test',
      sourceInstanceId: `source-${suffix}`,
      content: `evidence ${suffix}`,
    },
    actor: 'user',
    idempotencyKey: `remember-${suffix}`,
    ...overrides,
  }
}

afterEach(() => {
  for (const store of stores.splice(0)) store.close()
})

describe('ContinuityGateway', () => {
  it('owns the stable personal root and reports database health', async () => {
    const { gateway } = fixture()
    const result = await gateway.handle('health', undefined)

    expect(result).toMatchObject({
      ok: true,
      value: { schemaVersion: 1, integrity: 'ok', databasePath: ':memory:' },
    })
    expect(gateway.ownerEntity).toMatchObject({ id: 'telos:owner', kind: 'person', scope: { type: 'global' } })
  })

  it('executes remember, list, scoped recall, correction, explanation and deletion through bounded RPC commands', async () => {
    const { gateway } = fixture()
    const remembered = await gateway.handle('memory/remember', rememberPayload('preserve-dsh'))
    expect(remembered).toMatchObject({ ok: true, value: { statement: 'Telos decision preserve-dsh', status: 'confirmed' } })
    if (!remembered.ok) throw new Error('fixture remember failed')
    const claim = remembered.value as { id: string }

    const isolated = await gateway.handle('memory/recall', {
      query: 'preserve-dsh',
      workspaceId: 'workspace-b',
      maxClaims: 10,
      minScore: 0,
    })
    expect(isolated).toMatchObject({ ok: true, value: { selectedClaims: [] } })

    const recalled = await gateway.handle('memory/recall', {
      query: 'preserve-dsh',
      workspaceId: 'workspace-a',
      maxClaims: 10,
      minScore: 0,
    })
    expect(recalled).toMatchObject({ ok: true, value: { selectedClaims: [{ id: claim.id }] } })
    if (!recalled.ok) throw new Error('fixture recall failed')
    const recallId = (recalled.value as { id: string }).id
    expect(await gateway.handle('memory/explain', { recallId })).toMatchObject({ ok: true, value: { id: recallId } })

    const corrected = await gateway.handle('memory/correct', {
      ...rememberPayload('new-decision', { idempotencyKey: 'correct-decision' }),
      claimId: claim.id,
    })
    expect(corrected).toMatchObject({ ok: true, value: { statement: 'Telos decision new-decision', supersedesClaimId: claim.id } })

    const listed = await gateway.handle('memory/list', { scope: { type: 'workspace', id: 'workspace-a' } })
    expect(listed).toMatchObject({ ok: true })
    if (!listed.ok) throw new Error('fixture list failed')
    expect(listed.value).toEqual(expect.arrayContaining([
      expect.objectContaining({ statement: 'Telos decision new-decision' }),
      expect.objectContaining({ id: claim.id, status: 'superseded' }),
    ]))
    if (!corrected.ok) throw new Error('fixture correction failed')
    const replacementId = (corrected.value as { id: string }).id

    const forgotten = await gateway.handle('memory/forget', {
      claimId: replacementId,
      physical: true,
      purgeSourceContent: true,
      actor: 'user',
      idempotencyKey: 'forget-replacement',
    })
    expect(forgotten).toMatchObject({ ok: true, value: { claimId: replacementId, physicallyPurged: true } })
    expect(await gateway.handle('deletion/list', { claimId: replacementId })).toMatchObject({
      ok: true,
      value: [{ claimId: replacementId, physicallyPurged: true }],
    })
  })

  it('validates requests and keeps failure values inside the RPC contract', async () => {
    const { gateway } = fixture()

    await expect(gateway.handle('memory/remember', { statement: '' })).resolves.toMatchObject({
      ok: false,
      error: { code: 'bad-request' },
    })
    await expect(gateway.handle('unknown', {})).resolves.toMatchObject({
      ok: false,
      error: { code: 'bad-request', message: 'unknown continuity endpoint unknown' },
    })
  })

  it('exposes source, entity, graph and receipt management views without direct table access', async () => {
    const { gateway, store } = fixture()
    const remembered = await gateway.handle('memory/remember', rememberPayload('views'))
    if (!remembered.ok) throw new Error('fixture remember failed')
    const claim = remembered.value as { id: string; sourceEpisodeIds: string[] }
    const receipt = store.recordActionReceipt({
      action: 'test action',
      authorization: 'allowed',
      runtimeId: 'dsh',
      result: 'succeeded',
      scope: { type: 'workspace', id: 'workspace-a' },
      sourceEpisodeIds: claim.sourceEpisodeIds,
      idempotencyKey: 'receipt-views',
    })

    expect(await gateway.handle('source/get', { sourceEpisodeId: claim.sourceEpisodeIds[0] })).toMatchObject({
      ok: true, value: { sourceKind: 'telos.test' },
    })
    expect(await gateway.handle('entity/list', { kinds: ['person'] })).toMatchObject({ ok: true, value: [{ id: 'telos:owner' }] })
    expect(await gateway.handle('graph/list', { entityId: 'telos:owner' })).toMatchObject({ ok: true, value: [{ claimId: claim.id }] })
    expect(await gateway.handle('receipt/list', { scope: { type: 'workspace', id: 'workspace-a' } })).toMatchObject({
      ok: true, value: [{ id: receipt.id }],
    })
    const recalled = await gateway.handle('memory/recall', {
      query: 'views', workspaceId: 'workspace-a', minScore: 0,
    })
    if (!recalled.ok) throw new Error('fixture recall failed')
    const decision = recalled.value as { id: string; contextPack: { contentHash: string } }
    store.recordMaterialization({
      recallId: decision.id,
      runtimeId: 'dsh',
      sessionId: 'session-a',
      seqStart: 7,
      seqEnd: 7,
      renderedContentHash: decision.contextPack.contentHash,
    })
    expect(await gateway.handle('recall/list', { claimId: claim.id })).toMatchObject({
      ok: true, value: [{ id: decision.id }],
    })
    expect(await gateway.handle('materialization/list', { sessionId: 'session-a' })).toMatchObject({
      ok: true, value: [{ recallId: decision.id, claimId: claim.id }],
    })
  })
})

describe('built DSH Host artifact', () => {
  it('bundles the Telos core and Client while leaving runtime capabilities external', () => {
    const source = readFileSync(resolve(import.meta.dirname, '../lib/index.js'), 'utf8')
    const client = readFileSync(resolve(import.meta.dirname, '../lib/client.js'), 'utf8')
    expect(source).toContain('telos-continuity')
    expect(source).toContain('PersonalContinuityStore')
    expect(source).toContain('from "@deepseek-ai/dsh-tools"')
    expect(source).not.toContain('from "@telos/personal-core"')
    expect(client).toContain('window.__ModuleLoader__.load')
    expect(client).toContain('ContinuityClientController')
    expect(client).toContain('apply: () => apply')
    expect(client).toContain('require("react")')
    expect(client).not.toContain('react.production.min')
  })
})
