import { createHash, randomUUID } from 'node:crypto'
import { chmodSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { MIGRATION_1, PERSONAL_CORE_SCHEMA_VERSION } from './schema.js'
import type {
  ActionReceipt,
  ActionReceiptInput,
  ActorKind,
  AddAliasInput,
  ClaimKind,
  ClaimStatus,
  ContextPack,
  ContinuityScope,
  CorrectClaimInput,
  CreateEntityInput,
  CreateSourceEpisodeInput,
  Entity,
  EntityAlias,
  EntityEvent,
  EntityEventType,
  ForgetReport,
  MemoryClaim,
  OutboxJob,
  PersonalCoreOptions,
  RecallCandidate,
  RecallContext,
  RecallDecision,
  RecallMaterialization,
  RecallOptions,
  RecallReason,
  RelationProjection,
  RecordMaterializationInput,
  RememberClaimInput,
  ScopeType,
  Sensitivity,
  SourceEpisode,
} from './types.js'

type SqlValue = string | number | bigint | Uint8Array | null
type Row = Record<string, SqlValue>

const ACTIVE_CLAIM_STATUSES = new Set<ClaimStatus>(['confirmed'])
const DEFAULT_ALLOWED_SENSITIVITIES: readonly Sensitivity[] = ['personal']
const DEFAULT_MAX_CLAIMS = 8
const DEFAULT_MAX_CHARS = 2_400
const DEFAULT_GRAPH_DEPTH = 2
const DEFAULT_MIN_SCORE = 0.12

function asString(value: SqlValue | undefined, field: string): string {
  if (typeof value !== 'string') throw new TypeError(`expected ${field} to be a string`)
  return value
}

function asOptionalString(value: SqlValue | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function asNumber(value: SqlValue | undefined, field: string): number {
  if (typeof value !== 'number' && typeof value !== 'bigint') throw new TypeError(`expected ${field} to be a number`)
  return Number(value)
}

function assertNonEmpty(value: string, field: string): string {
  const normalized = value.trim()
  if (normalized.length === 0) throw new TypeError(`${field} must not be empty`)
  return normalized
}

function assertUnitInterval(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError(`${field} must be between 0 and 1`)
  return value
}

function assertIso(value: string, field: string): string {
  if (!Number.isFinite(Date.parse(value))) throw new TypeError(`${field} must be an ISO-8601 timestamp`)
  return value
}

function normalizedText(value: string): string {
  return value.trim().normalize('NFKC').toLocaleLowerCase()
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function canonicalJson(value: unknown): string {
  if (value === undefined || value === null) return 'null'
  if (typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .filter(key => record[key] !== undefined)
    .sort()
    .map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`
}

function scopeColumns(scope: ContinuityScope): { scopeType: ScopeType; scopeId: string | null } {
  if (scope.type === 'global') return { scopeType: 'global', scopeId: null }
  return { scopeType: scope.type, scopeId: assertNonEmpty(scope.id, 'scope.id') }
}

function scopeFromRow(row: Row): ContinuityScope {
  const type = asString(row.scope_type, 'scope_type') as ScopeType
  if (type === 'global') return { type }
  return { type, id: asString(row.scope_id, 'scope_id') }
}

function parseJson<T>(value: SqlValue | undefined, field: string): T {
  return JSON.parse(asString(value, field)) as T
}

function ftsQuery(query: string): string | undefined {
  const tokens = normalizedText(query).match(/[\p{L}\p{N}_-]+/gu)
  if (tokens === null || tokens.length === 0) return undefined
  return [...new Set(tokens)].slice(0, 12).map(token => `"${token.replaceAll('"', '""')}"*`).join(' OR ')
}

function millisecondsBetween(now: string, past: string): number {
  return Math.max(0, Date.parse(now) - Date.parse(past))
}

export class PersonalCoreSchemaTooNewError extends Error {
  constructor(readonly foundVersion: number) {
    super(`personal core schema ${String(foundVersion)} is newer than supported version ${String(PERSONAL_CORE_SCHEMA_VERSION)}`)
    this.name = 'PersonalCoreSchemaTooNewError'
  }
}

export class PersonalContinuityStore {
  readonly databasePath: string
  private readonly db: DatabaseSync
  private readonly now: () => Date
  private readonly idFactory: (prefix: string) => string
  private closed = false

  constructor(options: PersonalCoreOptions) {
    this.databasePath = options.databasePath === ':memory:' ? ':memory:' : resolve(options.databasePath)
    this.now = options.now ?? (() => new Date())
    this.idFactory = options.idFactory ?? (prefix => `${prefix}_${randomUUID()}`)
    if (this.databasePath !== ':memory:') mkdirSync(dirname(this.databasePath), { recursive: true, mode: 0o700 })
    this.db = new DatabaseSync(this.databasePath)
    if (this.databasePath !== ':memory:' && process.platform !== 'win32') chmodSync(this.databasePath, 0o600)
    this.configure()
    this.migrate()
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.db.close()
  }

  integrityCheck(): string {
    this.assertOpen()
    const row = this.db.prepare('PRAGMA integrity_check').get() as Row
    return asString(Object.values(row)[0], 'integrity_check')
  }

  schemaVersion(): number {
    this.assertOpen()
    const row = this.db.prepare('SELECT max(version) AS version FROM schema_migration').get() as Row
    return row.version === null ? 0 : asNumber(row.version, 'version')
  }

  createSourceEpisode(input: CreateSourceEpisodeInput): SourceEpisode {
    this.assertOpen()
    const sourceKind = assertNonEmpty(input.sourceKind, 'sourceKind')
    const sourceInstanceId = assertNonEmpty(input.sourceInstanceId, 'sourceInstanceId')
    const hasSeqStart = input.seqStart !== undefined
    const hasSeqEnd = input.seqEnd !== undefined
    if (hasSeqStart !== hasSeqEnd) {
      throw new TypeError('seqStart and seqEnd must be provided together')
    }
    if (input.seqStart !== undefined && (!Number.isInteger(input.seqStart) || input.seqStart < 0 || input.seqEnd! < input.seqStart)) {
      throw new RangeError('source sequence range is invalid')
    }
    const observedAt = assertIso(input.observedAt ?? this.isoNow(), 'observedAt')
    const recordedAt = this.isoNow()
    const contentHash = input.contentHash ?? hash(input.content ?? canonicalJson({
      sourceKind,
      sourceInstanceId,
      sessionId: input.sessionId,
      seqStart: input.seqStart,
      seqEnd: input.seqEnd,
    }))
    const existing = this.db.prepare(`
      SELECT * FROM source_episode
      WHERE source_kind = ? AND source_instance_id = ? AND ifnull(session_id, '') = ifnull(?, '')
        AND ifnull(seq_start, -1) = ifnull(?, -1) AND ifnull(seq_end, -1) = ifnull(?, -1)
    `).get(sourceKind, sourceInstanceId, input.sessionId ?? null, input.seqStart ?? null, input.seqEnd ?? null) as Row | undefined
    if (existing !== undefined) {
      const episode = this.sourceEpisodeFromRow(existing)
      if (episode.contentHash !== contentHash) throw new Error(`source episode origin already exists with different content: ${episode.id}`)
      return episode
    }
    const id = input.id ?? this.newId('src')
    this.db.prepare(`
      INSERT INTO source_episode (
        id, source_kind, runtime_id, source_instance_id, session_id, seq_start, seq_end,
        observed_at, recorded_at, content, content_hash, sensitivity, deletion_state
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(
      id,
      sourceKind,
      input.runtimeId ?? null,
      sourceInstanceId,
      input.sessionId ?? null,
      input.seqStart ?? null,
      input.seqEnd ?? null,
      observedAt,
      recordedAt,
      input.content ?? null,
      contentHash,
      input.sensitivity ?? 'personal',
    )
    return this.requireSourceEpisode(id)
  }

  getSourceEpisode(id: string): SourceEpisode | undefined {
    this.assertOpen()
    const row = this.db.prepare('SELECT * FROM source_episode WHERE id = ?').get(id) as Row | undefined
    return row === undefined ? undefined : this.sourceEpisodeFromRow(row)
  }

  listSourceEpisodes(options: { sessionId?: string; deletionStates?: readonly SourceEpisode['deletionState'][]; limit?: number } = {}): SourceEpisode[] {
    this.assertOpen()
    const conditions: string[] = []
    const params: SqlValue[] = []
    if (options.sessionId !== undefined) {
      conditions.push('session_id = ?')
      params.push(options.sessionId)
    }
    if (options.deletionStates !== undefined && options.deletionStates.length > 0) {
      conditions.push(`deletion_state IN (${options.deletionStates.map(() => '?').join(',')})`)
      params.push(...options.deletionStates)
    }
    const limit = Math.max(1, Math.min(options.limit ?? 100, 1_000))
    const sql = `SELECT * FROM source_episode ${conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`} ORDER BY observed_at DESC, id DESC LIMIT ?`
    params.push(limit)
    return (this.db.prepare(sql).all(...params) as Row[]).map(row => this.sourceEpisodeFromRow(row))
  }

  createEntity(input: CreateEntityInput): Entity {
    this.assertOpen()
    const existingEvent = this.eventByIdempotencyKey(input.idempotencyKey)
    if (existingEvent !== undefined) return this.requireEntity(existingEvent.aggregateId)
    const id = input.id ?? this.newId('ent')
    const canonicalName = assertNonEmpty(input.canonicalName, 'canonicalName')
    const occurredAt = assertIso(input.occurredAt ?? this.isoNow(), 'occurredAt')
    const recordedAt = this.isoNow()
    const { scopeType, scopeId } = scopeColumns(input.scope)
    const sourceEpisodeIds = [...(input.sourceEpisodeIds ?? [])]
    this.assertSources(sourceEpisodeIds)
    this.transaction(() => {
      this.db.prepare(`
        INSERT INTO entity (id, kind, canonical_name, scope_type, scope_id, status, created_at, updated_at, revision)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?, 1)
      `).run(id, input.kind, canonicalName, scopeType, scopeId, recordedAt, recordedAt)
      this.insertEvent({
        eventType: 'entity.created',
        aggregateId: id,
        payload: { kind: input.kind, canonicalNameHash: hash(canonicalName) },
        scope: input.scope,
        sourceEpisodeIds,
        actor: input.actor ?? 'user',
        occurredAt,
        idempotencyKey: input.idempotencyKey,
      })
    })
    return this.requireEntity(id)
  }

  getEntity(id: string): Entity | undefined {
    this.assertOpen()
    const row = this.db.prepare('SELECT * FROM entity WHERE id = ?').get(id) as Row | undefined
    return row === undefined ? undefined : this.entityFromRow(row)
  }

  listEntities(options: { scope?: ContinuityScope; kinds?: readonly Entity['kind'][]; limit?: number } = {}): Entity[] {
    this.assertOpen()
    const conditions: string[] = ["status <> 'deleted'"]
    const params: SqlValue[] = []
    if (options.scope !== undefined) {
      const { scopeType, scopeId } = scopeColumns(options.scope)
      conditions.push("scope_type = ? AND ifnull(scope_id, '') = ifnull(?, '')")
      params.push(scopeType, scopeId)
    }
    if (options.kinds !== undefined && options.kinds.length > 0) {
      conditions.push(`kind IN (${options.kinds.map(() => '?').join(',')})`)
      params.push(...options.kinds)
    }
    const limit = Math.max(1, Math.min(options.limit ?? 100, 1_000))
    params.push(limit)
    return (this.db.prepare(`
      SELECT * FROM entity WHERE ${conditions.join(' AND ')}
      ORDER BY updated_at DESC, id DESC LIMIT ?
    `).all(...params) as Row[]).map(row => this.entityFromRow(row))
  }

  addAlias(input: AddAliasInput): EntityAlias {
    this.assertOpen()
    const existingEvent = this.eventByIdempotencyKey(input.idempotencyKey)
    if (existingEvent !== undefined) {
      const aliasId = String(existingEvent.payload.aliasId ?? '')
      return this.requireAlias(aliasId)
    }
    this.requireEntity(input.entityId)
    if (input.sourceEpisodeId !== undefined) this.requireSourceEpisode(input.sourceEpisodeId)
    const alias = assertNonEmpty(input.alias, 'alias')
    const normalizedAlias = normalizedText(alias)
    const id = input.id ?? this.newId('alias')
    const recordedAt = this.isoNow()
    const occurredAt = assertIso(input.occurredAt ?? recordedAt, 'occurredAt')
    const { scopeType, scopeId } = scopeColumns(input.scope)
    this.transaction(() => {
      this.db.prepare(`
        INSERT INTO entity_alias (id, entity_id, alias, normalized_alias, scope_type, scope_id, source_episode_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, input.entityId, alias, normalizedAlias, scopeType, scopeId, input.sourceEpisodeId ?? null, recordedAt)
      this.insertEvent({
        eventType: 'entity.aliased',
        aggregateId: input.entityId,
        payload: { aliasId: id, aliasHash: hash(alias) },
        scope: input.scope,
        sourceEpisodeIds: input.sourceEpisodeId === undefined ? [] : [input.sourceEpisodeId],
        actor: input.actor ?? 'user',
        occurredAt,
        idempotencyKey: input.idempotencyKey,
      })
      this.refreshClaimSearchForEntity(input.entityId)
    })
    return this.requireAlias(id)
  }

  listAliases(entityId: string): EntityAlias[] {
    this.assertOpen()
    return (this.db.prepare('SELECT * FROM entity_alias WHERE entity_id = ? ORDER BY created_at, id').all(entityId) as Row[])
      .map(row => this.aliasFromRow(row))
  }

  remember(input: RememberClaimInput): MemoryClaim {
    return this.writeClaim(input, undefined, input.status ?? 'confirmed')
  }

  correct(input: CorrectClaimInput): MemoryClaim {
    this.assertOpen()
    const existingEvent = this.eventByIdempotencyKey(input.idempotencyKey)
    if (existingEvent !== undefined) {
      return this.requireClaim(String(existingEvent.payload.claimId ?? existingEvent.aggregateId))
    }
    const previous = this.requireClaim(input.claimId)
    if (!ACTIVE_CLAIM_STATUSES.has(previous.status) && previous.status !== 'candidate' && previous.status !== 'contradicted') {
      throw new Error(`claim ${input.claimId} cannot be corrected from status ${previous.status}`)
    }
    const replacement = this.writeClaim(input, previous, input.status ?? 'confirmed')
    return replacement
  }

  contradict(claimId: string, input: { sourceEpisodeIds: readonly string[]; actor?: ActorKind; occurredAt?: string; idempotencyKey: string }): MemoryClaim {
    return this.transitionClaim(claimId, 'contradicted', 'claim.contradicted', input)
  }

  expire(claimId: string, input: { actor?: ActorKind; occurredAt?: string; idempotencyKey: string }): MemoryClaim {
    return this.transitionClaim(claimId, 'expired', 'claim.expired', { ...input, sourceEpisodeIds: [] })
  }

  revoke(claimId: string, input: { sourceEpisodeIds?: readonly string[]; actor?: ActorKind; occurredAt?: string; idempotencyKey: string }): MemoryClaim {
    return this.transitionClaim(claimId, 'revoked', 'claim.revoked', {
      ...input,
      sourceEpisodeIds: input.sourceEpisodeIds ?? [],
    })
  }

  getClaim(id: string): MemoryClaim | undefined {
    this.assertOpen()
    const row = this.db.prepare('SELECT * FROM memory_claim WHERE id = ?').get(id) as Row | undefined
    return row === undefined ? undefined : this.claimFromRow(row)
  }

  listClaims(options: { statuses?: readonly ClaimStatus[]; scope?: ContinuityScope; limit?: number } = {}): MemoryClaim[] {
    this.assertOpen()
    const conditions: string[] = []
    const params: SqlValue[] = []
    if (options.statuses !== undefined && options.statuses.length > 0) {
      conditions.push(`status IN (${options.statuses.map(() => '?').join(',')})`)
      params.push(...options.statuses)
    }
    if (options.scope !== undefined) {
      const { scopeType, scopeId } = scopeColumns(options.scope)
      conditions.push('scope_type = ? AND ifnull(scope_id, \'\') = ifnull(?, \'\')')
      params.push(scopeType, scopeId)
    }
    const limit = Math.max(1, Math.min(options.limit ?? 100, 1_000))
    const sql = `SELECT * FROM memory_claim ${conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`} ORDER BY recorded_at DESC, id LIMIT ?`
    params.push(limit)
    return (this.db.prepare(sql).all(...params) as Row[]).map(row => this.claimFromRow(row))
  }

  listEvents(aggregateId?: string): EntityEvent[] {
    this.assertOpen()
    const rows = aggregateId === undefined
      ? this.db.prepare('SELECT * FROM entity_event ORDER BY recorded_at, id').all()
      : this.db.prepare('SELECT * FROM entity_event WHERE aggregate_id = ? ORDER BY recorded_at, id').all(aggregateId)
    return (rows as Row[]).map(row => this.eventFromRow(row))
  }

  listRelations(options: { entityId?: string; statuses?: readonly ClaimStatus[]; limit?: number } = {}): RelationProjection[] {
    this.assertOpen()
    const conditions: string[] = []
    const params: SqlValue[] = []
    if (options.entityId !== undefined) {
      conditions.push('(from_entity_id = ? OR to_entity_id = ?)')
      params.push(options.entityId, options.entityId)
    }
    if (options.statuses !== undefined && options.statuses.length > 0) {
      conditions.push(`status IN (${options.statuses.map(() => '?').join(',')})`)
      params.push(...options.statuses)
    }
    const limit = Math.max(1, Math.min(options.limit ?? 200, 2_000))
    params.push(limit)
    return (this.db.prepare(`
      SELECT * FROM relation_projection
      ${conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`}
      ORDER BY claim_id LIMIT ?
    `).all(...params) as Row[]).map(row => ({
      claimId: asString(row.claim_id, 'claim_id'),
      fromEntityId: asString(row.from_entity_id, 'from_entity_id'),
      predicate: asString(row.predicate, 'predicate'),
      toEntityId: asOptionalString(row.to_entity_id),
      objectValue: asOptionalString(row.object_value),
      validFrom: asOptionalString(row.valid_from),
      validTo: asOptionalString(row.valid_to),
      status: asString(row.status, 'status') as ClaimStatus,
    }))
  }

  recall(query: string, context: RecallContext = {}, options: RecallOptions = {}): RecallDecision {
    this.assertOpen()
    const started = performance.now()
    const createdAt = this.isoNow()
    const at = assertIso(context.at ?? createdAt, 'context.at')
    const maxClaims = Math.max(1, Math.min(options.maxClaims ?? DEFAULT_MAX_CLAIMS, 50))
    const maxChars = Math.max(128, Math.min(options.maxChars ?? DEFAULT_MAX_CHARS, 20_000))
    const graphDepth = Math.max(0, Math.min(options.graphDepth ?? DEFAULT_GRAPH_DEPTH, 4))
    const minScore = Math.max(0, Math.min(options.minScore ?? DEFAULT_MIN_SCORE, 1))
    const allowedSensitivities = context.allowedSensitivities ?? DEFAULT_ALLOWED_SENSITIVITIES
    const candidateIds = this.candidateClaimIds(query, context, graphDepth)
    const candidates: RecallCandidate[] = []
    const scored: { claim: MemoryClaim; score: number }[] = []
    for (const claimId of candidateIds) {
      const claim = this.getClaim(claimId)
      if (claim === undefined) continue
      const denied = this.recallDenialReason(claim, context, at, allowedSensitivities)
      if (denied !== undefined) {
        candidates.push({ claimId, score: 0, reason: denied })
        continue
      }
      const score = this.scoreClaim(claim, query, at)
      if (score < minScore) {
        candidates.push({ claimId, score, reason: 'below-score' })
      } else {
        scored.push({ claim, score })
      }
    }
    scored.sort((left, right) => right.score - left.score || right.claim.recordedAt.localeCompare(left.claim.recordedAt) || left.claim.id.localeCompare(right.claim.id))
    const selected: MemoryClaim[] = []
    for (const entry of scored) {
      const tentative = [...selected, entry.claim]
      const tentativeContradictions = this.findContradictionSets(tentative)
      if (selected.length >= maxClaims || this.renderContextPack('budget-check', tentative, tentativeContradictions).length > maxChars) {
        candidates.push({ claimId: entry.claim.id, score: entry.score, reason: 'over-budget' })
        continue
      }
      selected.push(entry.claim)
      candidates.push({ claimId: entry.claim.id, score: entry.score, reason: 'selected' })
    }
    const contradictionSets = this.findContradictionSets(selected)
    const id = this.newId('recall')
    const text = this.renderContextPack(id, selected, contradictionSets)
    const contextPack: ContextPack = {
      recallId: id,
      text,
      claimIds: selected.map(claim => claim.id),
      contentHash: hash(text),
      charCount: text.length,
    }
    const latencyMs = performance.now() - started
    this.transaction(() => {
      this.db.prepare(`
        INSERT INTO recall_run (
          id, query_text, query_fingerprint, context_json, contradiction_sets_json,
          context_pack_text, context_pack_hash, selected_claim_ids_json, char_count,
          latency_ms, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        query,
        hash(normalizedText(query)),
        canonicalJson({ ...context, at, allowedSensitivities }),
        canonicalJson(contradictionSets),
        text,
        contextPack.contentHash,
        canonicalJson(contextPack.claimIds),
        contextPack.charCount,
        latencyMs,
        createdAt,
      )
      const insert = this.db.prepare('INSERT INTO recall_candidate (recall_id, claim_id, score, reason) VALUES (?, ?, ?, ?)')
      for (const candidate of candidates) insert.run(id, candidate.claimId, candidate.score, candidate.reason)
    })
    return {
      id,
      query,
      queryFingerprint: hash(normalizedText(query)),
      context: { ...context, at, allowedSensitivities },
      candidates: candidates.sort((left, right) => right.score - left.score || left.claimId.localeCompare(right.claimId)),
      selectedClaims: selected,
      contradictionSets,
      contextPack,
      latencyMs,
      createdAt,
    }
  }

  explainRecall(id: string): RecallDecision | undefined {
    this.assertOpen()
    const row = this.db.prepare('SELECT * FROM recall_run WHERE id = ?').get(id) as Row | undefined
    if (row === undefined) return undefined
    const context = parseJson<RecallContext>(row.context_json, 'context_json')
    const selectedIds = parseJson<string[]>(row.selected_claim_ids_json, 'selected_claim_ids_json')
    const candidates = (this.db.prepare('SELECT * FROM recall_candidate WHERE recall_id = ? ORDER BY score DESC, claim_id').all(id) as Row[])
      .map(candidate => ({
        claimId: asString(candidate.claim_id, 'claim_id'),
        score: asNumber(candidate.score, 'score'),
        reason: asString(candidate.reason, 'reason') as RecallReason,
      }))
    const selectedClaims = selectedIds.map(claimId => this.getClaim(claimId)).filter((claim): claim is MemoryClaim => claim !== undefined)
    const text = asString(row.context_pack_text, 'context_pack_text')
    return {
      id,
      query: asString(row.query_text, 'query_text'),
      queryFingerprint: asString(row.query_fingerprint, 'query_fingerprint'),
      context,
      candidates,
      selectedClaims,
      contradictionSets: parseJson<string[][]>(row.contradiction_sets_json, 'contradiction_sets_json'),
      contextPack: {
        recallId: id,
        text,
        claimIds: selectedIds,
        contentHash: asString(row.context_pack_hash, 'context_pack_hash'),
        charCount: asNumber(row.char_count, 'char_count'),
      },
      latencyMs: asNumber(row.latency_ms, 'latency_ms'),
      createdAt: asString(row.created_at, 'created_at'),
    }
  }

  listRecallDecisions(options: { sessionId?: string; claimId?: string; limit?: number } = {}): RecallDecision[] {
    this.assertOpen()
    const conditions: string[] = []
    const params: SqlValue[] = []
    if (options.sessionId !== undefined) {
      conditions.push("json_extract(context_json, '$.sessionId') = ?")
      params.push(assertNonEmpty(options.sessionId, 'sessionId'))
    }
    if (options.claimId !== undefined) {
      conditions.push('EXISTS (SELECT 1 FROM json_each(selected_claim_ids_json) WHERE value = ?)')
      params.push(assertNonEmpty(options.claimId, 'claimId'))
    }
    const limit = Math.max(1, Math.min(Math.trunc(options.limit ?? 50), 500))
    params.push(limit)
    const where = conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`
    const rows = this.db.prepare(`
      SELECT id FROM recall_run ${where}
      ORDER BY created_at DESC, id DESC LIMIT ?
    `).all(...params) as Row[]
    return rows.map(row => this.explainRecall(asString(row.id, 'id')))
      .filter((decision): decision is RecallDecision => decision !== undefined)
  }

  recordMaterialization(input: RecordMaterializationInput): RecallMaterialization[] {
    this.assertOpen()
    if (!Number.isInteger(input.seqStart) || input.seqStart < 0 || !Number.isInteger(input.seqEnd) || input.seqEnd < input.seqStart) {
      throw new RangeError('materialization sequence range is invalid')
    }
    const recall = this.explainRecall(input.recallId)
    if (recall === undefined) throw new Error(`unknown recall ${input.recallId}`)
    const createdAt = this.isoNow()
    this.transaction(() => {
      const insert = this.db.prepare(`
        INSERT OR IGNORE INTO recall_materialization (
          id, recall_id, claim_id, runtime_id, session_id, seq_start, seq_end,
          rendered_content_hash, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const claimId of recall.contextPack.claimIds) {
        insert.run(
          this.newId('mat'),
          input.recallId,
          claimId,
          assertNonEmpty(input.runtimeId, 'runtimeId'),
          assertNonEmpty(input.sessionId, 'sessionId'),
          input.seqStart,
          input.seqEnd,
          input.renderedContentHash,
          createdAt,
        )
      }
    })
    return this.listMaterializationsForRecall(input.recallId)
  }

  listMaterializations(options: {
    recallId?: string
    claimId?: string
    sessionId?: string
    limit?: number
  } = {}): RecallMaterialization[] {
    this.assertOpen()
    const conditions: string[] = []
    const params: SqlValue[] = []
    for (const [column, value, field] of [
      ['recall_id', options.recallId, 'recallId'],
      ['claim_id', options.claimId, 'claimId'],
      ['session_id', options.sessionId, 'sessionId'],
    ] as const) {
      if (value === undefined) continue
      conditions.push(`${column} = ?`)
      params.push(assertNonEmpty(value, field))
    }
    const limit = Math.max(1, Math.min(Math.trunc(options.limit ?? 100), 1_000))
    params.push(limit)
    const where = conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`
    return (this.db.prepare(`
      SELECT * FROM recall_materialization ${where}
      ORDER BY created_at DESC, id DESC LIMIT ?
    `).all(...params) as Row[]).map(row => this.materializationFromRow(row))
  }

  forget(claimId: string, options: { physical?: boolean; purgeSourceContent?: boolean; idempotencyKey: string; actor?: ActorKind } ): ForgetReport {
    this.assertOpen()
    const existingReceipt = this.db.prepare('SELECT report_json FROM deletion_receipt WHERE idempotency_key = ?')
      .get(assertNonEmpty(options.idempotencyKey, 'idempotencyKey')) as Row | undefined
    if (existingReceipt !== undefined) return parseJson<ForgetReport>(existingReceipt.report_json, 'report_json')
    const claim = this.requireClaim(claimId)
    const receiptId = this.newId('deletion')
    const completedAt = this.isoNow()
    const sourceStates: { sourceEpisodeId: string; state: 'purged' | 'retained-reference' }[] = []
    const derivatives = this.listMaterializationsForClaim(claimId).map(materialization => ({
      runtimeId: materialization.runtimeId,
      sessionId: materialization.sessionId,
      seqStart: materialization.seqStart,
      seqEnd: materialization.seqEnd,
      state: 'requires-session-deletion' as const,
    }))
    const report: ForgetReport = {
      receiptId,
      claimId,
      revoked: true,
      physicallyPurged: options.physical === true,
      sourceStates,
      derivatives,
      completedAt,
    }
    this.transaction(() => {
      if (claim.status !== 'revoked') {
        this.transitionClaimInTransaction(claim, 'revoked', 'claim.revoked', {
          sourceEpisodeIds: [],
          actor: options.actor ?? 'user',
          occurredAt: completedAt,
          idempotencyKey: options.idempotencyKey,
        })
      }
      for (const sourceEpisodeId of claim.sourceEpisodeIds) {
        const activeReferences = asNumber((this.db.prepare(`
          SELECT count(*) AS count
          FROM claim_source cs JOIN memory_claim mc ON mc.id = cs.claim_id
          WHERE cs.source_episode_id = ? AND cs.claim_id <> ? AND mc.status NOT IN ('revoked', 'expired')
        `).get(sourceEpisodeId, claimId) as Row).count, 'count')
        if (options.purgeSourceContent === true && activeReferences === 0) {
          this.db.prepare("UPDATE source_episode SET content = NULL, deletion_state = 'purged' WHERE id = ?").run(sourceEpisodeId)
          sourceStates.push({ sourceEpisodeId, state: 'purged' })
        } else {
          sourceStates.push({ sourceEpisodeId, state: 'retained-reference' })
        }
      }
      if (options.physical === true) this.db.prepare('DELETE FROM memory_claim WHERE id = ?').run(claimId)
      this.db.prepare(`
        INSERT INTO deletion_receipt (id, claim_id, report_json, idempotency_key, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(receiptId, claimId, canonicalJson(report), options.idempotencyKey, completedAt)
    })
    return report
  }

  listForgetReports(claimId?: string): ForgetReport[] {
    this.assertOpen()
    const rows = claimId === undefined
      ? this.db.prepare('SELECT report_json FROM deletion_receipt ORDER BY created_at DESC, id DESC').all()
      : this.db.prepare('SELECT report_json FROM deletion_receipt WHERE claim_id = ? ORDER BY created_at DESC, id DESC').all(claimId)
    return (rows as Row[]).map(row => parseJson<ForgetReport>(row.report_json, 'report_json'))
  }

  recordActionReceipt(input: ActionReceiptInput): ActionReceipt {
    this.assertOpen()
    const existing = this.db.prepare('SELECT * FROM action_receipt WHERE idempotency_key = ?').get(input.idempotencyKey) as Row | undefined
    if (existing !== undefined) return this.actionReceiptFromRow(existing)
    this.assertSources(input.sourceEpisodeIds)
    for (const entityId of input.affectedEntityIds ?? []) this.requireEntity(entityId)
    const id = input.id ?? this.newId('receipt')
    const occurredAt = assertIso(input.occurredAt ?? this.isoNow(), 'occurredAt')
    const recordedAt = this.isoNow()
    const { scopeType, scopeId } = scopeColumns(input.scope)
    this.transaction(() => {
      this.db.prepare(`
        INSERT INTO action_receipt (
          id, action, authorization, runtime_id, provider, result, scope_type,
          scope_id, source_episode_ids_json, affected_entity_ids_json, occurred_at,
          recorded_at, idempotency_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        assertNonEmpty(input.action, 'action'),
        input.authorization,
        assertNonEmpty(input.runtimeId, 'runtimeId'),
        input.provider ?? null,
        input.result,
        scopeType,
        scopeId,
        canonicalJson(input.sourceEpisodeIds),
        canonicalJson(input.affectedEntityIds ?? []),
        occurredAt,
        recordedAt,
        input.idempotencyKey,
      )
      this.insertEvent({
        eventType: 'action.received',
        aggregateId: id,
        payload: {
          authorization: input.authorization,
          result: input.result,
          actionHash: hash(input.action),
          affectedEntityIds: input.affectedEntityIds ?? [],
        },
        scope: input.scope,
        sourceEpisodeIds: input.sourceEpisodeIds,
        actor: 'runtime',
        occurredAt,
        idempotencyKey: `event:${input.idempotencyKey}`,
      })
    })
    return this.requireActionReceipt(id)
  }

  listActionReceipts(options: { scope?: ContinuityScope; limit?: number } = {}): ActionReceipt[] {
    this.assertOpen()
    const params: SqlValue[] = []
    let where = ''
    if (options.scope !== undefined) {
      const { scopeType, scopeId } = scopeColumns(options.scope)
      where = "WHERE scope_type = ? AND ifnull(scope_id, '') = ifnull(?, '')"
      params.push(scopeType, scopeId)
    }
    const limit = Math.max(1, Math.min(options.limit ?? 100, 1_000))
    params.push(limit)
    return (this.db.prepare(`
      SELECT * FROM action_receipt ${where}
      ORDER BY recorded_at DESC, id DESC LIMIT ?
    `).all(...params) as Row[]).map(row => this.actionReceiptFromRow(row))
  }

  enqueue(jobType: string, payload: Readonly<Record<string, unknown>>, idempotencyKey: string, availableAt = this.isoNow()): OutboxJob {
    this.assertOpen()
    const existing = this.db.prepare('SELECT * FROM continuity_outbox WHERE idempotency_key = ?').get(idempotencyKey) as Row | undefined
    if (existing !== undefined) return this.outboxFromRow(existing)
    const id = this.newId('job')
    const now = this.isoNow()
    this.db.prepare(`
      INSERT INTO continuity_outbox (
        id, job_type, payload_json, status, attempts, available_at, lease_until,
        last_error, idempotency_key, created_at, updated_at
      ) VALUES (?, ?, ?, 'pending', 0, ?, NULL, NULL, ?, ?, ?)
    `).run(id, assertNonEmpty(jobType, 'jobType'), canonicalJson(payload), assertIso(availableAt, 'availableAt'), idempotencyKey, now, now)
    return this.requireOutbox(id)
  }

  claimOutbox(limit = 10, leaseMs = 60_000): OutboxJob[] {
    this.assertOpen()
    const boundedLimit = Math.max(1, Math.min(Math.trunc(limit), 100))
    if (!Number.isFinite(leaseMs) || leaseMs < 1_000) throw new RangeError('leaseMs must be at least 1000')
    const now = this.isoNow()
    const leaseUntil = new Date(Date.parse(now) + leaseMs).toISOString()
    const ids: string[] = []
    this.transaction(() => {
      const rows = this.db.prepare(`
        SELECT id FROM continuity_outbox
        WHERE (status = 'pending' AND available_at <= ?)
           OR (status = 'processing' AND lease_until <= ?)
        ORDER BY available_at, created_at, id
        LIMIT ?
      `).all(now, now, boundedLimit) as Row[]
      const update = this.db.prepare(`
        UPDATE continuity_outbox
        SET status = 'processing', attempts = attempts + 1, lease_until = ?, updated_at = ?
        WHERE id = ?
      `)
      for (const row of rows) {
        const id = asString(row.id, 'id')
        update.run(leaseUntil, now, id)
        ids.push(id)
      }
    })
    return ids.map(id => this.requireOutbox(id))
  }

  completeOutbox(id: string): OutboxJob {
    this.assertOpen()
    const now = this.isoNow()
    const result = this.db.prepare(`
      UPDATE continuity_outbox
      SET status = 'completed', lease_until = NULL, last_error = NULL, updated_at = ?
      WHERE id = ? AND status = 'processing'
    `).run(now, id)
    if (Number(result.changes) !== 1) throw new Error(`outbox job ${id} is not processing`)
    return this.requireOutbox(id)
  }

  failOutbox(id: string, error: unknown, options: { maxAttempts?: number; retryDelayMs?: number } = {}): OutboxJob {
    this.assertOpen()
    const job = this.requireOutbox(id)
    if (job.status !== 'processing') throw new Error(`outbox job ${id} is not processing`)
    const maxAttempts = Math.max(1, Math.trunc(options.maxAttempts ?? 5))
    const retryDelayMs = Math.max(0, options.retryDelayMs ?? 1_000)
    const now = this.isoNow()
    const status = job.attempts >= maxAttempts ? 'dead' : 'pending'
    const availableAt = new Date(Date.parse(now) + retryDelayMs).toISOString()
    this.db.prepare(`
      UPDATE continuity_outbox
      SET status = ?, available_at = ?, lease_until = NULL, last_error = ?, updated_at = ?
      WHERE id = ?
    `).run(status, availableAt, String(error), now, id)
    return this.requireOutbox(id)
  }

  rebuildProjections(): void {
    this.assertOpen()
    this.transaction(() => {
      this.db.exec('DELETE FROM relation_projection; DELETE FROM memory_claim_fts;')
      const claims = this.db.prepare('SELECT * FROM memory_claim ORDER BY recorded_at, id').all() as Row[]
      for (const row of claims) {
        const claim = this.claimFromRow(row)
        this.projectClaim(claim)
      }
    })
  }

  private configure(): void {
    this.db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')
    if (this.databasePath !== ':memory:') this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;')
  }

  private migrate(): void {
    this.db.exec('CREATE TABLE IF NOT EXISTS schema_migration (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL) STRICT;')
    const currentRow = this.db.prepare('SELECT max(version) AS version FROM schema_migration').get() as Row
    const current = currentRow.version === null ? 0 : asNumber(currentRow.version, 'version')
    if (current > PERSONAL_CORE_SCHEMA_VERSION) throw new PersonalCoreSchemaTooNewError(current)
    if (current < 1) {
      this.transaction(() => {
        this.db.exec(MIGRATION_1)
        this.db.prepare('INSERT INTO schema_migration(version, applied_at) VALUES (?, ?)').run(1, this.isoNow())
      })
    }
  }

  private writeClaim(input: RememberClaimInput, previous: MemoryClaim | undefined, status: 'candidate' | 'confirmed'): MemoryClaim {
    this.assertOpen()
    const existingEvent = this.eventByIdempotencyKey(input.idempotencyKey)
    if (existingEvent !== undefined) {
      const claimId = String(existingEvent.payload.claimId ?? existingEvent.aggregateId)
      return this.requireClaim(claimId)
    }
    this.requireEntity(input.subjectEntityId)
    const hasObjectEntity = input.objectEntityId !== undefined
    const hasObjectValue = input.objectValue !== undefined
    if (hasObjectEntity === hasObjectValue) {
      throw new TypeError('exactly one of objectEntityId or objectValue is required')
    }
    if (input.objectEntityId !== undefined) this.requireEntity(input.objectEntityId)
    this.assertSources(input.sourceEpisodeIds)
    const id = input.id ?? this.newId('claim')
    const statement = assertNonEmpty(input.statement, 'statement')
    const predicate = assertNonEmpty(input.predicate, 'predicate')
    const observedAt = assertIso(input.observedAt ?? this.isoNow(), 'observedAt')
    const recordedAt = this.isoNow()
    const validFrom = input.validFrom === undefined ? undefined : assertIso(input.validFrom, 'validFrom')
    const validTo = input.validTo === undefined ? undefined : assertIso(input.validTo, 'validTo')
    if (validFrom !== undefined && validTo !== undefined && validTo < validFrom) throw new RangeError('validTo precedes validFrom')
    const { scopeType, scopeId } = scopeColumns(input.scope)
    const contentHash = hash(canonicalJson({
      kind: input.kind,
      statement: normalizedText(statement),
      predicate: normalizedText(predicate),
      subjectEntityId: input.subjectEntityId,
      objectEntityId: input.objectEntityId,
      objectValue: input.objectValue,
      scope: input.scope,
      validFrom,
      validTo,
    }))
    this.transaction(() => {
      this.db.prepare(`
        INSERT INTO memory_claim (
          id, kind, statement, predicate, subject_entity_id, object_entity_id,
          object_value, status, confidence, importance, sensitivity, scope_type,
          scope_id, valid_from, valid_to, observed_at, recorded_at,
          supersedes_claim_id, superseded_by_claim_id, content_hash, revision
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 1)
      `).run(
        id,
        input.kind,
        statement,
        predicate,
        input.subjectEntityId,
        input.objectEntityId ?? null,
        input.objectValue ?? null,
        status,
        assertUnitInterval(input.confidence, 'confidence'),
        assertUnitInterval(input.importance, 'importance'),
        input.sensitivity ?? 'personal',
        scopeType,
        scopeId,
        validFrom ?? null,
        validTo ?? null,
        observedAt,
        recordedAt,
        previous?.id ?? null,
        contentHash,
      )
      const insertSource = this.db.prepare('INSERT INTO claim_source (claim_id, source_episode_id) VALUES (?, ?)')
      for (const sourceEpisodeId of new Set(input.sourceEpisodeIds)) insertSource.run(id, sourceEpisodeId)
      if (previous !== undefined) {
        this.db.prepare(`
          UPDATE memory_claim
          SET status = 'superseded', superseded_by_claim_id = ?, revision = revision + 1
          WHERE id = ?
        `).run(id, previous.id)
        this.removeClaimProjection(previous.id)
        this.insertEvent({
          eventType: 'claim.superseded',
          aggregateId: previous.id,
          payload: { claimId: previous.id, supersededByClaimId: id, contentHash: previous.contentHash },
          scope: previous.scope,
          sourceEpisodeIds: input.sourceEpisodeIds,
          actor: input.actor ?? 'user',
          occurredAt: observedAt,
          idempotencyKey: `${input.idempotencyKey}:supersede`,
        })
      }
      const claim = this.requireClaim(id)
      this.projectClaim(claim)
      this.insertEvent({
        eventType: previous === undefined
          ? (status === 'confirmed' ? 'claim.confirmed' : 'claim.observed')
          : 'claim.corrected',
        aggregateId: id,
        payload: {
          claimId: id,
          contentHash,
          status,
          supersedesClaimId: previous?.id,
        },
        scope: input.scope,
        sourceEpisodeIds: input.sourceEpisodeIds,
        actor: input.actor ?? 'user',
        occurredAt: observedAt,
        idempotencyKey: input.idempotencyKey,
      })
    })
    return this.requireClaim(id)
  }

  private transitionClaim(
    claimId: string,
    status: Extract<ClaimStatus, 'contradicted' | 'revoked' | 'expired'>,
    eventType: Extract<EntityEventType, 'claim.contradicted' | 'claim.revoked' | 'claim.expired'>,
    input: { sourceEpisodeIds: readonly string[]; actor?: ActorKind; occurredAt?: string; idempotencyKey: string },
  ): MemoryClaim {
    this.assertOpen()
    const existing = this.eventByIdempotencyKey(input.idempotencyKey)
    if (existing !== undefined) return this.requireClaim(claimId)
    const claim = this.requireClaim(claimId)
    this.assertSources(input.sourceEpisodeIds)
    this.transaction(() => this.transitionClaimInTransaction(claim, status, eventType, input))
    return this.requireClaim(claimId)
  }

  private transitionClaimInTransaction(
    claim: MemoryClaim,
    status: Extract<ClaimStatus, 'contradicted' | 'revoked' | 'expired'>,
    eventType: Extract<EntityEventType, 'claim.contradicted' | 'claim.revoked' | 'claim.expired'>,
    input: { sourceEpisodeIds: readonly string[]; actor?: ActorKind; occurredAt?: string; idempotencyKey: string },
  ): void {
    this.db.prepare('UPDATE memory_claim SET status = ?, revision = revision + 1 WHERE id = ?').run(status, claim.id)
    this.removeClaimProjection(claim.id)
    this.insertEvent({
      eventType,
      aggregateId: claim.id,
      payload: { claimId: claim.id, contentHash: claim.contentHash, status },
      scope: claim.scope,
      sourceEpisodeIds: input.sourceEpisodeIds,
      actor: input.actor ?? 'user',
      occurredAt: assertIso(input.occurredAt ?? this.isoNow(), 'occurredAt'),
      idempotencyKey: input.idempotencyKey,
    })
  }

  private insertEvent(input: {
    eventType: EntityEventType
    aggregateId: string
    payload: Readonly<Record<string, unknown>>
    scope: ContinuityScope
    sourceEpisodeIds: readonly string[]
    actor: ActorKind
    occurredAt: string
    idempotencyKey: string
  }): EntityEvent {
    this.assertSources(input.sourceEpisodeIds)
    const id = this.newId('evt')
    const recordedAt = this.isoNow()
    const { scopeType, scopeId } = scopeColumns(input.scope)
    this.db.prepare(`
      INSERT INTO entity_event (
        id, event_type, aggregate_id, payload_json, scope_type, scope_id,
        source_episode_ids_json, actor, occurred_at, recorded_at, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.eventType,
      input.aggregateId,
      canonicalJson(input.payload),
      scopeType,
      scopeId,
      canonicalJson([...new Set(input.sourceEpisodeIds)]),
      input.actor,
      assertIso(input.occurredAt, 'occurredAt'),
      recordedAt,
      assertNonEmpty(input.idempotencyKey, 'idempotencyKey'),
    )
    return this.eventFromRow(this.db.prepare('SELECT * FROM entity_event WHERE id = ?').get(id) as Row)
  }

  private projectClaim(claim: MemoryClaim): void {
    if (!ACTIVE_CLAIM_STATUSES.has(claim.status) && claim.status !== 'candidate') return
    this.db.prepare(`
      INSERT OR REPLACE INTO relation_projection (
        claim_id, from_entity_id, predicate, to_entity_id, object_value,
        valid_from, valid_to, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      claim.id,
      claim.subjectEntityId,
      claim.predicate,
      claim.objectEntityId ?? null,
      claim.objectValue ?? null,
      claim.validFrom ?? null,
      claim.validTo ?? null,
      claim.status,
    )
    const entityNames = this.entityNamesForClaim(claim)
    this.db.prepare('DELETE FROM memory_claim_fts WHERE claim_id = ?').run(claim.id)
    this.db.prepare('INSERT INTO memory_claim_fts (claim_id, statement, predicate, entity_names) VALUES (?, ?, ?, ?)')
      .run(claim.id, claim.statement, claim.predicate, entityNames.join(' '))
  }

  private removeClaimProjection(claimId: string): void {
    this.db.prepare('DELETE FROM relation_projection WHERE claim_id = ?').run(claimId)
    this.db.prepare('DELETE FROM memory_claim_fts WHERE claim_id = ?').run(claimId)
  }

  private refreshClaimSearchForEntity(entityId: string): void {
    const rows = this.db.prepare(`
      SELECT mc.* FROM memory_claim mc
      WHERE mc.subject_entity_id = ? OR mc.object_entity_id = ?
    `).all(entityId, entityId) as Row[]
    for (const row of rows) this.projectClaim(this.claimFromRow(row))
  }

  private entityNamesForClaim(claim: MemoryClaim): string[] {
    const ids = [claim.subjectEntityId, claim.objectEntityId].filter((id): id is string => id !== undefined)
    const names: string[] = []
    for (const id of ids) {
      const entity = this.requireEntity(id)
      names.push(entity.canonicalName, ...this.listAliases(id).map(alias => alias.alias))
    }
    return names
  }

  private candidateClaimIds(query: string, context: RecallContext, graphDepth: number): string[] {
    const ids = new Set<string>()
    const match = ftsQuery(query)
    if (match !== undefined) {
      const rows = this.db.prepare('SELECT claim_id FROM memory_claim_fts WHERE memory_claim_fts MATCH ? ORDER BY bm25(memory_claim_fts) LIMIT 200').all(match) as Row[]
      for (const row of rows) ids.add(asString(row.claim_id, 'claim_id'))
    }
    const normalizedQuery = normalizedText(query)
    const aliases = this.db.prepare('SELECT entity_id, normalized_alias FROM entity_alias ORDER BY length(normalized_alias) DESC').all() as Row[]
    const entityIds = new Set<string>()
    for (const row of aliases) {
      const alias = asString(row.normalized_alias, 'normalized_alias')
      if (alias.length > 0 && normalizedQuery.includes(alias)) entityIds.add(asString(row.entity_id, 'entity_id'))
    }
    const canonicalEntities = this.db.prepare('SELECT id, canonical_name FROM entity WHERE status = \'active\'').all() as Row[]
    for (const row of canonicalEntities) {
      const name = normalizedText(asString(row.canonical_name, 'canonical_name'))
      if (name.length > 0 && normalizedQuery.includes(name)) entityIds.add(asString(row.id, 'id'))
    }
    if (entityIds.size > 0) {
      const placeholders = [...entityIds].map(() => '?').join(',')
      const direct = this.db.prepare(`
        SELECT id FROM memory_claim
        WHERE subject_entity_id IN (${placeholders}) OR object_entity_id IN (${placeholders})
      `).all(...entityIds, ...entityIds) as Row[]
      for (const row of direct) ids.add(asString(row.id, 'id'))
      if (graphDepth > 0) {
        const graph = this.db.prepare(`
          WITH RECURSIVE neighbors(entity_id, depth) AS (
            SELECT value, 0 FROM json_each(?)
            UNION
            SELECT CASE WHEN rp.from_entity_id = n.entity_id THEN rp.to_entity_id ELSE rp.from_entity_id END, n.depth + 1
            FROM neighbors n JOIN relation_projection rp
              ON rp.from_entity_id = n.entity_id OR rp.to_entity_id = n.entity_id
            WHERE n.depth < ? AND rp.to_entity_id IS NOT NULL AND rp.status = 'confirmed'
          )
          SELECT DISTINCT rp.claim_id
          FROM neighbors n JOIN relation_projection rp
            ON rp.from_entity_id = n.entity_id OR rp.to_entity_id = n.entity_id
          WHERE n.depth <= ?
        `).all(canonicalJson([...entityIds]), graphDepth, graphDepth) as Row[]
        for (const row of graph) ids.add(asString(row.claim_id, 'claim_id'))
      }
    }
    const prospective = this.db.prepare(`
      SELECT id FROM memory_claim
      WHERE kind IN ('prospective', 'constraint') AND status IN ('confirmed', 'candidate')
      ORDER BY importance DESC, recorded_at DESC LIMIT 100
    `).all() as Row[]
    for (const row of prospective) ids.add(asString(row.id, 'id'))
    if (ids.size === 0 && normalizedQuery.length > 0) {
      const like = `%${normalizedQuery.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`
      const fallback = this.db.prepare("SELECT id FROM memory_claim WHERE lower(statement) LIKE ? ESCAPE '\\' LIMIT 100").all(like) as Row[]
      for (const row of fallback) ids.add(asString(row.id, 'id'))
    }
    if (ids.size === 0) {
      const recent = this.db.prepare('SELECT id FROM memory_claim ORDER BY importance DESC, recorded_at DESC LIMIT 50').all() as Row[]
      for (const row of recent) ids.add(asString(row.id, 'id'))
    }
    return [...ids]
  }

  private recallDenialReason(
    claim: MemoryClaim,
    context: RecallContext,
    at: string,
    allowedSensitivities: readonly Sensitivity[],
  ): Exclude<RecallReason, 'selected' | 'below-score' | 'over-budget'> | undefined {
    const active = ACTIVE_CLAIM_STATUSES.has(claim.status) || (context.includeCandidates === true && claim.status === 'candidate')
    if (!active) return 'inactive'
    if (!allowedSensitivities.includes(claim.sensitivity)) return 'sensitivity-denied'
    if (claim.scope.type === 'workspace' && claim.scope.id !== context.workspaceId) return 'out-of-scope'
    if (claim.scope.type === 'session' && claim.scope.id !== context.sessionId) return 'out-of-scope'
    if ((claim.validFrom !== undefined && claim.validFrom > at) || (claim.validTo !== undefined && claim.validTo < at)) return 'invalid-time'
    return undefined
  }

  private scoreClaim(claim: MemoryClaim, query: string, at: string): number {
    const normalizedQuery = normalizedText(query)
    const normalizedStatement = normalizedText(claim.statement)
    const normalizedPredicate = normalizedText(claim.predicate)
    let relevance = 0
    if (normalizedQuery.length > 0 && normalizedStatement.includes(normalizedQuery)) relevance += 0.35
    const queryTokens = new Set(normalizedQuery.match(/[\p{L}\p{N}_-]+/gu) ?? [])
    const claimTokens = new Set(`${normalizedStatement} ${normalizedPredicate}`.match(/[\p{L}\p{N}_-]+/gu) ?? [])
    if (queryTokens.size > 0) {
      const overlap = [...queryTokens].filter(token => claimTokens.has(token)).length
      relevance += 0.35 * (overlap / queryTokens.size)
    }
    const ageDays = millisecondsBetween(at, claim.recordedAt) / 86_400_000
    const freshness = Math.exp(-ageDays / 180)
    const prospectiveBoost = claim.kind === 'prospective' || claim.kind === 'constraint' ? 0.12 : 0
    return Math.min(1, relevance + claim.importance * 0.2 + claim.confidence * 0.18 + freshness * 0.15 + prospectiveBoost)
  }

  private findContradictionSets(claims: readonly MemoryClaim[]): string[][] {
    const groups = new Map<string, MemoryClaim[]>()
    for (const claim of claims) {
      const key = `${claim.subjectEntityId}:${normalizedText(claim.predicate)}`
      const group = groups.get(key) ?? []
      group.push(claim)
      groups.set(key, group)
    }
    return [...groups.values()]
      .filter(group => new Set(group.map(claim => claim.objectEntityId === undefined
        ? `value:${normalizedText(claim.objectValue ?? '')}`
        : `entity:${claim.objectEntityId}`)).size > 1)
      .map(group => group.map(claim => claim.id))
  }

  private renderClaim(claim: MemoryClaim): string {
    const sources = claim.sourceEpisodeIds.join(',')
    return `- [${claim.id}; ${claim.kind}; confidence=${claim.confidence.toFixed(2)}; sources=${sources}] ${claim.statement}`
  }

  private renderContextPack(recallId: string, claims: readonly MemoryClaim[], contradictionSets: readonly string[][]): string {
    if (claims.length === 0) return ''
    const lines = claims.map(claim => this.renderClaim(claim))
    const contradiction = contradictionSets.length === 0
      ? ''
      : `\nUnresolved claim sets: ${contradictionSets.map(group => group.join('|')).join(', ')}`
    return `<telos_continuity recall_id="${recallId}">\n${lines.join('\n')}${contradiction}\n</telos_continuity>`
  }

  private listMaterializationsForRecall(recallId: string): RecallMaterialization[] {
    return (this.db.prepare('SELECT * FROM recall_materialization WHERE recall_id = ? ORDER BY claim_id').all(recallId) as Row[])
      .map(row => this.materializationFromRow(row))
  }

  private listMaterializationsForClaim(claimId: string): RecallMaterialization[] {
    return (this.db.prepare('SELECT * FROM recall_materialization WHERE claim_id = ? ORDER BY created_at, id').all(claimId) as Row[])
      .map(row => this.materializationFromRow(row))
  }

  private eventByIdempotencyKey(key: string): EntityEvent | undefined {
    const row = this.db.prepare('SELECT * FROM entity_event WHERE idempotency_key = ?').get(assertNonEmpty(key, 'idempotencyKey')) as Row | undefined
    return row === undefined ? undefined : this.eventFromRow(row)
  }

  private assertSources(sourceEpisodeIds: readonly string[]): void {
    for (const id of new Set(sourceEpisodeIds)) this.requireSourceEpisode(id)
  }

  private requireSourceEpisode(id: string): SourceEpisode {
    const episode = this.getSourceEpisode(id)
    if (episode === undefined) throw new Error(`unknown source episode ${id}`)
    return episode
  }

  private requireEntity(id: string): Entity {
    const entity = this.getEntity(id)
    if (entity === undefined) throw new Error(`unknown entity ${id}`)
    return entity
  }

  private requireAlias(id: string): EntityAlias {
    const row = this.db.prepare('SELECT * FROM entity_alias WHERE id = ?').get(id) as Row | undefined
    if (row === undefined) throw new Error(`unknown entity alias ${id}`)
    return this.aliasFromRow(row)
  }

  private requireClaim(id: string): MemoryClaim {
    const claim = this.getClaim(id)
    if (claim === undefined) throw new Error(`unknown claim ${id}`)
    return claim
  }

  private requireActionReceipt(id: string): ActionReceipt {
    const row = this.db.prepare('SELECT * FROM action_receipt WHERE id = ?').get(id) as Row | undefined
    if (row === undefined) throw new Error(`unknown action receipt ${id}`)
    return this.actionReceiptFromRow(row)
  }

  private requireOutbox(id: string): OutboxJob {
    const row = this.db.prepare('SELECT * FROM continuity_outbox WHERE id = ?').get(id) as Row | undefined
    if (row === undefined) throw new Error(`unknown outbox job ${id}`)
    return this.outboxFromRow(row)
  }

  private sourceEpisodeFromRow(row: Row): SourceEpisode {
    return {
      id: asString(row.id, 'id'),
      sourceKind: asString(row.source_kind, 'source_kind'),
      runtimeId: asOptionalString(row.runtime_id),
      sourceInstanceId: asString(row.source_instance_id, 'source_instance_id'),
      sessionId: asOptionalString(row.session_id),
      seqStart: row.seq_start === null ? undefined : asNumber(row.seq_start, 'seq_start'),
      seqEnd: row.seq_end === null ? undefined : asNumber(row.seq_end, 'seq_end'),
      observedAt: asString(row.observed_at, 'observed_at'),
      recordedAt: asString(row.recorded_at, 'recorded_at'),
      content: asOptionalString(row.content),
      contentHash: asString(row.content_hash, 'content_hash'),
      sensitivity: asString(row.sensitivity, 'sensitivity') as Sensitivity,
      deletionState: asString(row.deletion_state, 'deletion_state') as SourceEpisode['deletionState'],
    }
  }

  private entityFromRow(row: Row): Entity {
    return {
      id: asString(row.id, 'id'),
      kind: asString(row.kind, 'kind') as Entity['kind'],
      canonicalName: asString(row.canonical_name, 'canonical_name'),
      scope: scopeFromRow(row),
      status: asString(row.status, 'status') as Entity['status'],
      createdAt: asString(row.created_at, 'created_at'),
      updatedAt: asString(row.updated_at, 'updated_at'),
      revision: asNumber(row.revision, 'revision'),
    }
  }

  private aliasFromRow(row: Row): EntityAlias {
    return {
      id: asString(row.id, 'id'),
      entityId: asString(row.entity_id, 'entity_id'),
      alias: asString(row.alias, 'alias'),
      normalizedAlias: asString(row.normalized_alias, 'normalized_alias'),
      scope: scopeFromRow(row),
      sourceEpisodeId: asOptionalString(row.source_episode_id),
      createdAt: asString(row.created_at, 'created_at'),
    }
  }

  private eventFromRow(row: Row): EntityEvent {
    return {
      id: asString(row.id, 'id'),
      eventType: asString(row.event_type, 'event_type') as EntityEventType,
      aggregateId: asString(row.aggregate_id, 'aggregate_id'),
      payload: parseJson<Record<string, unknown>>(row.payload_json, 'payload_json'),
      scope: scopeFromRow(row),
      sourceEpisodeIds: parseJson<string[]>(row.source_episode_ids_json, 'source_episode_ids_json'),
      actor: asString(row.actor, 'actor') as ActorKind,
      occurredAt: asString(row.occurred_at, 'occurred_at'),
      recordedAt: asString(row.recorded_at, 'recorded_at'),
      idempotencyKey: asString(row.idempotency_key, 'idempotency_key'),
    }
  }

  private claimFromRow(row: Row): MemoryClaim {
    const id = asString(row.id, 'id')
    const sources = this.db.prepare('SELECT source_episode_id FROM claim_source WHERE claim_id = ? ORDER BY source_episode_id').all(id) as Row[]
    return {
      id,
      kind: asString(row.kind, 'kind') as ClaimKind,
      statement: asString(row.statement, 'statement'),
      predicate: asString(row.predicate, 'predicate'),
      subjectEntityId: asString(row.subject_entity_id, 'subject_entity_id'),
      objectEntityId: asOptionalString(row.object_entity_id),
      objectValue: asOptionalString(row.object_value),
      status: asString(row.status, 'status') as ClaimStatus,
      confidence: asNumber(row.confidence, 'confidence'),
      importance: asNumber(row.importance, 'importance'),
      sensitivity: asString(row.sensitivity, 'sensitivity') as Sensitivity,
      scope: scopeFromRow(row),
      validFrom: asOptionalString(row.valid_from),
      validTo: asOptionalString(row.valid_to),
      observedAt: asString(row.observed_at, 'observed_at'),
      recordedAt: asString(row.recorded_at, 'recorded_at'),
      supersedesClaimId: asOptionalString(row.supersedes_claim_id),
      supersededByClaimId: asOptionalString(row.superseded_by_claim_id),
      sourceEpisodeIds: sources.map(source => asString(source.source_episode_id, 'source_episode_id')),
      contentHash: asString(row.content_hash, 'content_hash'),
      revision: asNumber(row.revision, 'revision'),
    }
  }

  private materializationFromRow(row: Row): RecallMaterialization {
    return {
      id: asString(row.id, 'id'),
      recallId: asString(row.recall_id, 'recall_id'),
      claimId: asString(row.claim_id, 'claim_id'),
      runtimeId: asString(row.runtime_id, 'runtime_id'),
      sessionId: asString(row.session_id, 'session_id'),
      seqStart: asNumber(row.seq_start, 'seq_start'),
      seqEnd: asNumber(row.seq_end, 'seq_end'),
      renderedContentHash: asString(row.rendered_content_hash, 'rendered_content_hash'),
      createdAt: asString(row.created_at, 'created_at'),
    }
  }

  private actionReceiptFromRow(row: Row): ActionReceipt {
    return {
      id: asString(row.id, 'id'),
      action: asString(row.action, 'action'),
      authorization: asString(row.authorization, 'authorization') as ActionReceipt['authorization'],
      runtimeId: asString(row.runtime_id, 'runtime_id'),
      provider: asOptionalString(row.provider),
      result: asString(row.result, 'result') as ActionReceipt['result'],
      scope: scopeFromRow(row),
      sourceEpisodeIds: parseJson<string[]>(row.source_episode_ids_json, 'source_episode_ids_json'),
      affectedEntityIds: parseJson<string[]>(row.affected_entity_ids_json, 'affected_entity_ids_json'),
      occurredAt: asString(row.occurred_at, 'occurred_at'),
      recordedAt: asString(row.recorded_at, 'recorded_at'),
      idempotencyKey: asString(row.idempotency_key, 'idempotency_key'),
    }
  }

  private outboxFromRow(row: Row): OutboxJob {
    return {
      id: asString(row.id, 'id'),
      jobType: asString(row.job_type, 'job_type'),
      payload: parseJson<Record<string, unknown>>(row.payload_json, 'payload_json'),
      status: asString(row.status, 'status') as OutboxJob['status'],
      attempts: asNumber(row.attempts, 'attempts'),
      availableAt: asString(row.available_at, 'available_at'),
      leaseUntil: asOptionalString(row.lease_until),
      lastError: asOptionalString(row.last_error),
      idempotencyKey: asString(row.idempotency_key, 'idempotency_key'),
      createdAt: asString(row.created_at, 'created_at'),
      updatedAt: asString(row.updated_at, 'updated_at'),
    }
  }

  private transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const value = work()
      this.db.exec('COMMIT')
      return value
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  private newId(prefix: string): string {
    return assertNonEmpty(this.idFactory(prefix), 'generated id')
  }

  private isoNow(): string {
    return this.now().toISOString()
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('personal continuity store is closed')
  }
}
