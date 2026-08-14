import type { RuntimeEvent, RuntimeEventObserver, RuntimeRoute } from '@telos/runtime-contracts'

interface DshNotification {
  method: string
  params: Record<string, unknown>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numberField(value: unknown, field: string): number | undefined {
  if (!isRecord(value)) return undefined
  const candidate = value[field]
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : undefined
}

function stringField(value: unknown, field: string): string | undefined {
  if (!isRecord(value)) return undefined
  const candidate = value[field]
  return typeof candidate === 'string' ? candidate : undefined
}

function assistantText(event: Record<string, unknown>): string {
  const data = event.data
  const message = isRecord(data) ? data.message : undefined
  const content = isRecord(message) ? message.content : undefined
  if (!Array.isArray(content)) return ''

  return content
    .filter((block): block is Record<string, unknown> => isRecord(block) && block.type === 'text')
    .map((block) => stringField(block, 'text') ?? '')
    .join('')
}

function toolResultIsError(event: Record<string, unknown>): boolean {
  const data = event.data
  const message = isRecord(data) ? data.message : undefined
  const content = isRecord(message) ? message.content : undefined
  if (!Array.isArray(content)) return false

  return content.some((block) => isRecord(block) && block.type === 'tool-result' && block.isError === true)
}

export class DshEventTranslator {
  private sequence = 0

  constructor(
    private readonly runId: string,
    private readonly sessionId: string,
    private readonly observer: RuntimeEventObserver,
    private readonly clock: () => number = Date.now,
  ) {}

  get eventCount(): number {
    return this.sequence
  }

  runStarted(route: RuntimeRoute): void {
    this.emit('run.started', { route })
  }

  runCompleted(finalResponse: string): void {
    this.emit('run.completed', { finalResponse })
  }

  runFailed(message: string): void {
    this.emit('run.failed', { message })
  }

  accept(value: unknown): void {
    if (!isRecord(value) || typeof value.method !== 'string' || !isRecord(value.params)) return
    const notification: DshNotification = { method: value.method, params: value.params }

    if (notification.method === 'session.status') {
      const status = notification.params.status
      if (status === 'idle' || status === 'running') {
        this.emit('session.status', { status }, { eventType: notification.method })
      }
      return
    }

    if (notification.method === 'subagent.started') {
      const childSessionId = stringField(notification.params, 'childSessionId')
      if (childSessionId !== undefined) {
        this.emit('subagent.started', { childSessionId }, { eventType: notification.method })
      }
      return
    }

    if (notification.method === 'subagent.finished') {
      const childSessionId = stringField(notification.params, 'childSessionId')
      const status = notification.params.status
      if (childSessionId !== undefined && (status === 'ok' || status === 'error')) {
        this.emit('subagent.finished', { childSessionId, status }, { eventType: notification.method })
      }
      return
    }

    if (notification.method !== 'session.event' || !isRecord(notification.params.event)) return
    this.acceptSessionEvent(notification.params.event)
  }

  private acceptSessionEvent(event: Record<string, unknown>): void {
    const eventType = stringField(event, 'type')
    if (eventType === undefined) return
    const source = { eventType, sequence: numberField(event, 'seq') }
    const occurredAt = numberField(event, 'time')
    const data = isRecord(event.data) ? event.data : undefined

    switch (eventType) {
      case 'turn/start':
      case 'turn/end': {
        const turn = numberField(data, 'turn')
        if (turn !== undefined) {
          this.emit(eventType === 'turn/start' ? 'turn.started' : 'turn.finished', { turn }, source, occurredAt)
        }
        return
      }
      case 'assistant/chunk': {
        const chunk = isRecord(data?.chunk) ? data.chunk : undefined
        if (chunk?.type === 'text-delta') {
          const text = stringField(chunk, 'text')
          if (text !== undefined && text.length > 0) this.emit('output.delta', { text }, source, occurredAt)
        } else if (chunk?.type === 'block-start' && chunk.blockType === 'reasoning') {
          this.emit('output.phase', { phase: 'thinking' }, source, occurredAt)
        } else if (chunk?.type === 'block-start' && chunk.blockType === 'text') {
          this.emit('output.phase', { phase: 'answering' }, source, occurredAt)
        }
        return
      }
      case 'assistant/message': {
        const text = assistantText(event)
        if (text.length > 0) this.emit('output.committed', { text }, source, occurredAt)
        return
      }
      case 'tool/call': {
        const callId = stringField(data, 'callId')
        const toolName = stringField(data, 'name')
        if (callId !== undefined && toolName !== undefined) {
          this.emit('tool.started', { callId, toolName }, source, occurredAt)
        }
        return
      }
      case 'tool/result': {
        const message = isRecord(data?.message) ? data.message : undefined
        const messageSource = isRecord(message?.source) ? message.source : undefined
        const callId = stringField(messageSource, 'callId')
        if (callId !== undefined) {
          this.emit('tool.finished', { callId, isError: toolResultIsError(event) }, source, occurredAt)
        }
      }
    }
  }

  private emit<T extends RuntimeEvent['type']>(
    type: T,
    data: Extract<RuntimeEvent, { type: T }>['data'],
    source?: { eventType: string; sequence?: number },
    occurredAt = this.clock(),
  ): void {
    this.sequence += 1
    const event = {
      runId: this.runId,
      sessionId: this.sessionId,
      runtime: 'dsh',
      sequence: this.sequence,
      occurredAt,
      type,
      data,
      ...(source === undefined
        ? {}
        : {
            source: {
              runtime: 'dsh',
              eventType: source.eventType,
              ...(source.sequence === undefined ? {} : { sequence: source.sequence }),
            },
          }),
    } as Extract<RuntimeEvent, { type: T }>

    this.observer(event)
  }
}
