import {
  PersonalContinuityStore,
  type ClaimKind,
  type ClaimStatus,
  type ContinuityScope,
  type CreateSourceEpisodeInput,
  type Entity,
  type EntityKind,
  type Sensitivity,
} from '@telos/personal-core'
import type {
  ContinuityHealth,
  ContinuityRpcResult,
  ConfirmCommand,
  CorrectCommand,
  ForgetCommand,
  ListClaimsCommand,
  RecallCommand,
  RememberCommand,
} from './contracts.js'

const OWNER_ENTITY_ID = 'telos:owner'
const CLAIM_KINDS: readonly ClaimKind[] = ['semantic', 'episodic', 'procedural', 'prospective', 'constraint']
const CLAIM_STATUSES: readonly ClaimStatus[] = ['candidate', 'confirmed', 'superseded', 'contradicted', 'revoked', 'expired']
const SENSITIVITIES: readonly Sensitivity[] = ['personal', 'sensitive', 'secret']
const ENTITY_KINDS: readonly EntityKind[] = ['person', 'workspace', 'project', 'topic', 'goal', 'commitment', 'decision', 'constraint', 'preference', 'artifact']

type RecordValue = Record<string, unknown>

function record(value: unknown, field = 'payload'): RecordValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`)
  return value as RecordValue
}

function string(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypeError(`${field} must be a non-empty string`)
  return value.trim()
}

function optionalString(value: unknown, field: string): string | undefined {
  return value === undefined ? undefined : string(value, field)
}

function boolean(value: unknown, field: string, fallback: boolean): boolean {
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') throw new TypeError(`${field} must be a boolean`)
  return value
}

function number(value: unknown, field: string, fallback?: number): number {
  if (value === undefined && fallback !== undefined) return fallback
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${field} must be a finite number`)
  return value
}

function optionalNumber(value: unknown, field: string): number | undefined {
  return value === undefined ? undefined : number(value, field)
}

function member<T extends string>(value: unknown, values: readonly T[], field: string, fallback?: T): T {
  if (value === undefined && fallback !== undefined) return fallback
  if (typeof value !== 'string' || !values.includes(value as T)) throw new TypeError(`${field} is invalid`)
  return value as T
}

function stringArray<T extends string>(value: unknown, values: readonly T[], field: string): T[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) throw new TypeError(`${field} must be an array`)
  return value.map((entry, index) => member(entry, values, `${field}[${String(index)}]`))
}

function scope(value: unknown): ContinuityScope {
  const input = record(value, 'scope')
  const type = member(input.type, ['global', 'workspace', 'session'] as const, 'scope.type')
  if (type === 'global') return { type }
  return { type, id: string(input.id, 'scope.id') }
}

function optionalScope(value: unknown): ContinuityScope | undefined {
  return value === undefined ? undefined : scope(value)
}

function source(value: unknown): CreateSourceEpisodeInput {
  const input = record(value, 'source')
  return {
    sourceKind: string(input.sourceKind, 'source.sourceKind'),
    runtimeId: optionalString(input.runtimeId, 'source.runtimeId'),
    sourceInstanceId: string(input.sourceInstanceId, 'source.sourceInstanceId'),
    sessionId: optionalString(input.sessionId, 'source.sessionId'),
    seqStart: optionalNumber(input.seqStart, 'source.seqStart'),
    seqEnd: optionalNumber(input.seqEnd, 'source.seqEnd'),
    observedAt: optionalString(input.observedAt, 'source.observedAt'),
    content: optionalString(input.content, 'source.content'),
    contentHash: optionalString(input.contentHash, 'source.contentHash'),
    sensitivity: input.sensitivity === undefined
      ? undefined
      : member(input.sensitivity, SENSITIVITIES, 'source.sensitivity'),
  }
}

function rememberCommand(value: unknown): RememberCommand {
  const input = record(value)
  return {
    statement: string(input.statement, 'statement'),
    predicate: string(input.predicate, 'predicate'),
    objectValue: string(input.objectValue, 'objectValue'),
    kind: member(input.kind, CLAIM_KINDS, 'kind', 'semantic'),
    scope: scope(input.scope),
    sensitivity: member(input.sensitivity, SENSITIVITIES, 'sensitivity', 'personal'),
    confidence: number(input.confidence, 'confidence', 1),
    importance: number(input.importance, 'importance', 0.7),
    status: member(input.status, ['candidate', 'confirmed'] as const, 'status', 'confirmed'),
    source: source(input.source),
    actor: member(input.actor, ['user', 'agent', 'runtime'] as const, 'actor', 'user'),
    idempotencyKey: string(input.idempotencyKey, 'idempotencyKey'),
    validFrom: optionalString(input.validFrom, 'validFrom'),
    validTo: optionalString(input.validTo, 'validTo'),
  }
}

function correctCommand(value: unknown): CorrectCommand {
  const input = record(value)
  return {
    ...rememberCommand(input),
    claimId: string(input.claimId, 'claimId'),
  }
}

function confirmCommand(value: unknown): ConfirmCommand {
  const input = record(value)
  return {
    claimId: string(input.claimId, 'claimId'),
    source: source(input.source),
    actor: member(input.actor, ['user'] as const, 'actor', 'user'),
    idempotencyKey: string(input.idempotencyKey, 'idempotencyKey'),
  }
}

function forgetCommand(value: unknown): ForgetCommand {
  const input = record(value)
  return {
    claimId: string(input.claimId, 'claimId'),
    physical: boolean(input.physical, 'physical', false),
    purgeSourceContent: boolean(input.purgeSourceContent, 'purgeSourceContent', false),
    idempotencyKey: string(input.idempotencyKey, 'idempotencyKey'),
    actor: member(input.actor, ['user', 'agent'] as const, 'actor', 'user'),
  }
}

function recallCommand(value: unknown): RecallCommand {
  const input = record(value)
  return {
    query: string(input.query, 'query'),
    workspaceId: optionalString(input.workspaceId, 'workspaceId'),
    sessionId: optionalString(input.sessionId, 'sessionId'),
    includeCandidates: boolean(input.includeCandidates, 'includeCandidates', false),
    allowedSensitivities: stringArray(input.allowedSensitivities, SENSITIVITIES, 'allowedSensitivities'),
    maxClaims: optionalNumber(input.maxClaims, 'maxClaims'),
    maxChars: optionalNumber(input.maxChars, 'maxChars'),
    graphDepth: optionalNumber(input.graphDepth, 'graphDepth'),
    minScore: optionalNumber(input.minScore, 'minScore'),
  }
}

function listClaimsCommand(value: unknown): ListClaimsCommand {
  const input = value === undefined ? {} : record(value)
  return {
    statuses: stringArray(input.statuses, CLAIM_STATUSES, 'statuses'),
    scope: optionalScope(input.scope),
    limit: optionalNumber(input.limit, 'limit'),
  }
}

function success<T>(value: T): ContinuityRpcResult<T> {
  return { ok: true, value }
}

function failure(error: unknown): ContinuityRpcResult<never> {
  if (error instanceof TypeError || error instanceof RangeError || (error instanceof Error && error.message.startsWith('unknown '))) {
    return { ok: false, error: { code: 'bad-request', message: error.message, details: { issues: [] } } }
  }
  return {
    ok: false,
    error: { code: 'internal', message: error instanceof Error ? error.message : String(error), details: {} },
  }
}

export interface ContinuityGatewayOptions {
  databasePath?: string
  store?: PersonalContinuityStore
  onBackgroundError?: () => string | undefined
}

/** Typed application boundary shared by DSH tools and the loopback Client RPC. */
export class ContinuityGateway {
  readonly store: PersonalContinuityStore
  readonly ownerEntity: Entity
  private readonly ownsStore: boolean
  private readonly onBackgroundError: () => string | undefined

  constructor(options: ContinuityGatewayOptions) {
    if (options.store === undefined && options.databasePath === undefined) {
      throw new TypeError('continuity gateway requires databasePath or store')
    }
    this.store = options.store ?? new PersonalContinuityStore({ databasePath: options.databasePath! })
    this.ownsStore = options.store === undefined
    this.onBackgroundError = options.onBackgroundError ?? (() => undefined)
    this.ownerEntity = this.store.createEntity({
      id: OWNER_ENTITY_ID,
      kind: 'person',
      canonicalName: 'User',
      scope: { type: 'global' },
      actor: 'system',
      idempotencyKey: 'telos:owner:v1',
    })
  }

  close(): void {
    if (this.ownsStore) this.store.close()
  }

  health(): ContinuityHealth {
    const lastBackgroundError = this.onBackgroundError()
    return {
      schemaVersion: this.store.schemaVersion(),
      integrity: this.store.integrityCheck(),
      databasePath: this.store.databasePath,
      ...(lastBackgroundError === undefined ? {} : { lastBackgroundError }),
    }
  }

  remember(command: RememberCommand) {
    const episode = this.store.createSourceEpisode(command.source)
    return this.store.remember({
      kind: command.kind,
      statement: command.statement,
      predicate: command.predicate,
      subjectEntityId: this.ownerEntity.id,
      objectValue: command.objectValue,
      status: command.status,
      confidence: command.confidence,
      importance: command.importance,
      sensitivity: command.sensitivity,
      scope: command.scope,
      validFrom: command.validFrom,
      validTo: command.validTo,
      sourceEpisodeIds: [episode.id],
      actor: command.actor,
      idempotencyKey: command.idempotencyKey,
    })
  }

  correct(command: CorrectCommand) {
    const episode = this.store.createSourceEpisode(command.source)
    return this.store.correct({
      claimId: command.claimId,
      kind: command.kind,
      statement: command.statement,
      predicate: command.predicate,
      subjectEntityId: this.ownerEntity.id,
      objectValue: command.objectValue,
      status: command.status,
      confidence: command.confidence,
      importance: command.importance,
      sensitivity: command.sensitivity,
      scope: command.scope,
      validFrom: command.validFrom,
      validTo: command.validTo,
      sourceEpisodeIds: [episode.id],
      actor: command.actor,
      idempotencyKey: command.idempotencyKey,
    })
  }

  confirm(command: ConfirmCommand) {
    const episode = this.store.createSourceEpisode(command.source)
    return this.store.confirmCandidate({
      claimId: command.claimId,
      sourceEpisodeIds: [episode.id],
      actor: command.actor,
      idempotencyKey: command.idempotencyKey,
    })
  }

  forget(command: ForgetCommand) {
    return this.store.forget(command.claimId, {
      physical: command.physical,
      purgeSourceContent: command.purgeSourceContent,
      idempotencyKey: command.idempotencyKey,
      actor: command.actor,
    })
  }

  recall(command: RecallCommand) {
    return this.store.recall(command.query, {
      workspaceId: command.workspaceId,
      sessionId: command.sessionId,
      includeCandidates: command.includeCandidates,
      allowedSensitivities: command.allowedSensitivities,
    }, {
      maxClaims: command.maxClaims,
      maxChars: command.maxChars,
      graphDepth: command.graphDepth,
      minScore: command.minScore,
    })
  }

  async handle(endpoint: string, payload: unknown): Promise<ContinuityRpcResult<unknown>> {
    try {
      switch (endpoint) {
        case 'health': return success(this.health())
        case 'memory/list': return success(this.store.listClaims(listClaimsCommand(payload)))
        case 'memory/remember': return success(this.remember(rememberCommand(payload)))
        case 'memory/confirm': return success(this.confirm(confirmCommand(payload)))
        case 'memory/correct': return success(this.correct(correctCommand(payload)))
        case 'memory/forget': return success(this.forget(forgetCommand(payload)))
        case 'memory/recall': return success(this.recall(recallCommand(payload)))
        case 'memory/explain': {
          const input = record(payload)
          return success(this.store.explainRecall(string(input.recallId, 'recallId')) ?? null)
        }
        case 'recall/list': {
          const input = payload === undefined ? {} : record(payload)
          return success(this.store.listRecallDecisions({
            sessionId: optionalString(input.sessionId, 'sessionId'),
            claimId: optionalString(input.claimId, 'claimId'),
            limit: optionalNumber(input.limit, 'limit'),
          }))
        }
        case 'materialization/list': {
          const input = payload === undefined ? {} : record(payload)
          return success(this.store.listMaterializations({
            recallId: optionalString(input.recallId, 'recallId'),
            claimId: optionalString(input.claimId, 'claimId'),
            sessionId: optionalString(input.sessionId, 'sessionId'),
            limit: optionalNumber(input.limit, 'limit'),
          }))
        }
        case 'source/get': {
          const input = record(payload)
          return success(this.store.getSourceEpisode(string(input.sourceEpisodeId, 'sourceEpisodeId')) ?? null)
        }
        case 'entity/list': {
          const input = payload === undefined ? {} : record(payload)
          return success(this.store.listEntities({
            scope: optionalScope(input.scope),
            kinds: stringArray(input.kinds, ENTITY_KINDS, 'kinds'),
            limit: optionalNumber(input.limit, 'limit'),
          }))
        }
        case 'graph/list': {
          const input = payload === undefined ? {} : record(payload)
          return success(this.store.listRelations({
            entityId: optionalString(input.entityId, 'entityId'),
            statuses: stringArray(input.statuses, CLAIM_STATUSES, 'statuses'),
            limit: optionalNumber(input.limit, 'limit'),
          }))
        }
        case 'receipt/list': {
          const input = payload === undefined ? {} : record(payload)
          return success(this.store.listActionReceipts({
            scope: optionalScope(input.scope),
            limit: optionalNumber(input.limit, 'limit'),
          }))
        }
        case 'deletion/list': {
          const input = payload === undefined ? {} : record(payload)
          return success(this.store.listForgetReports(optionalString(input.claimId, 'claimId')))
        }
        default: throw new TypeError(`unknown continuity endpoint ${endpoint}`)
      }
    } catch (error) {
      return failure(error)
    }
  }
}
