import { afterEach, describe, expect, it } from 'vitest'
import {
  PersonalContinuityStore,
  validateExtractionEnvelope,
  validateGraphExtractionEnvelope,
  type ExtractionEnvelopeV1,
  type GraphExtractionEnvelopeV2,
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

function graphEnvelope(sourceEpisodeId: string): GraphExtractionEnvelopeV2 {
  return {
    schemaVersion: 2,
    sourceEpisodeId,
    scope: { type: 'workspace', id: 'workspace-a' },
    entities: [{ ref: 'father', kind: 'person', canonicalName: '爸爸', aliases: [] }],
    events: [{
      kind: 'prospective',
      statement: '爸爸将于 2026-08-16 来用户家',
      predicate: 'person.visits_home_of',
      subjectEntityRef: 'father',
      objectEntityRef: 'owner',
      confidence: 0.94,
      importance: 0.78,
      sensitivity: 'personal',
      validFrom: '2026-08-16T00:00:00+08:00',
      validTo: '2026-08-16T23:59:59.999+08:00',
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

  it('accepts a grounded v2 entity-event graph and rejects unresolved or unused identity refs', () => {
    const valid = graphEnvelope('source-1')
    expect(validateGraphExtractionEnvelope(valid)).toEqual(valid)
    expect(() => validateGraphExtractionEnvelope({
      ...valid,
      events: [{ ...valid.events[0], subjectEntityRef: 'unknown' }],
    })).toThrow(/subjectEntityRef is unknown/)
    expect(() => validateGraphExtractionEnvelope({
      ...valid,
      events: [{ ...valid.events[0], subjectEntityRef: 'owner' }],
    })).toThrow(/not used/)
    expect(() => validateGraphExtractionEnvelope({
      ...valid,
      events: [{ ...valid.events[0], objectValue: '用户家' }],
    })).toThrow(/exactly one/)
  })
})

describe('candidate reconciliation', () => {
  it('atomically resolves a person node and records a time-aware candidate edge', () => {
    const { store, owner, source } = fixture()
    const first = store.applyGraphExtractionBatch(graphEnvelope(source.id), {
      ownerEntityId: owner.id,
      idempotencyKey: 'graph:turn-1',
    })
    expect(first.entities).toEqual([expect.objectContaining({ ref: 'father', decision: 'created' })])
    expect(first.outcomes).toEqual([expect.objectContaining({ decision: 'created-candidate' })])
    const father = store.getEntity(first.entities[0]!.entityId)
    const claim = store.getClaim(first.outcomes[0]!.claimId)
    expect(father).toMatchObject({ kind: 'person', canonicalName: '爸爸' })
    expect(claim).toMatchObject({
      kind: 'prospective',
      subjectEntityId: father!.id,
      objectEntityId: owner.id,
      status: 'candidate',
      validFrom: '2026-08-16T00:00:00+08:00',
      validTo: '2026-08-16T23:59:59.999+08:00',
    })
    expect(store.listEvents(father!.id).map(event => event.eventType)).toEqual(['entity.created'])
    expect(store.listEvents(claim!.id).map(event => event.eventType)).toEqual(['claim.observed'])
    expect(store.recall('爸爸什么时候来', { workspaceId: 'workspace-a' }).selectedClaims).toEqual([])

    const repeated = store.applyGraphExtractionBatch(graphEnvelope(source.id), {
      ownerEntityId: owner.id,
      idempotencyKey: 'graph:turn-2',
    })
    expect(repeated.entities).toEqual([expect.objectContaining({ entityId: father!.id, decision: 'reused' })])
    expect(repeated.outcomes).toEqual([expect.objectContaining({
      claimId: claim!.id,
      decision: 'duplicate',
    })])
  })

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
