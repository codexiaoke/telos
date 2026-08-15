import { randomUUID } from 'node:crypto'
import type {
  MediaKind,
  MediaProgress,
  MediaProgressFailure,
  MediaTokenUsage,
  ModelRoute,
} from './contracts.js'

const MAX_OPERATIONS = 200

interface QueueInput {
  sessionId: string
  kind: MediaKind
  count: number
  perceptionRoute: ModelRoute
  perceptionName: string
}

interface CompleteInput {
  usage?: MediaTokenUsage
  cacheHits: number
}

/** Process-local progress registry shared by the host RPC service and composite adapter. */
export class MediaProgressRegistry {
  private readonly operations = new Map<string, MediaProgress>()
  private readonly pendingBySession = new Map<string, string[]>()

  constructor(
    private readonly now: () => number = Date.now,
    private readonly createId: () => string = randomUUID,
  ) {}

  enqueue(input: QueueInput): MediaProgress {
    const operation: MediaProgress = {
      operationId: this.createId(),
      sessionId: input.sessionId,
      kind: input.kind,
      count: input.count,
      state: 'queued',
      perceptionRoute: input.perceptionRoute,
      perceptionName: input.perceptionName,
      createdAt: this.now(),
      elapsedMs: 0,
      cacheHits: 0,
    }
    this.operations.set(operation.operationId, operation)
    const pending = this.pendingBySession.get(operation.sessionId) ?? []
    pending.push(operation.operationId)
    this.pendingBySession.set(operation.sessionId, pending)
    this.prune()
    return operation
  }

  startNext(sessionId: string, processedCount: number): string | undefined {
    const pending = this.pendingBySession.get(sessionId)
    let operation: MediaProgress | undefined
    let operationId: string | undefined
    while (pending !== undefined && pending.length > 0 && operation === undefined) {
      operationId = pending.shift()
      const candidate = operationId === undefined ? undefined : this.operations.get(operationId)
      if (candidate?.state === 'queued') operation = candidate
    }
    if (pending?.length === 0) this.pendingBySession.delete(sessionId)
    if (operation === undefined || operationId === undefined) return undefined
    this.operations.set(operationId, {
      ...operation,
      processedCount,
      state: 'running',
      startedAt: this.now(),
    })
    return operationId
  }

  complete(operationId: string, input: CompleteInput): void {
    const operation = this.operations.get(operationId)
    if (operation === undefined || (operation.state !== 'running' && operation.state !== 'queued')) return
    const finishedAt = this.now()
    const startedAt = operation.startedAt ?? operation.createdAt
    this.operations.set(operationId, {
      ...operation,
      state: 'completed',
      startedAt,
      finishedAt,
      elapsedMs: Math.max(0, finishedAt - startedAt),
      cacheHits: input.cacheHits,
      ...(input.usage === undefined ? {} : { usage: input.usage }),
    })
  }

  fail(operationId: string, failure: MediaProgressFailure): void {
    const operation = this.operations.get(operationId)
    if (operation === undefined || operation.state === 'completed' || operation.state === 'failed') return
    const finishedAt = this.now()
    const startedAt = operation.startedAt ?? operation.createdAt
    this.operations.set(operationId, {
      ...operation,
      state: 'failed',
      startedAt,
      finishedAt,
      elapsedMs: Math.max(0, finishedAt - startedAt),
      failure,
    })
  }

  cancel(operationId: string): void {
    const operation = this.operations.get(operationId)
    if (operation?.state !== 'queued') return
    this.operations.delete(operationId)
    const pending = this.pendingBySession.get(operation.sessionId)
    if (pending === undefined) return
    const index = pending.indexOf(operationId)
    if (index >= 0) pending.splice(index, 1)
    if (pending.length === 0) this.pendingBySession.delete(operation.sessionId)
  }

  get(operationId: string): MediaProgress | undefined {
    const operation = this.operations.get(operationId)
    if (operation === undefined) return undefined
    if (operation.state !== 'queued' && operation.state !== 'running') return operation
    const startedAt = operation.startedAt ?? operation.createdAt
    return { ...operation, elapsedMs: Math.max(0, this.now() - startedAt) }
  }

  private prune(): void {
    while (this.operations.size > MAX_OPERATIONS) {
      const oldest = this.operations.keys().next().value
      if (oldest === undefined) return
      this.operations.delete(oldest)
    }
  }
}
