import type { CompanionConversation } from '../../shared/companion.js'

interface ConversationState {
  sessionId: string
  title?: string
  cwd?: string
  message?: string
  streamText: string
  running: boolean
  updatedAt: number
}

interface Frame {
  type: string
  [key: string]: unknown
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function oneLine(value: string, maxLength = 180): string {
  const text = value.replace(/\s+/g, ' ').trim()
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`
}

function basename(path: string | undefined): string | undefined {
  const normalized = path?.replace(/[\\/]+$/, '')
  const value = normalized?.split(/[\\/]/).at(-1)
  return value === undefined || value.length === 0 ? undefined : value
}

function messageText(value: unknown): string | undefined {
  const record = asRecord(value)
  const content = record?.content
  if (!Array.isArray(content)) return undefined
  const text = content
    .map((block) => {
      const item = asRecord(block)
      return item?.type === 'text' && typeof item.text === 'string' ? item.text : ''
    })
    .filter(Boolean)
    .join(' ')
  const normalized = oneLine(text)
  return normalized.length > 0 ? normalized : undefined
}

/** Read-only, bounded projection of DSH host and mux frames for the pet bubble. */
export class CompanionConversationTracker {
  private readonly sessions = new Map<string, ConversationState>()
  private revision = 0

  ingestHost(frame: Frame): boolean {
    const sessionId = typeof frame.sessionId === 'string' ? frame.sessionId : undefined
    switch (frame.type) {
      case 'host/session-added': {
        if (sessionId === undefined) return false
        const state = this.session(sessionId)
        state.cwd = typeof frame.cwd === 'string' ? frame.cwd : state.cwd
        this.touch(state)
        return true
      }
      case 'host/session-removed':
        return sessionId === undefined ? false : this.sessions.delete(sessionId)
      case 'host/session-status': {
        if (sessionId === undefined) return false
        const state = this.session(sessionId)
        state.running = frame.running === true
        if (state.running && state.message === undefined) state.message = '正在处理会话…'
        this.touch(state)
        return true
      }
      case 'host/agent-error': {
        if (sessionId === undefined) return false
        const state = this.session(sessionId)
        const message = typeof frame.message === 'string' ? oneLine(frame.message) : ''
        state.message = message.length > 0 ? `发生错误：${message}` : '会话运行失败'
        this.touch(state)
        return true
      }
      default:
        return false
    }
  }

  ingestMux(frame: Frame): boolean {
    const sessionId = typeof frame.sessionId === 'string' ? frame.sessionId : undefined
    if (sessionId === undefined) return false
    const state = this.session(sessionId)
    if (frame.type === 'session/subscribed') {
      this.touch(state)
      return true
    }
    if (frame.type === 'session/projection') {
      if (frame.key !== 'title' || typeof frame.value !== 'string') return false
      state.title = oneLine(frame.value, 80)
      this.touch(state)
      return true
    }
    if (frame.type !== 'session/event') return false
    const event = asRecord(frame.event)
    const data = asRecord(event?.data)
    if (event === undefined || data === undefined || typeof event.type !== 'string') return false

    switch (event.type) {
      case 'session/title': {
        if (typeof data.title !== 'string') return false
        state.title = oneLine(data.title, 80)
        break
      }
      case 'turn/start':
        state.streamText = ''
        state.message = '正在思考…'
        break
      case 'user/message': {
        const source = asRecord(data.source)
        if (source?.kind !== 'user') return false
        const text = messageText(data)
        if (text === undefined) return false
        state.message = `正在处理：${text}`
        break
      }
      case 'assistant/chunk': {
        const chunk = asRecord(data.chunk)
        if (
          (chunk?.type !== 'text-delta' && chunk?.type !== 'reasoning-delta')
          || typeof chunk.text !== 'string'
        ) return false
        state.streamText = oneLine(`${state.streamText}${chunk.text}`)
        if (state.streamText.length === 0) return false
        state.message = state.streamText
        break
      }
      case 'assistant/message': {
        const text = messageText(data.message)
        if (text === undefined) return false
        state.streamText = ''
        state.message = text
        break
      }
      case 'tool/call': {
        if (typeof data.name !== 'string' || data.name.length === 0) return false
        state.streamText = ''
        state.message = `正在执行 ${oneLine(data.name, 60)}…`
        break
      }
      default:
        return false
    }
    this.touch(state)
    return true
  }

  snapshot(fallbackMessage?: string): CompanionConversation | undefined {
    const states = [...this.sessions.values()]
    const selected = states
      .filter(state => state.running)
      .sort((left, right) => right.updatedAt - left.updatedAt)[0]
      ?? states.sort((left, right) => right.updatedAt - left.updatedAt)[0]
    if (selected === undefined) return undefined
    const activeCount = Math.max(1, states.filter(state => state.running).length)
    return {
      sessionId: selected.sessionId,
      title: selected.title ?? basename(selected.cwd) ?? `会话 ${selected.sessionId.slice(0, 8)}`,
      message: selected.message ?? fallbackMessage ?? (selected.running ? '正在处理会话…' : '会话已就绪'),
      activeCount,
    }
  }

  clear(): void {
    this.sessions.clear()
  }

  private session(sessionId: string): ConversationState {
    const existing = this.sessions.get(sessionId)
    if (existing !== undefined) return existing
    const created: ConversationState = {
      sessionId,
      streamText: '',
      running: false,
      updatedAt: ++this.revision,
    }
    this.sessions.set(sessionId, created)
    return created
  }

  private touch(state: ConversationState): void {
    state.updatedAt = ++this.revision
  }
}
