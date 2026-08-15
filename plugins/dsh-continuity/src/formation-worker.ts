import type { OutboxJob } from '@telos/personal-core'
import type { ContinuityGateway } from './gateway.js'
import type {
  FormedMemoryProposal,
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

function messages(value: unknown): MemoryFormationMessage[] {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError('messages must be a non-empty array')
  return value.map((entry, index) => {
    const message = record(entry, `messages[${String(index)}]`)
    return {
      seq: safeInteger(message.seq, `messages[${String(index)}].seq`),
      text: requiredString(message.text, `messages[${String(index)}].text`),
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

function withoutEvidence(proposal: FormedMemoryProposal): Omit<FormedMemoryProposal, 'evidence'> {
  const { evidence: _evidence, ...claim } = proposal
  return claim
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
  const formationRoute = route(job.payload.route)
  const contentHash = requiredString(job.payload.contentHash, 'contentHash')
  const observedAt = requiredString(job.payload.observedAt, 'observedAt')
  const scope = workspaceId === undefined
    ? { type: 'session' as const, id: sessionId }
    : { type: 'workspace' as const, id: workspaceId }
  const result = await form({
    sessionId,
    messages: directMessages,
    scope,
    route: formationRoute,
    policy: policy(job.payload.policy),
  })

  let sourceEpisodeIds: string[] = []
  let candidatesCreated = 0
  if (result.proposals.length > 0) {
    const retainedEvidence = [...new Set(result.proposals.map(proposal => proposal.evidence))]
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
    const reconciliation = gateway.store.applyExtractionBatch({
      schemaVersion: 1,
      sourceEpisodeId: source.id,
      proposals: result.proposals.map(withoutEvidence),
    }, {
      subjectEntityId: gateway.ownerEntity.id,
      actor: 'agent',
      idempotencyKey: job.idempotencyKey,
    })
    candidatesCreated = reconciliation.outcomes
      .filter(outcome => outcome.decision === 'created-candidate').length
  }

  gateway.store.recordActionReceipt({
    action: 'memory.formation',
    authorization: 'not-required',
    runtimeId: 'dsh',
    provider: `${result.route.provider}/${result.route.model}${result.route.reasoningEffort === undefined
      ? ''
      : `#${result.route.reasoningEffort}`}`,
    result: 'succeeded',
    scope,
    sourceEpisodeIds,
    affectedEntityIds: result.proposals.length === 0 ? [] : [gateway.ownerEntity.id],
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
