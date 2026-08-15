import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  PersonalContinuityStore,
  type ContinuityScope,
  type MemoryClaim,
  type RecallDecision,
} from '@telos/personal-core'

export type ScenarioStatus = 'PASS' | 'FAIL'

export interface ContinuityBenchScenario {
  id: string
  name: string
  status: ScenarioStatus
  durationMs: number
  evidence: Readonly<Record<string, unknown>>
  error?: string
}

export interface ContinuityBenchMetrics {
  validRecallPrecision: number
  staleMemoryErrorRate: number
  scopeLeakRate: number
  provenanceCoverage: number
  correctionConvergence: number
  continuationSuccess: number
  deletionCompleteness: number
  duplicateInjectionRate: number
  p95RecallLatencyMs: number
  maxContextPackChars: number
}

export interface ContinuityBenchReport {
  benchmark: 'Telos ContinuityBench'
  version: 1
  status: ScenarioStatus
  generatedAt: string
  adapter: { name: '@telos/personal-core'; storage: 'SQLite + FTS5 + rebuildable graph projection' }
  comparison: { communityAdapters: 'NOT_RUN'; reason: string }
  scenarios: readonly ContinuityBenchScenario[]
  metrics: ContinuityBenchMetrics
  thresholds: Readonly<Record<keyof ContinuityBenchMetrics, string>>
}

export interface ContinuityBenchOptions {
  dshParityVerified: boolean
  now?: () => Date
}

interface MetricState {
  selected: number
  relevant: number
  stale: number
  scopeChecks: number
  scopeLeaks: number
  provenanceExpected: number
  provenancePresent: number
  correctionExpected: number
  correctionConverged: number
  continuationExpected: number
  continuationSucceeded: number
  deletionExpected: number
  deletionSucceeded: number
  duplicateAttempts: number
  duplicateInjections: number
  recallLatencies: number[]
  contextChars: number[]
}

interface Fixture {
  store: PersonalContinuityStore
  ownerId: string
  sourceId: string
  close(): void
}

const THRESHOLDS: ContinuityBenchReport['thresholds'] = {
  validRecallPrecision: '>= 1.0 on deterministic relevant sets',
  staleMemoryErrorRate: '= 0',
  scopeLeakRate: '= 0',
  provenanceCoverage: '= 1.0',
  correctionConvergence: '= 1.0',
  continuationSuccess: '= 1.0',
  deletionCompleteness: '= 1.0 for Core plus honest derivative reporting',
  duplicateInjectionRate: '= 0',
  p95RecallLatencyMs: '<= 100 ms on the deterministic local fixture',
  maxContextPackChars: '<= 2400',
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function roundedRatio(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : Math.round((numerator / denominator) * 10_000) / 10_000
}

function p95(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  return Math.round(sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)]! * 1_000) / 1_000
}

function createFixture(options: { databasePath?: string; runtimeId?: string; sourceInstanceId?: string } = {}): Fixture {
  let sequence = 0
  const store = new PersonalContinuityStore({
    databasePath: options.databasePath ?? ':memory:',
    now: () => new Date('2026-08-15T00:00:00.000Z'),
    idFactory: prefix => `${prefix}-${String(++sequence).padStart(4, '0')}`,
  })
  const owner = store.createEntity({
    id: 'telos:bench-owner',
    kind: 'person',
    canonicalName: 'Benchmark User',
    scope: { type: 'global' },
    actor: 'system',
    idempotencyKey: 'bench:owner',
  })
  const source = store.createSourceEpisode({
    sourceKind: 'continuity-bench.fixture',
    runtimeId: options.runtimeId ?? 'dsh',
    sourceInstanceId: options.sourceInstanceId ?? 'bench-source',
    sessionId: 'session-source',
    seqStart: 10,
    seqEnd: 11,
    content: 'deterministic benchmark evidence',
  })
  return { store, ownerId: owner.id, sourceId: source.id, close: () => store.close() }
}

function remember(fixture: Fixture, input: {
  id: string
  statement: string
  predicate: string
  value: string
  scope?: ContinuityScope
  kind?: MemoryClaim['kind']
  validTo?: string
  importance?: number
}): MemoryClaim {
  return fixture.store.remember({
    kind: input.kind ?? 'semantic',
    statement: input.statement,
    predicate: input.predicate,
    subjectEntityId: fixture.ownerId,
    objectValue: input.value,
    confidence: 1,
    importance: input.importance ?? 0.8,
    sensitivity: 'personal',
    scope: input.scope ?? { type: 'global' },
    validTo: input.validTo,
    sourceEpisodeIds: [fixture.sourceId],
    idempotencyKey: `bench:claim:${input.id}`,
  })
}

function observeRecall(metrics: MetricState, decision: RecallDecision, relevantIds: readonly string[], forbiddenIds: readonly string[] = []): void {
  const relevant = new Set(relevantIds)
  const forbidden = new Set(forbiddenIds)
  metrics.selected += decision.selectedClaims.length
  metrics.relevant += decision.selectedClaims.filter(claim => relevant.has(claim.id)).length
  metrics.stale += decision.selectedClaims.filter(claim => ['superseded', 'contradicted', 'revoked', 'expired'].includes(claim.status)).length
  metrics.scopeChecks += forbidden.size
  metrics.scopeLeaks += decision.selectedClaims.filter(claim => forbidden.has(claim.id)).length
  metrics.provenanceExpected += decision.selectedClaims.length
  metrics.provenancePresent += decision.selectedClaims.filter(claim => claim.sourceEpisodeIds.length > 0).length
  metrics.recallLatencies.push(decision.latencyMs)
  metrics.contextChars.push(decision.contextPack.charCount)
}

function metricState(): MetricState {
  return {
    selected: 0,
    relevant: 0,
    stale: 0,
    scopeChecks: 0,
    scopeLeaks: 0,
    provenanceExpected: 0,
    provenancePresent: 0,
    correctionExpected: 0,
    correctionConverged: 0,
    continuationExpected: 0,
    continuationSucceeded: 0,
    deletionExpected: 0,
    deletionSucceeded: 0,
    duplicateAttempts: 0,
    duplicateInjections: 0,
    recallLatencies: [],
    contextChars: [],
  }
}

function runScenario(
  id: string,
  name: string,
  execute: () => Readonly<Record<string, unknown>>,
): ContinuityBenchScenario {
  const started = performance.now()
  try {
    const evidence = execute()
    return { id, name, status: 'PASS', durationMs: performance.now() - started, evidence }
  } catch (error) {
    return {
      id,
      name,
      status: 'FAIL',
      durationMs: performance.now() - started,
      evidence: {},
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export function runContinuityBench(options: ContinuityBenchOptions): ContinuityBenchReport {
  const metrics = metricState()
  const scenarios: ContinuityBenchScenario[] = []

  scenarios.push(runScenario('CB-01', 'cross-session decision recovery', () => {
    const fixture = createFixture()
    try {
      const decision = remember(fixture, {
        id: 'cross-session',
        statement: 'Telos additions preserve the DSH baseline',
        predicate: 'decision.dsh_baseline',
        value: 'preserve',
        scope: { type: 'workspace', id: 'workspace-a' },
      })
      const recalled = fixture.store.recall('DSH baseline', { workspaceId: 'workspace-a', sessionId: 'session-new' }, { minScore: 0 })
      observeRecall(metrics, recalled, [decision.id])
      metrics.continuationExpected += 1
      if (recalled.selectedClaims.some(claim => claim.id === decision.id)) metrics.continuationSucceeded += 1
      assert(recalled.selectedClaims.some(claim => claim.id === decision.id), 'decision did not cross the session boundary')
      return { claimId: decision.id, recallId: recalled.id }
    } finally {
      fixture.close()
    }
  }))

  scenarios.push(runScenario('CB-02', 'same-workspace sharing and cross-workspace isolation', () => {
    const fixture = createFixture()
    try {
      const claim = remember(fixture, {
        id: 'workspace', statement: 'Workspace A uses a pinned source runtime', predicate: 'workspace.runtime', value: 'pinned', scope: { type: 'workspace', id: 'workspace-a' },
      })
      const same = fixture.store.recall('pinned source runtime', { workspaceId: 'workspace-a', sessionId: 'session-b' }, { minScore: 0 })
      const isolated = fixture.store.recall('pinned source runtime', { workspaceId: 'workspace-b', sessionId: 'session-c' }, { minScore: 0 })
      observeRecall(metrics, same, [claim.id])
      observeRecall(metrics, isolated, [], [claim.id])
      assert(same.selectedClaims.some(entry => entry.id === claim.id), 'same-workspace recall failed')
      assert(!isolated.selectedClaims.some(entry => entry.id === claim.id), 'workspace claim leaked')
      return { sameWorkspaceSelected: same.selectedClaims.length, isolatedSelected: isolated.selectedClaims.length }
    } finally {
      fixture.close()
    }
  }))

  scenarios.push(runScenario('CB-03', 'global and session-only scope', () => {
    const fixture = createFixture()
    try {
      const global = remember(fixture, { id: 'global', statement: 'Global answer style is evidence-first', predicate: 'preference.answer', value: 'evidence-first' })
      const local = remember(fixture, {
        id: 'session', statement: 'This session is drafting release notes', predicate: 'session.activity', value: 'release-notes', scope: { type: 'session', id: 'session-a' },
      })
      const own = fixture.store.recall('answer style release notes', { sessionId: 'session-a' }, { minScore: 0, maxClaims: 10 })
      const other = fixture.store.recall('answer style release notes', { sessionId: 'session-b' }, { minScore: 0, maxClaims: 10 })
      observeRecall(metrics, own, [global.id, local.id])
      observeRecall(metrics, other, [global.id], [local.id])
      assert(own.selectedClaims.some(entry => entry.id === local.id), 'session claim was unavailable in its session')
      assert(!other.selectedClaims.some(entry => entry.id === local.id), 'session claim leaked to another session')
      return { ownIds: own.contextPack.claimIds, otherIds: other.contextPack.claimIds }
    } finally {
      fixture.close()
    }
  }))

  scenarios.push(runScenario('CB-04', 'model and runtime independent recall contract', () => {
    const left = createFixture({ runtimeId: 'dsh', sourceInstanceId: 'left-source' })
    const right = createFixture({ runtimeId: 'future-runtime', sourceInstanceId: 'right-source' })
    try {
      const input = { id: 'portable', statement: 'Personal state belongs to Telos', predicate: 'architecture.owner', value: 'Telos' }
      const leftClaim = remember(left, input)
      const rightClaim = remember(right, input)
      const leftRecall = left.store.recall('who owns personal state', {}, { minScore: 0 })
      const rightRecall = right.store.recall('who owns personal state', {}, { minScore: 0 })
      observeRecall(metrics, leftRecall, [leftClaim.id])
      observeRecall(metrics, rightRecall, [rightClaim.id])
      assert(leftRecall.contextPack.text === rightRecall.contextPack.text, 'runtime changed the recall contract')
      return { contentHash: leftRecall.contextPack.contentHash, runtimeIndependent: true }
    } finally {
      left.close()
      right.close()
    }
  }))

  scenarios.push(runScenario('CB-05', 'correction, contradiction, supersession, and expiration', () => {
    const fixture = createFixture()
    try {
      const old = remember(fixture, { id: 'editor-old', statement: 'Primary editor is Vim', predicate: 'preference.editor', value: 'Vim' })
      const correctedSource = fixture.store.createSourceEpisode({ sourceKind: 'bench.correction', sourceInstanceId: 'correction', content: 'Primary editor changed' })
      const current = fixture.store.correct({
        claimId: old.id,
        kind: 'semantic',
        statement: 'Primary editor is IntelliJ IDEA',
        predicate: 'preference.editor',
        subjectEntityId: fixture.ownerId,
        objectValue: 'IntelliJ IDEA',
        confidence: 1,
        importance: 0.8,
        scope: { type: 'global' },
        sourceEpisodeIds: [correctedSource.id],
        idempotencyKey: 'bench:correct-editor',
      })
      const contradicted = remember(fixture, { id: 'theme', statement: 'Theme is light', predicate: 'preference.theme', value: 'light' })
      fixture.store.contradict(contradicted.id, { sourceEpisodeIds: [correctedSource.id], idempotencyKey: 'bench:contradict-theme' })
      const expired = remember(fixture, {
        id: 'temporary', statement: 'Temporary migration window is open', predicate: 'window.migration', value: 'open', validTo: '2026-08-14T00:00:00.000Z',
      })
      const recalled = fixture.store.recall('primary editor theme migration', {}, { minScore: 0, maxClaims: 10 })
      observeRecall(metrics, recalled, [current.id], [old.id, contradicted.id, expired.id])
      metrics.correctionExpected += 1
      if (recalled.selectedClaims.some(claim => claim.id === current.id)
        && !recalled.selectedClaims.some(claim => claim.id === old.id)) metrics.correctionConverged += 1
      assert(fixture.store.getClaim(old.id)?.status === 'superseded', 'old value was not superseded')
      assert(fixture.store.getClaim(contradicted.id)?.status === 'contradicted', 'contradiction transition was lost')
      assert(!recalled.selectedClaims.some(claim => claim.id === expired.id), 'expired memory was selected')
      return { currentClaimId: current.id, selectedIds: recalled.contextPack.claimIds }
    } finally {
      fixture.close()
    }
  }))

  scenarios.push(runScenario('CB-06', 'open-loop and commitment recovery', () => {
    const fixture = createFixture()
    try {
      const commitment = remember(fixture, {
        id: 'commitment', statement: 'Finish the release checklist', predicate: 'commitment.open', value: 'release-checklist', kind: 'prospective', scope: { type: 'workspace', id: 'workspace-a' }, importance: 1,
      })
      const recalled = fixture.store.recall('what remains next', { workspaceId: 'workspace-a', sessionId: 'session-later' }, { minScore: 0 })
      observeRecall(metrics, recalled, [commitment.id])
      metrics.continuationExpected += 1
      if (recalled.selectedClaims.some(claim => claim.id === commitment.id)) metrics.continuationSucceeded += 1
      assert(recalled.selectedClaims.some(claim => claim.id === commitment.id), 'open commitment was not recovered')
      return { commitmentId: commitment.id, recallId: recalled.id }
    } finally {
      fixture.close()
    }
  }))

  scenarios.push(runScenario('CB-07', 'action-versus-constraint conflict detection', () => {
    const fixture = createFixture()
    try {
      const constraint = remember(fixture, {
        id: 'constraint', statement: 'Do not publish to production without approval', predicate: 'constraint.forbids', value: 'publish to production', kind: 'constraint', scope: { type: 'workspace', id: 'workspace-a' }, importance: 1,
      })
      const conflicts = fixture.store.evaluateActionConstraints('publish to production now', { workspaceId: 'workspace-a' })
      const isolated = fixture.store.evaluateActionConstraints('publish to production now', { workspaceId: 'workspace-b' })
      assert(conflicts.some(conflict => conflict.claimId === constraint.id), 'applicable constraint did not block the action')
      assert(isolated.length === 0, 'constraint leaked into a different workspace')
      return { conflicts, isolatedCount: isolated.length }
    } finally {
      fixture.close()
    }
  }))

  scenarios.push(runScenario('CB-08', 'source expansion and explanation completeness', () => {
    const fixture = createFixture()
    try {
      const claim = remember(fixture, { id: 'provenance', statement: 'Explanations retain exact source ranges', predicate: 'architecture.provenance', value: 'exact-range' })
      const recalled = fixture.store.recall('exact source ranges', {}, { minScore: 0 })
      observeRecall(metrics, recalled, [claim.id])
      const explanation = fixture.store.explainRecall(recalled.id)
      const source = fixture.store.getSourceEpisode(claim.sourceEpisodeIds[0]!)
      assert(explanation !== undefined, 'recall explanation was not persisted')
      assert(source !== undefined, 'claim source was not expandable')
      assert(explanation.selectedClaims.some(entry => entry.id === claim.id), 'explanation omitted the selected claim')
      assert(source.seqStart === 10 && source.seqEnd === 11, 'source expansion lost the event range')
      assert(explanation.candidates.some(candidate => candidate.claimId === claim.id && candidate.reason === 'selected'), 'selection reason was not persisted')
      return { recallId: recalled.id, sourceEpisodeId: source.id, range: [source.seqStart, source.seqEnd] }
    } finally {
      fixture.close()
    }
  }))

  scenarios.push(runScenario('CB-09', 'immediate revocation and physical-deletion reporting', () => {
    const fixture = createFixture()
    try {
      const claim = remember(fixture, { id: 'delete', statement: 'Delete this private benchmark fact', predicate: 'privacy.delete', value: 'private-fact' })
      const recalled = fixture.store.recall('private benchmark fact', { sessionId: 'session-materialized' }, { minScore: 0 })
      observeRecall(metrics, recalled, [claim.id])
      fixture.store.recordMaterialization({
        recallId: recalled.id,
        runtimeId: 'dsh',
        sessionId: 'session-materialized',
        seqStart: 20,
        seqEnd: 20,
        renderedContentHash: recalled.contextPack.contentHash,
      })
      const report = fixture.store.forget(claim.id, { physical: true, purgeSourceContent: true, idempotencyKey: 'bench:delete' })
      metrics.deletionExpected += 1
      if (fixture.store.getClaim(claim.id) === undefined
        && fixture.store.getSourceEpisode(fixture.sourceId)?.deletionState === 'purged'
        && report.derivatives[0]?.state === 'requires-session-deletion') metrics.deletionSucceeded += 1
      assert(fixture.store.getClaim(claim.id) === undefined, 'claim survived physical deletion')
      assert(report.derivatives[0]?.state === 'requires-session-deletion', 'materialized copy was reported as erased')
      return { receiptId: report.receiptId, derivatives: report.derivatives }
    } finally {
      fixture.close()
    }
  }))

  scenarios.push(runScenario('CB-10', 'idempotent replay, crash recovery, and projection rebuild', () => {
    const directory = mkdtempSync(join(tmpdir(), 'telos-continuity-bench-'))
    const databasePath = join(directory, 'continuity.sqlite')
    let fixture = createFixture({ databasePath })
    try {
      const input = { id: 'recovery', statement: 'Recovery keeps authoritative claims', predicate: 'recovery.state', value: 'durable' }
      const first = remember(fixture, input)
      const replayed = remember(fixture, input)
      metrics.duplicateAttempts += 1
      if (fixture.store.listClaims().filter(claim => claim.contentHash === first.contentHash).length > 1) metrics.duplicateInjections += 1
      assert(replayed.id === first.id, 'idempotent replay created another claim')
      fixture.close()
      fixture = createFixture({ databasePath })
      fixture.store.rebuildProjections()
      const recovered = fixture.store.recall('authoritative claims durable', {}, { minScore: 0 })
      observeRecall(metrics, recovered, [first.id])
      assert(recovered.selectedClaims.some(claim => claim.id === first.id), 'reopened database lost the claim')
      assert(fixture.store.listRelations().some(relation => relation.claimId === first.id), 'projection rebuild lost the relation')
      assert(fixture.store.integrityCheck() === 'ok', 'recovered database failed integrity check')
      return { claimId: first.id, integrity: fixture.store.integrityCheck() }
    } finally {
      fixture.close()
      rmSync(directory, { recursive: true, force: true })
    }
  }))

  scenarios.push(runScenario('CB-11', 'prompt budget, latency, and duplicate-injection limits', () => {
    const fixture = createFixture()
    try {
      const claimIds: string[] = []
      for (let index = 0; index < 20; index += 1) {
        claimIds.push(remember(fixture, {
          id: `budget-${String(index)}`,
          statement: `Benchmark budget fact ${String(index)} ${'bounded '.repeat(8)}`,
          predicate: `benchmark.fact_${String(index)}`,
          value: `value-${String(index)}`,
        }).id)
      }
      let last: RecallDecision | undefined
      for (let index = 0; index < 50; index += 1) {
        last = fixture.store.recall('Benchmark budget fact', {}, { minScore: 0, maxClaims: 4, maxChars: 600 })
        observeRecall(metrics, last, last.contextPack.claimIds)
        const unique = new Set(last.contextPack.claimIds)
        metrics.duplicateAttempts += 1
        if (unique.size !== last.contextPack.claimIds.length) metrics.duplicateInjections += 1
      }
      assert(last !== undefined && last.selectedClaims.length <= 4, 'claim budget was exceeded')
      assert(last.contextPack.charCount <= 600, 'character budget was exceeded')
      assert(p95(metrics.recallLatencies) <= 100, 'p95 recall latency exceeded 100 ms')
      return { iterations: 50, p95LatencyMs: p95(metrics.recallLatencies), lastChars: last.contextPack.charCount, fixtureClaims: claimIds.length }
    } finally {
      fixture.close()
    }
  }))

  scenarios.push(runScenario('CB-12', 'plugin-disabled DSH baseline parity', () => {
    assert(options.dshParityVerified, 'DSH parity was not verified by the repository parity gate')
    return { externalGate: 'pnpm dsh:parity', verified: true }
  }))

  const reportMetrics: ContinuityBenchMetrics = {
    validRecallPrecision: roundedRatio(metrics.relevant, metrics.selected),
    staleMemoryErrorRate: roundedRatio(metrics.stale, metrics.selected),
    scopeLeakRate: roundedRatio(metrics.scopeLeaks, metrics.scopeChecks),
    provenanceCoverage: roundedRatio(metrics.provenancePresent, metrics.provenanceExpected),
    correctionConvergence: roundedRatio(metrics.correctionConverged, metrics.correctionExpected),
    continuationSuccess: roundedRatio(metrics.continuationSucceeded, metrics.continuationExpected),
    deletionCompleteness: roundedRatio(metrics.deletionSucceeded, metrics.deletionExpected),
    duplicateInjectionRate: roundedRatio(metrics.duplicateInjections, metrics.duplicateAttempts),
    p95RecallLatencyMs: p95(metrics.recallLatencies),
    maxContextPackChars: Math.max(0, ...metrics.contextChars),
  }
  const metricsPass = reportMetrics.validRecallPrecision === 1
    && reportMetrics.staleMemoryErrorRate === 0
    && reportMetrics.scopeLeakRate === 0
    && reportMetrics.provenanceCoverage === 1
    && reportMetrics.correctionConvergence === 1
    && reportMetrics.continuationSuccess === 1
    && reportMetrics.deletionCompleteness === 1
    && reportMetrics.duplicateInjectionRate === 0
    && reportMetrics.p95RecallLatencyMs <= 100
    && reportMetrics.maxContextPackChars <= 2_400

  return {
    benchmark: 'Telos ContinuityBench',
    version: 1,
    status: scenarios.every(scenario => scenario.status === 'PASS') && metricsPass ? 'PASS' : 'FAIL',
    generatedAt: (options.now ?? (() => new Date()))().toISOString(),
    adapter: { name: '@telos/personal-core', storage: 'SQLite + FTS5 + rebuildable graph projection' },
    comparison: {
      communityAdapters: 'NOT_RUN',
      reason: 'No pinned community adapter implements the same Telos claim, scope, provenance, correction, and deletion contract yet.',
    },
    scenarios,
    metrics: reportMetrics,
    thresholds: THRESHOLDS,
  }
}
