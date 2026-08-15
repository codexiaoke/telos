import { afterEach, describe, expect, it } from 'vitest'
import {
  PersonalContinuityStore,
  validateExtractionEnvelope,
  type ExtractionEnvelopeV1,
} from '../src/index.js'

const stores: PersonalContinuityStore[] = []

function fixture() {
  let sequence = 0
  const store = new PersonalContinuityStore({
    databasePath: ':memory:',
    now: () => new Date('2026-08-15T00:00:00.000Z'),
    idFactory: prefix => `${prefix}-${String(++sequence)}`,
  })
  stores.push(store)
  const owner = store.createEntity({
    id: 'owner',
    kind: 'person',
    canonicalName: 'User',
    scope: { type: 'global' },
    idempotencyKey: 'owner',
  })
  const source = store.createSourceEpisode({
    sourceKind: 'dsh.turn-candidates',
    sourceInstanceId: 'session-a:turn:1:candidates',
    sessionId: 'session-a',
    seqStart: 1,
    seqEnd: 3,
    content: '我偏好简洁的回答',
  })
  return { store, owner, source }
}

function envelope(sourceEpisodeId: string, objectValue = '简洁的回答'): ExtractionEnvelopeV1 {
  return {
    schemaVersion: 1,
    sourceEpisodeId,
    proposals: [{
      kind: 'semantic',
      statement: '用户偏好简洁的回答',
      predicate: 'preference.stated',
      objectValue,
      confidence: 0.92,
      importance: 0.7,
      sensitivity: 'personal',
      scope: { type: 'workspace', id: 'workspace-a' },
    }],
  }
}

afterEach(() => {
  for (const store of stores.splice(0)) store.close()
})

describe('versioned extraction contract', () => {
  it('accepts a bounded v1 envelope and rejects secrets, global scope and oversized batches', () => {
    const valid = envelope('source-1')
    expect(validateExtractionEnvelope(valid)).toEqual(valid)
    expect(() => validateExtractionEnvelope({ ...valid, schemaVersion: 2 })).toThrow(/schemaVersion/)
    expect(() => validateExtractionEnvelope({
      ...valid,
      proposals: [{ ...valid.proposals[0], objectValue: 'password is abc' }],
    })).toThrow(/credential-like/)
    expect(() => validateExtractionEnvelope({
      ...valid,
      proposals: [{ ...valid.proposals[0], scope: { type: 'global' } }],
    })).toThrow(/workspace or session/)
    expect(() => validateExtractionEnvelope({ ...valid, proposals: Array(7).fill(valid.proposals[0]) })).toThrow(/6 items/)
  })
})

describe('candidate reconciliation', () => {
  it('creates candidates, deduplicates exact facts and reports contradictory values without overwriting truth', () => {
    const { store, owner, source } = fixture()
    const first = store.applyExtractionBatch(envelope(source.id), {
      subjectEntityId: owner.id,
      idempotencyKey: 'infer:turn-1',
    })
    expect(first.outcomes).toEqual([expect.objectContaining({ decision: 'created-candidate', conflictingClaimIds: [] })])
    const firstClaim = store.getClaim(first.outcomes[0]!.claimId)
    expect(firstClaim).toMatchObject({ status: 'candidate', objectValue: '简洁的回答' })

    const duplicate = store.applyExtractionBatch(envelope(source.id), {
      subjectEntityId: owner.id,
      idempotencyKey: 'infer:turn-1-repeat',
    })
    expect(duplicate.outcomes).toEqual([expect.objectContaining({
      decision: 'duplicate',
      claimId: firstClaim!.id,
    })])
    expect(store.listClaims()).toHaveLength(1)

    const conflict = store.applyExtractionBatch(envelope(source.id, '详细的回答'), {
      subjectEntityId: owner.id,
      idempotencyKey: 'infer:turn-2',
    })
    expect(conflict.outcomes).toEqual([expect.objectContaining({
      decision: 'created-candidate',
      conflictingClaimIds: [firstClaim!.id],
    })])
    expect(store.listClaims({ statuses: ['candidate'] })).toHaveLength(2)
  })

  it('validates the whole batch before writing and confirms candidates with a separate evidence event', () => {
    const { store, owner, source } = fixture()
    const invalid = envelope(source.id)
    expect(() => store.applyExtractionBatch({
      ...invalid,
      proposals: [...invalid.proposals, { ...invalid.proposals[0], predicate: 'NOT VALID' }],
    }, { subjectEntityId: owner.id, idempotencyKey: 'invalid' })).toThrow(/predicate/)
    expect(store.listClaims()).toHaveLength(0)

    const result = store.applyExtractionBatch(invalid, { subjectEntityId: owner.id, idempotencyKey: 'valid' })
    const confirmation = store.createSourceEpisode({
      sourceKind: 'telos.user-confirmation',
      sourceInstanceId: 'confirmation-1',
      content: '用户确认候选记忆',
    })
    const confirmed = store.confirmCandidate({
      claimId: result.outcomes[0]!.claimId,
      sourceEpisodeIds: [confirmation.id],
      actor: 'user',
      idempotencyKey: 'confirm-1',
    })
    expect(confirmed).toMatchObject({ status: 'confirmed', revision: 2 })
    expect(confirmed.sourceEpisodeIds).toEqual([confirmation.id, source.id].sort())
    expect(store.listEvents(confirmed.id).map(event => event.eventType)).toEqual(['claim.observed', 'claim.confirmed'])
  })

  it('claims only the requested outbox job type', () => {
    const { store } = fixture()
    store.enqueue('infer-turn-candidates', { sourceEpisodeId: 'source-a' }, 'infer-a')
    store.enqueue('another-job', {}, 'other-a')

    expect(store.claimOutbox(10, 60_000, 'infer-turn-candidates').map(job => job.jobType)).toEqual(['infer-turn-candidates'])
    expect(store.claimOutbox(10, 60_000, 'another-job').map(job => job.jobType)).toEqual(['another-job'])
  })
})
