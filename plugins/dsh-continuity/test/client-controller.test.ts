import { describe, expect, it } from 'vitest'
import { ContinuityClientController } from '../src/client/controller.js'
import type { ClientRpc, MemoryClaimView } from '../src/client/contracts.js'

function claim(overrides: Partial<MemoryClaimView> = {}): MemoryClaimView {
  return {
    id: 'claim-1',
    kind: 'semantic',
    statement: '用户偏好证据充分的回答',
    predicate: 'prefers.answer_style',
    subjectEntityId: 'telos:owner',
    objectValue: 'evidence-backed',
    status: 'confirmed',
    confidence: 1,
    importance: 0.8,
    sensitivity: 'personal',
    scope: { type: 'global' },
    observedAt: '2026-08-15T00:00:00.000Z',
    recordedAt: '2026-08-15T00:00:00.000Z',
    sourceEpisodeIds: ['source-1'],
    contentHash: 'claim-hash',
    revision: 1,
    ...overrides,
  }
}

class FakeRpc implements ClientRpc {
  readonly calls: { channel: string; endpoint: string; payload: unknown }[] = []
  claims: MemoryClaimView[] = [claim()]

  async call(channel: string, endpoint: string, payload: unknown) {
    this.calls.push({ channel, endpoint, payload })
    const empty: Record<string, unknown> = {
      health: { schemaVersion: 1, integrity: 'ok', databasePath: '/local/continuity.sqlite' },
      'entity/list': [],
      'graph/list': [],
      'receipt/list': [],
      'deletion/list': [],
      'materialization/list': [],
    }
    if (endpoint === 'memory/list') return { ok: true as const, value: this.claims }
    if (endpoint === 'source/get') return {
      ok: true as const,
      value: {
        id: 'source-1', sourceKind: 'dsh.user-message', sourceInstanceId: 'message-1',
        observedAt: '2026-08-15T00:00:00.000Z', recordedAt: '2026-08-15T00:00:00.000Z',
        contentHash: 'source-hash', sensitivity: 'personal', deletionState: 'active',
      },
    }
    if (endpoint === 'recall/list') {
      const sessionId = (payload as { sessionId?: string }).sessionId
      return { ok: true as const, value: sessionId === undefined ? [] : [{
        id: 'recall-1', query: 'answer style', queryFingerprint: 'q', context: { sessionId },
        candidates: [], selectedClaims: this.claims, contradictionSets: [],
        contextPack: { claimIds: ['claim-1'], charCount: 10, contentHash: 'pack' },
        latencyMs: 1, createdAt: '2026-08-15T00:00:00.000Z',
      }] }
    }
    if (endpoint === 'memory/correct') {
      const input = payload as { statement: string; objectValue: string }
      const replacement = claim({
        id: 'claim-2',
        statement: input.statement,
        objectValue: input.objectValue,
        supersedesClaimId: 'claim-1',
        revision: 2,
      })
      this.claims = [replacement, claim({ status: 'superseded', supersededByClaimId: replacement.id })]
      return { ok: true as const, value: replacement }
    }
    if (endpoint === 'memory/forget') {
      const input = payload as { claimId: string; physical: boolean }
      this.claims = input.physical
        ? this.claims.filter(item => item.id !== input.claimId)
        : this.claims.map(item => item.id === input.claimId ? { ...item, status: 'revoked' as const } : item)
      return {
        ok: true as const,
        value: {
          receiptId: 'delete-1', claimId: input.claimId, revoked: true,
          physicallyPurged: input.physical, sourceStates: [], derivatives: [],
          completedAt: '2026-08-15T00:00:00.000Z',
        },
      }
    }
    if (endpoint in empty) return { ok: true as const, value: empty[endpoint] }
    return { ok: false as const, error: { code: 'bad-request', message: `unknown ${endpoint}` } }
  }
}

describe('ContinuityClientController', () => {
  it('loads bounded management views and source provenance through the RPC boundary', async () => {
    const rpc = new FakeRpc()
    const controller = new ContinuityClientController(rpc)

    await controller.refresh()
    expect(controller.getSnapshot()).toMatchObject({
      loading: false,
      health: { schemaVersion: 1, integrity: 'ok' },
      claims: [{ id: 'claim-1' }],
    })
    await controller.selectClaim('claim-1')
    expect(controller.getSnapshot().sourcesById['source-1']).toMatchObject({ sourceKind: 'dsh.user-message' })
    expect(rpc.calls.every(call => call.channel === '/telos-continuity')).toBe(true)
  })

  it('corrects by creating a replacement and uses explicit revoke or physical-delete commands', async () => {
    const rpc = new FakeRpc()
    const controller = new ContinuityClientController(rpc)
    await controller.refresh()

    await controller.correct(rpc.claims[0]!, {
      statement: '用户偏好简洁且证据充分的回答',
      predicate: 'prefers.answer_style',
      objectValue: 'concise evidence-backed',
    })
    expect(controller.getSnapshot()).toMatchObject({
      selectedClaimId: 'claim-2',
      claims: [{ id: 'claim-2' }, { id: 'claim-1', status: 'superseded' }],
    })
    const correction = rpc.calls.find(call => call.endpoint === 'memory/correct')?.payload
    expect(correction).toMatchObject({
      claimId: 'claim-1',
      actor: 'user',
      source: { sourceKind: 'telos.user-edit', content: '用户偏好简洁且证据充分的回答' },
    })

    await controller.forget(rpc.claims[0]!, false)
    expect(controller.getSnapshot().claims[0]).toMatchObject({ id: 'claim-2', status: 'revoked' })
    expect(rpc.calls.findLast(call => call.endpoint === 'memory/forget')?.payload).toMatchObject({
      physical: false, purgeSourceContent: false, actor: 'user',
    })
  })

  it('loads a session-scoped recall receipt for the conversation header', async () => {
    const controller = new ContinuityClientController(new FakeRpc())
    await controller.loadSessionReceipt('session-a')
    expect(controller.sessionReceipt('session-a')).toEqual({
      selectedCount: 1,
      recallId: 'recall-1',
      createdAt: '2026-08-15T00:00:00.000Z',
    })
  })
})
