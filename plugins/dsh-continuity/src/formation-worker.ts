import type { OutboxJob } from '@telos/personal-core'
import type { ContinuityGateway } from './gateway.js'
import { extractCandidateEnvelope } from './formation.js'

export interface InferenceWorkerResult {
  claimed: number
  completed: number
  failed: number
  candidatesCreated: number
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypeError(`${field} must be a non-empty string`)
  return value.trim()
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined
  return requiredString(value, field)
}

function processJob(gateway: ContinuityGateway, job: OutboxJob): number {
  const sourceEpisodeId = requiredString(job.payload.sourceEpisodeId, 'sourceEpisodeId')
  const sessionId = requiredString(job.payload.sessionId, 'sessionId')
  const workspaceId = optionalString(job.payload.workspaceId, 'workspaceId')
  const source = gateway.store.getSourceEpisode(sourceEpisodeId)
  if (source === undefined) throw new Error(`unknown source episode ${sourceEpisodeId}`)
  const envelope = extractCandidateEnvelope({
    sourceEpisodeId,
    evidence: source.content ?? '',
    scope: workspaceId === undefined
      ? { type: 'session', id: sessionId }
      : { type: 'workspace', id: workspaceId },
  })
  const reconciliation = gateway.store.applyExtractionBatch(envelope, {
    subjectEntityId: gateway.ownerEntity.id,
    actor: 'agent',
    idempotencyKey: job.idempotencyKey,
  })
  return reconciliation.outcomes.filter(outcome => outcome.decision === 'created-candidate').length
}

/** Processes a bounded outbox lease. Failures are retried and never escape into the DSH turn. */
export function processInferenceJobs(
  gateway: ContinuityGateway,
  options: { limit?: number; onFailure?: (error: unknown, job: OutboxJob) => void } = {},
): InferenceWorkerResult {
  const jobs = gateway.store.claimOutbox(options.limit ?? 4, 60_000, 'infer-turn-candidates')
  let completed = 0
  let failed = 0
  let candidatesCreated = 0
  for (const job of jobs) {
    try {
      candidatesCreated += processJob(gateway, job)
      gateway.store.completeOutbox(job.id)
      completed += 1
    } catch (error) {
      try {
        gateway.store.failOutbox(job.id, error, { maxAttempts: 5, retryDelayMs: 1_000 })
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
