import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import {
  PERSONAL_CORE_SCHEMA_VERSION,
  PersonalContinuityStore,
  PersonalCoreSchemaTooNewError,
  type ContinuityScope,
  type MemoryClaim,
} from '../src/index.js'

interface Fixture {
  store: PersonalContinuityStore
  tick(milliseconds?: number): void
}

const stores: PersonalContinuityStore[] = []
const directories: string[] = []

function fixture(databasePath = ':memory:'): Fixture {
  let current = Date.parse('2026-08-15T00:00:00.000Z')
  let sequence = 0
  const store = new PersonalContinuityStore({
    databasePath,
    now: () => new Date(current),
    idFactory: prefix => `${prefix}-${String(++sequence).padStart(4, '0')}`,
  })
  stores.push(store)
  return {
    store,
    tick(milliseconds = 1_000): void {
      current += milliseconds
    },
  }
}

function temporaryDatabase(): { directory: string; databasePath: string } {
  const directory = mkdtempSync(join(tmpdir(), 'telos-personal-core-'))
  directories.push(directory)
  return { directory, databasePath: join(directory, 'continuity.sqlite') }
}

function source(f: Fixture, suffix: string, content = `source ${suffix}`): string {
  return f.store.createSourceEpisode({
    sourceKind: 'dsh.session',
    runtimeId: 'dsh',
    sourceInstanceId: `session-${suffix}`,
    sessionId: `session-${suffix}`,
    seqStart: 1,
    seqEnd: 2,
    content,
  }).id
}

function entity(f: Fixture, suffix: string, scope: ContinuityScope = { type: 'global' }): string {
  return f.store.createEntity({
    kind: suffix === 'user' ? 'person' : 'project',
    canonicalName: suffix,
    scope,
    idempotencyKey: `entity:${suffix}:${scope.type}:${scope.type === 'global' ? '' : scope.id}`,
  }).id
}

function remember(
  f: Fixture,
  input: {
    suffix: string
    subjectEntityId: string
    sourceEpisodeId: string
    statement?: string
    predicate?: string
    objectValue?: string
    scope?: ContinuityScope
    sensitivity?: 'personal' | 'sensitive' | 'secret'
    kind?: MemoryClaim['kind']
    status?: 'candidate' | 'confirmed'
    validFrom?: string
    validTo?: string
  },
): MemoryClaim {
  return f.store.remember({
    kind: input.kind ?? 'semantic',
    statement: input.statement ?? `statement ${input.suffix}`,
    predicate: input.predicate ?? `predicate.${input.suffix}`,
    subjectEntityId: input.subjectEntityId,
    objectValue: input.objectValue ?? input.suffix,
    status: input.status,
    confidence: 0.9,
    importance: 0.8,
    sensitivity: input.sensitivity,
    scope: input.scope ?? { type: 'global' },
    validFrom: input.validFrom,
    validTo: input.validTo,
    sourceEpisodeIds: [input.sourceEpisodeId],
    idempotencyKey: `claim:${input.suffix}`,
  })
}

afterEach(() => {
  for (const store of stores.splice(0)) store.close()
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('PersonalContinuityStore schema and durability', () => {
  it('migrates a new database, passes integrity checks, restricts file permissions and reopens data', () => {
    const { databasePath } = temporaryDatabase()
    const first = fixture(databasePath)
    const episodeId = source(first, 'durable', 'durable evidence')
    const personId = entity(first, 'user')
    const claim = remember(first, {
      suffix: 'durable',
      subjectEntityId: personId,
      sourceEpisodeId: episodeId,
      statement: '用户希望 Telos 记住长期目标',
    })

    expect(first.store.schemaVersion()).toBe(PERSONAL_CORE_SCHEMA_VERSION)
    expect(first.store.integrityCheck()).toBe('ok')
    if (process.platform !== 'win32') expect(statSync(databasePath).mode & 0o777).toBe(0o600)
    first.store.close()
    stores.splice(stores.indexOf(first.store), 1)

    const reopened = fixture(databasePath)
    expect(reopened.store.getClaim(claim.id)).toMatchObject({
      statement: '用户希望 Telos 记住长期目标',
      sourceEpisodeIds: [episodeId],
    })
    expect(reopened.store.integrityCheck()).toBe('ok')
  })

  it('refuses to open a database created by a newer incompatible schema', () => {
    const { databasePath } = temporaryDatabase()
    const database = new DatabaseSync(databasePath)
    database.exec('CREATE TABLE schema_migration (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL) STRICT;')
    database.prepare('INSERT INTO schema_migration(version, applied_at) VALUES (?, ?)').run(99, '2026-08-15T00:00:00.000Z')
    database.close()

    expect(() => fixture(databasePath)).toThrowError(PersonalCoreSchemaTooNewError)
  })
})

describe('sources, entities and claims', () => {
  it('makes source, entity, alias and claim ingestion idempotent', () => {
    const f = fixture()
    const firstSource = f.store.createSourceEpisode({
      sourceKind: 'dsh.session',
      sourceInstanceId: 'session-a',
      sessionId: 'session-a',
      seqStart: 4,
      seqEnd: 8,
      content: 'same evidence',
    })
    const secondSource = f.store.createSourceEpisode({
      sourceKind: 'dsh.session',
      sourceInstanceId: 'session-a',
      sessionId: 'session-a',
      seqStart: 4,
      seqEnd: 8,
      content: 'same evidence',
    })
    expect(secondSource.id).toBe(firstSource.id)

    const personInput = {
      kind: 'person' as const,
      canonicalName: '小可',
      scope: { type: 'global' } as const,
      idempotencyKey: 'entity:user',
    }
    const firstEntity = f.store.createEntity(personInput)
    expect(f.store.createEntity(personInput).id).toBe(firstEntity.id)
    const aliasInput = {
      entityId: firstEntity.id,
      alias: 'XiaoKe',
      scope: { type: 'global' } as const,
      sourceEpisodeId: firstSource.id,
      idempotencyKey: 'alias:user:english',
    }
    const firstAlias = f.store.addAlias(aliasInput)
    expect(f.store.addAlias(aliasInput).id).toBe(firstAlias.id)

    const claimInput = {
      statement: '用户偏好有证据的产品判断',
      predicate: 'prefers',
      subjectEntityId: firstEntity.id,
      objectValue: 'evidence-backed product decisions',
      confidence: 1,
      importance: 0.9,
      scope: { type: 'global' } as const,
      sourceEpisodeIds: [firstSource.id],
      idempotencyKey: 'claim:preference:evidence',
    }
    const firstClaim = f.store.remember({ ...claimInput, kind: 'semantic' })
    expect(f.store.remember({ ...claimInput, kind: 'semantic' }).id).toBe(firstClaim.id)
    expect(f.store.listEvents(firstClaim.id)).toHaveLength(1)
    expect(JSON.stringify(f.store.listEvents(firstClaim.id))).not.toContain(firstClaim.statement)
  })

  it('corrects a claim by superseding it while preserving the evidence trail', () => {
    const f = fixture()
    const oldSource = source(f, 'old')
    const newSource = source(f, 'new')
    const personId = entity(f, 'user')
    const oldClaim = remember(f, {
      suffix: 'editor',
      subjectEntityId: personId,
      sourceEpisodeId: oldSource,
      statement: '用户主要使用 Vim',
      predicate: 'uses.editor',
      objectValue: 'Vim',
    })
    f.tick()

    const corrected = f.store.correct({
      claimId: oldClaim.id,
      kind: 'semantic',
      statement: '用户主要使用 IntelliJ IDEA',
      predicate: 'uses.editor',
      subjectEntityId: personId,
      objectValue: 'IntelliJ IDEA',
      confidence: 1,
      importance: 0.8,
      scope: { type: 'global' },
      sourceEpisodeIds: [newSource],
      idempotencyKey: 'correct:editor',
    })

    expect(f.store.getClaim(oldClaim.id)).toMatchObject({ status: 'superseded', supersededByClaimId: corrected.id })
    expect(corrected).toMatchObject({ status: 'confirmed', supersedesClaimId: oldClaim.id })
    expect(f.store.correct({
      claimId: oldClaim.id,
      kind: 'semantic',
      statement: '用户主要使用 IntelliJ IDEA',
      predicate: 'uses.editor',
      subjectEntityId: personId,
      objectValue: 'IntelliJ IDEA',
      confidence: 1,
      importance: 0.8,
      scope: { type: 'global' },
      sourceEpisodeIds: [newSource],
      idempotencyKey: 'correct:editor',
    }).id).toBe(corrected.id)
    const decision = f.store.recall('用户使用什么 editor', {}, { minScore: 0 })
    expect(decision.selectedClaims.map(claim => claim.id)).toContain(corrected.id)
    expect(decision.selectedClaims.map(claim => claim.id)).not.toContain(oldClaim.id)
  })

  it('rolls back invalid writes without leaving partial events or claims', () => {
    const f = fixture()
    const episodeId = source(f, 'rollback')
    const personId = entity(f, 'user')
    const before = f.store.listEvents().length

    expect(() => f.store.remember({
      kind: 'semantic',
      statement: 'invalid claim',
      predicate: 'invalid',
      subjectEntityId: personId,
      objectEntityId: personId,
      objectValue: 'also a value',
      confidence: 0.9,
      importance: 0.5,
      scope: { type: 'global' },
      sourceEpisodeIds: [episodeId],
      idempotencyKey: 'claim:invalid',
    })).toThrow(/exactly one/)
    expect(f.store.listClaims()).toHaveLength(0)
    expect(f.store.listEvents()).toHaveLength(before)
  })
})

describe('recall policy and graph projection', () => {
  it('enforces workspace, session, sensitivity, candidate and validity gates', () => {
    const f = fixture()
    const episodeId = source(f, 'gates')
    const personId = entity(f, 'user')
    const global = remember(f, { suffix: 'global', subjectEntityId: personId, sourceEpisodeId: episodeId, statement: 'global needle' })
    const workspace = remember(f, {
      suffix: 'workspace', subjectEntityId: personId, sourceEpisodeId: episodeId, statement: 'workspace needle', scope: { type: 'workspace', id: 'workspace-a' },
    })
    const session = remember(f, {
      suffix: 'session', subjectEntityId: personId, sourceEpisodeId: episodeId, statement: 'session needle', scope: { type: 'session', id: 'session-a' },
    })
    const secret = remember(f, {
      suffix: 'secret', subjectEntityId: personId, sourceEpisodeId: episodeId, statement: 'secret needle', sensitivity: 'secret',
    })
    const candidate = remember(f, {
      suffix: 'candidate', subjectEntityId: personId, sourceEpisodeId: episodeId, statement: 'candidate needle', status: 'candidate',
    })
    const expired = remember(f, {
      suffix: 'expired', subjectEntityId: personId, sourceEpisodeId: episodeId, statement: 'expired needle', validTo: '2026-08-14T00:00:00.000Z',
    })

    const defaultDecision = f.store.recall('needle', {}, { minScore: 0, maxClaims: 20 })
    expect(defaultDecision.selectedClaims.map(claim => claim.id)).toEqual([global.id])
    expect(defaultDecision.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ claimId: workspace.id, reason: 'out-of-scope' }),
      expect.objectContaining({ claimId: session.id, reason: 'out-of-scope' }),
      expect.objectContaining({ claimId: secret.id, reason: 'sensitivity-denied' }),
      expect.objectContaining({ claimId: candidate.id, reason: 'inactive' }),
      expect.objectContaining({ claimId: expired.id, reason: 'invalid-time' }),
    ]))

    const privileged = f.store.recall('needle', {
      workspaceId: 'workspace-a',
      sessionId: 'session-a',
      includeCandidates: true,
      allowedSensitivities: ['personal', 'secret'],
    }, { minScore: 0, maxClaims: 20 })
    expect(privileged.selectedClaims.map(claim => claim.id)).toEqual(expect.arrayContaining([
      global.id, workspace.id, session.id, secret.id, candidate.id,
    ]))
    expect(privileged.selectedClaims.map(claim => claim.id)).not.toContain(expired.id)
  })

  it('retrieves through entity aliases and a rebuildable graph projection', () => {
    const f = fixture()
    const episodeId = source(f, 'graph')
    const personId = entity(f, 'user')
    const telosId = entity(f, 'Telos')
    const pluginId = entity(f, 'Continuity Plugin')
    f.store.addAlias({
      entityId: telosId,
      alias: '个人超级系统',
      scope: { type: 'global' },
      sourceEpisodeId: episodeId,
      idempotencyKey: 'alias:telos:cn',
    })
    const owns = f.store.remember({
      kind: 'semantic',
      statement: '用户拥有 Telos',
      predicate: 'owns',
      subjectEntityId: personId,
      objectEntityId: telosId,
      confidence: 1,
      importance: 0.9,
      scope: { type: 'global' },
      sourceEpisodeIds: [episodeId],
      idempotencyKey: 'claim:user:owns:telos',
    })
    const includes = f.store.remember({
      kind: 'semantic',
      statement: 'Telos 包含 Continuity Plugin',
      predicate: 'includes',
      subjectEntityId: telosId,
      objectEntityId: pluginId,
      confidence: 1,
      importance: 0.8,
      scope: { type: 'global' },
      sourceEpisodeIds: [episodeId],
      idempotencyKey: 'claim:telos:includes:plugin',
    })

    const first = f.store.recall('个人超级系统', {}, { minScore: 0, graphDepth: 2, maxClaims: 10 })
    expect(first.selectedClaims.map(claim => claim.id)).toEqual(expect.arrayContaining([owns.id, includes.id]))
    expect(f.store.listRelations({ entityId: telosId }).map(relation => relation.claimId))
      .toEqual(expect.arrayContaining([owns.id, includes.id]))
    f.store.rebuildProjections()
    const rebuilt = f.store.recall('个人超级系统', {}, { minScore: 0, graphDepth: 2, maxClaims: 10 })
    expect(rebuilt.selectedClaims.map(claim => claim.id)).toEqual(expect.arrayContaining([owns.id, includes.id]))
    expect(f.store.integrityCheck()).toBe('ok')
  })

  it('records real contradictions but does not label duplicate values as contradictions', () => {
    const f = fixture()
    const episodeId = source(f, 'contradiction')
    const personId = entity(f, 'user')
    const darkOne = remember(f, {
      suffix: 'theme-dark-1', subjectEntityId: personId, sourceEpisodeId: episodeId, statement: '用户主题是深色', predicate: 'ui.theme', objectValue: 'dark',
    })
    const darkTwo = remember(f, {
      suffix: 'theme-dark-2', subjectEntityId: personId, sourceEpisodeId: episodeId, statement: '用户喜欢 dark 主题', predicate: 'ui.theme', objectValue: 'dark',
    })
    const light = remember(f, {
      suffix: 'theme-light', subjectEntityId: personId, sourceEpisodeId: episodeId, statement: '用户主题是浅色', predicate: 'ui.theme', objectValue: 'light',
    })
    const decision = f.store.recall('user', {}, { minScore: 0, maxClaims: 10 })

    expect(decision.contradictionSets).toHaveLength(1)
    expect(decision.contradictionSets[0]).toEqual(expect.arrayContaining([darkOne.id, darkTwo.id, light.id]))
  })

  it('never renders a context pack beyond its character or claim budget', () => {
    const f = fixture()
    const episodeId = source(f, 'budget')
    const personId = entity(f, 'user')
    for (let index = 0; index < 5; index += 1) {
      remember(f, {
        suffix: `budget-${String(index)}`,
        subjectEntityId: personId,
        sourceEpisodeId: episodeId,
        statement: `budget needle ${'long '.repeat(25)}${String(index)}`,
      })
    }
    const decision = f.store.recall('budget needle', {}, { minScore: 0, maxClaims: 2, maxChars: 300 })

    expect(decision.selectedClaims.length).toBeLessThanOrEqual(2)
    expect(decision.contextPack.charCount).toBeLessThanOrEqual(300)
    expect(decision.candidates.some(candidate => candidate.reason === 'over-budget')).toBe(true)
    expect(f.store.explainRecall(decision.id)).toEqual(decision)
  })
})

describe('privacy, receipts and recovery', () => {
  it('tracks recall materializations and returns an honest deletion report', () => {
    const f = fixture()
    const episodeId = source(f, 'forget', 'highly private source')
    const personId = entity(f, 'user')
    const claim = remember(f, {
      suffix: 'forget', subjectEntityId: personId, sourceEpisodeId: episodeId, statement: 'private forget needle',
    })
    const decision = f.store.recall('private forget needle', {}, { minScore: 0 })
    const materializations = f.store.recordMaterialization({
      recallId: decision.id,
      runtimeId: 'dsh',
      sessionId: 'session-materialized',
      seqStart: 10,
      seqEnd: 11,
      renderedContentHash: decision.contextPack.contentHash,
    })
    expect(materializations).toHaveLength(1)

    const report = f.store.forget(claim.id, {
      physical: true,
      purgeSourceContent: true,
      idempotencyKey: 'forget:claim',
    })
    expect(report).toMatchObject({
      revoked: true,
      physicallyPurged: true,
      sourceStates: [{ sourceEpisodeId: episodeId, state: 'purged' }],
      derivatives: [{
        runtimeId: 'dsh',
        sessionId: 'session-materialized',
        seqStart: 10,
        seqEnd: 11,
        state: 'requires-session-deletion',
      }],
    })
    expect(f.store.getClaim(claim.id)).toBeUndefined()
    expect(f.store.getSourceEpisode(episodeId)).toMatchObject({ content: undefined, deletionState: 'purged' })
    expect(f.store.recall('private forget needle', {}, { minScore: 0 }).selectedClaims).toHaveLength(0)
    expect(f.store.forget(claim.id, {
      physical: true,
      purgeSourceContent: true,
      idempotencyKey: 'forget:claim',
    })).toEqual(report)
    expect(f.store.listForgetReports(claim.id)).toEqual([report])
  })

  it('keeps shared source content while another active claim still references it', () => {
    const f = fixture()
    const episodeId = source(f, 'shared', 'shared evidence')
    const personId = entity(f, 'user')
    const first = remember(f, { suffix: 'shared-a', subjectEntityId: personId, sourceEpisodeId: episodeId })
    remember(f, { suffix: 'shared-b', subjectEntityId: personId, sourceEpisodeId: episodeId })

    const report = f.store.forget(first.id, { purgeSourceContent: true, idempotencyKey: 'forget:shared-a' })
    expect(report.sourceStates).toEqual([{ sourceEpisodeId: episodeId, state: 'retained-reference' }])
    expect(f.store.getSourceEpisode(episodeId)?.content).toBe('shared evidence')
  })

  it('records idempotent action receipts with provenance but without raw action text in events', () => {
    const f = fixture()
    const episodeId = source(f, 'receipt')
    const personId = entity(f, 'user')
    const input = {
      action: 'write /private/path',
      authorization: 'allowed' as const,
      runtimeId: 'dsh',
      provider: 'filesystem',
      result: 'succeeded' as const,
      scope: { type: 'workspace', id: 'workspace-a' } as const,
      sourceEpisodeIds: [episodeId],
      affectedEntityIds: [personId],
      idempotencyKey: 'receipt:write:1',
    }
    const first = f.store.recordActionReceipt(input)
    expect(f.store.recordActionReceipt(input).id).toBe(first.id)
    const event = f.store.listEvents(first.id)[0]
    expect(event).toMatchObject({ eventType: 'action.received', actor: 'runtime' })
    expect(JSON.stringify(event)).not.toContain('/private/path')
    expect(f.store.listActionReceipts({ scope: { type: 'workspace', id: 'workspace-a' } })).toEqual([first])
    expect(f.store.listActionReceipts({ scope: { type: 'workspace', id: 'workspace-b' } })).toEqual([])
    expect(f.store.listEntities({ kinds: ['person'] }).map(item => item.id)).toEqual([personId])
    expect(f.store.listSourceEpisodes({ sessionId: 'session-receipt' }).map(item => item.id)).toEqual([episodeId])
  })

  it('reclaims expired leases, retries failed jobs and marks exhausted jobs dead', () => {
    const f = fixture()
    const enqueued = f.store.enqueue('extract-memory', { sessionId: 'session-a' }, 'job:extract:a')
    expect(f.store.enqueue('extract-memory', { sessionId: 'session-a' }, 'job:extract:a').id).toBe(enqueued.id)
    const firstLease = f.store.claimOutbox(1, 1_000)[0]
    expect(firstLease).toMatchObject({ status: 'processing', attempts: 1 })
    expect(f.store.claimOutbox()).toHaveLength(0)
    f.tick(1_001)
    const reclaimed = f.store.claimOutbox(1, 1_000)[0]
    expect(reclaimed).toMatchObject({ id: enqueued.id, status: 'processing', attempts: 2 })
    const retry = f.store.failOutbox(enqueued.id, new Error('temporary'), { maxAttempts: 3, retryDelayMs: 0 })
    expect(retry).toMatchObject({ status: 'pending', attempts: 2 })
    const finalLease = f.store.claimOutbox(1, 1_000)[0]
    expect(finalLease.attempts).toBe(3)
    const dead = f.store.failOutbox(enqueued.id, 'permanent', { maxAttempts: 3 })
    expect(dead).toMatchObject({ status: 'dead', attempts: 3, lastError: 'permanent' })

    const second = f.store.enqueue('reindex', {}, 'job:reindex')
    const leasedSecond = f.store.claimOutbox(1, 1_000)[0]
    expect(leasedSecond.id).toBe(second.id)
    expect(f.store.completeOutbox(second.id)).toMatchObject({ status: 'completed', attempts: 1 })
  })
})
