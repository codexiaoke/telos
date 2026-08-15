import {
  MULTIMODAL_RPC_CHANNEL,
  type ImageRouteResolution,
  type MediaProgress,
} from '../contracts.js'
import type { ClientRpc } from './contracts.js'

const POLL_INTERVAL_MS = 400

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Client-side external store for transient perception state, keyed by DSH session. */
export class MediaProgressController {
  private readonly sessions = new Map<string, MediaProgress>()
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly listeners = new Set<() => void>()

  constructor(private readonly rpc: ClientRpc) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  snapshot(sessionId: string): MediaProgress | undefined {
    return this.sessions.get(sessionId)
  }

  track(sessionId: string, route: Extract<ImageRouteResolution, { kind: 'bridge' }>, count: number): void {
    const previous = this.sessions.get(sessionId)
    if (previous !== undefined) this.stop(previous.operationId)
    const createdAt = Date.now()
    this.sessions.set(sessionId, {
      operationId: route.operationId,
      sessionId,
      kind: 'image',
      count,
      state: 'queued',
      perceptionRoute: route.perceptionRoute,
      perceptionName: route.perceptionName,
      createdAt,
      elapsedMs: 0,
      cacheHits: 0,
    })
    this.emit()
    void this.poll(sessionId, route.operationId)
  }

  clearTerminal(sessionId: string): void {
    const current = this.sessions.get(sessionId)
    if (current === undefined || current.state === 'queued' || current.state === 'running') return
    this.sessions.delete(sessionId)
    this.emit()
  }

  async failBeforeRun(sessionId: string, operationId: string, error: unknown): Promise<void> {
    this.stop(operationId)
    const current = this.sessions.get(sessionId)
    if (current?.operationId === operationId) {
      const finishedAt = Date.now()
      this.sessions.set(sessionId, {
        ...current,
        state: 'failed',
        finishedAt,
        elapsedMs: Math.max(0, finishedAt - current.createdAt),
        failure: { code: 'SEND_REJECTED', message: message(error) },
      })
      this.emit()
    }
    await this.rpc.call(MULTIMODAL_RPC_CHANNEL, 'cancel-media-progress', { operationId }).catch(() => undefined)
  }

  dispose(): void {
    for (const timer of this.timers.values()) clearTimeout(timer)
    this.timers.clear()
    this.listeners.clear()
  }

  private async poll(sessionId: string, operationId: string): Promise<void> {
    try {
      const result = await this.rpc.call(MULTIMODAL_RPC_CHANNEL, 'media-progress', { operationId })
      if (!result.ok) throw new Error(result.error.message)
      const progress = result.value as MediaProgress | undefined
      if (progress !== undefined && this.sessions.get(sessionId)?.operationId === operationId) {
        this.sessions.set(sessionId, progress)
        this.emit()
        if (progress.state === 'completed' || progress.state === 'failed') {
          this.stop(operationId)
          return
        }
      }
    } catch {
      // Status transport is advisory. The DSH turn remains authoritative and
      // the next poll may recover without misreporting perception as failed.
    }
    if (this.sessions.get(sessionId)?.operationId !== operationId) return
    const timer = setTimeout(() => { void this.poll(sessionId, operationId) }, POLL_INTERVAL_MS)
    this.timers.set(operationId, timer)
  }

  private stop(operationId: string): void {
    const timer = this.timers.get(operationId)
    if (timer !== undefined) clearTimeout(timer)
    this.timers.delete(operationId)
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}
