import type { OutboxJob } from '@telos/personal-core'
import type { ContinuityGateway } from './gateway.js'
import type {
  FormedMemoryEntity,
  FormedMemoryEvent,
  MemoryFormationInput,
  MemoryFormationMessage,
  MemoryFormationPolicy,
  MemoryFormationResult,
  MemoryFormationRoute,
} from './formation.js'

type UnknownRecord = Record<string, unknown>

export type MemoryFormer = (input: MemoryFormationInput) => Promise<MemoryFormationResult>

export interface InferenceWorkerResult {
  claimed: number
  completed: number
  failed: number
  candidatesCreated: number
}

function record(value: unknown, field: string): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`)
  }
  return value as UnknownRecord
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypeError(`${field} must be a non-empty string`)
  return value.trim()
}

function optionalString(value: unknown, field: string): string | undefined {
  return value === undefined ? undefined : requiredString(value, field)
}

function safeInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative safe integer`)
  }
  return value
}

function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${field} must be a positive safe integer`)
  }
  return value
}

function messages(value: unknown, field = 'messages', allowEmpty = false): MemoryFormationMessage[] {
  if (allowEmpty && value === undefined) return []
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new TypeError(`${field} must be ${allowEmpty ? 'an array' : 'a non-empty array'}`)
  }
  return value.map((entry, index) => {
    const message = record(entry, `${field}[${String(index)}]`)
    return {
      seq: safeInteger(message.seq, `${field}[${String(index)}].seq`),
      text: requiredString(message.text, `${field}[${String(index)}].text`),
    }
  })
}

function route(value: unknown): MemoryFormationRoute {
  const input = record(value, 'route')
  return {
    provider: requiredString(input.provider, 'route.provider'),
    model: requiredString(input.model, 'route.model'),
    reasoningEffort: optionalString(input.reasoningEffort, 'route.reasoningEffort'),
  }
}

function policy(value: unknown): MemoryFormationPolicy {
  const input = record(value, 'policy')
  return {
    maxInputBytes: positiveInteger(input.maxInputBytes, 'policy.maxInputBytes'),
    maxOutputTokens: positiveInteger(input.maxOutputTokens, 'policy.maxOutputTokens'),
    timeoutMs: positiveInteger(input.timeoutMs, 'policy.timeoutMs'),
  }
}

function captureIntent(value: unknown): 'automatic' | 'explicit' {
  if (value === undefined || value === 'automatic') return 'automatic'
  if (value === 'explicit') return 'explicit'
  throw new TypeError('captureIntent must be automatic or explicit')
}

function confirmationStatus(value: unknown): 'candidate' | 'confirmed' {
  if (value === undefined || value === 'candidate') return 'candidate'
  if (value === 'confirmed') return 'confirmed'
  throw new TypeError('confirmationStatus must be candidate or confirmed')
}

function entityWithoutEvidence(entity: FormedMemoryEntity): Omit<FormedMemoryEntity, 'evidence'> {
  const { evidence: _evidence, ...identity } = entity
  return identity
}

function eventWithoutEvidence(event: FormedMemoryEvent): Omit<FormedMemoryEvent, 'evidence'> {
  const { evidence: _evidence, ...memoryEvent } = event
  return memoryEvent
}

async function processJob(
  gateway: ContinuityGateway,
  job: OutboxJob,
  form: MemoryFormer,
): Promise<number> {
  const sessionId = requiredString(job.payload.sessionId, 'sessionId')
  const workspaceId = optionalString(job.payload.workspaceId, 'workspaceId')
  const turn = safeInteger(job.payload.turn, 'turn')
  const directMessages = messages(job.payload.messages)
  const assistantMessages = messages(job.payload.assistantMessages, 'assistantMessages', true)
  const formationRoute = route(job.payload.route)
  const contentHash = requiredString(job.payload.contentHash, 'contentHash')
  const observedAt = requiredString(job.payload.observedAt, 'observedAt')
  const referenceTime = optionalString(job.payload.referenceTime, 'referenceTime') ?? observedAt
  const timeZone = optionalString(job.payload.timeZone, 'timeZone') ?? 'UTC'
  const locale = optionalString(job.payload.locale, 'locale') ?? 'und'
  const intent = captureIntent(job.payload.captureIntent)
  const requestedStatus = confirmationStatus(job.payload.confirmationStatus)
  const scope = workspaceId === undefined
    ? { type: 'session' as const, id: sessionId }
    : { type: 'workspace' as const, id: workspaceId }
  const result = await form({
    sessionId,
    captureIntent: intent,
    messages: directMessages,
    assistantMessages,
    referenceTime,
    timeZone,
    locale,
    scope,
    route: formationRoute,
    policy: policy(job.payload.policy),
  })

  let sourceEpisodeIds: string[] = []
  let affectedEntityIds: string[] = []
  let candidatesCreated = 0
  if (result.events.length > 0) {
    const retainedEvidence = [...new Set([
      ...result.entities.map(entity => entity.evidence),
      ...result.events.map(event => event.evidence),
    ])]
    const source = gateway.store.createSourceEpisode({
      sourceKind: 'dsh.llm-memory-formation',
      runtimeId: 'dsh',
      sourceInstanceId: `${sessionId}:turn:${String(turn)}:llm-memory-formation`,
      sessionId,
      seqStart: directMessages[0]!.seq,
      seqEnd: directMessages.at(-1)!.seq,
      observedAt,
      content: retainedEvidence.join('\n'),
      contentHash,
      sensitivity: 'personal',
    })
    sourceEpisodeIds = [source.id]
    const reconciliation = gateway.store.applyGraphExtractionBatch({
      schemaVersion: 2,
      sourceEpisodeId: source.id,
      scope,
      entities: result.entities.map(entityWithoutEvidence),
      events: result.events.map(eventWithoutEvidence),
    }, {
      ownerEntityId: gateway.ownerEntity.id,
      actor: 'agent',
      idempotencyKey: job.idempotencyKey,
    })
    affectedEntityIds = [...new Set([
      gateway.ownerEntity.id,
      ...reconciliation.entities.map(entity => entity.entityId),
    ])]
    candidatesCreated = reconciliation.outcomes
      .filter(outcome => outcome.decision === 'created-candidate').length
    if (requestedStatus === 'confirmed') {
      for (const outcome of reconciliation.outcomes) {
        const claim = gateway.store.getClaim(outcome.claimId)
        if (claim?.status !== 'candidate') continue
        gateway.store.confirmCandidate({
          claimId: claim.id,
          sourceEpisodeIds: [source.id],
          actor: 'user',
          occurredAt: observedAt,
          idempotencyKey: `${job.idempotencyKey}:confirm:${String(outcome.eventIndex)}`,
        })
      }
    }
  }

  gateway.store.recordActionReceipt({
    action: 'memory.formation',
    authorization: requestedStatus === 'confirmed' ? 'allowed' : 'not-required',
    runtimeId: 'dsh',
    provider: `${result.route.provider}/${result.route.model}${result.route.reasoningEffort === undefined
      ? ''
      : `#${result.route.reasoningEffort}`}`,
    result: 'succeeded',
    scope,
    sourceEpisodeIds,
    affectedEntityIds,
    occurredAt: observedAt,
    idempotencyKey: `receipt:${job.idempotencyKey}`,
  })
  return candidatesCreated
}

/** Processes a bounded asynchronous outbox lease through the main-model former. */
export async function processInferenceJobs(
  gateway: ContinuityGateway,
  options: {
    form: MemoryFormer
    limit?: number
    onFailure?: (error: unknown, job: OutboxJob) => void
  },
): Promise<InferenceWorkerResult> {
  const jobs = gateway.store.claimOutbox(options.limit ?? 4, 60_000, 'infer-turn-candidates')
  let completed = 0
  let failed = 0
  let candidatesCreated = 0
  for (const job of jobs) {
    try {
      candidatesCreated += await processJob(gateway, job, options.form)
      gateway.store.completeOutbox(job.id, { scrubPayload: true })
      completed += 1
    } catch (error) {
      try {
        gateway.store.failOutbox(job.id, error, {
          maxAttempts: 5,
          retryDelayMs: 1_000,
          scrubPayloadOnDead: true,
        })
      } catch {
        // The original processing failure remains the useful diagnostic.
      }
      try {
        options.onFailure?.(error, job)
      } catch {
        // Diagnostics must never make a durable turn fail.
      }
      failed += 1
    }
  }
  return { claimed: jobs.length, completed, failed, candidatesCreated }
}
