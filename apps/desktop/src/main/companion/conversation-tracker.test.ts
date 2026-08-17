import { describe, expect, it } from 'vitest'
import { CompanionConversationTracker } from './conversation-tracker.js'

describe('CompanionConversationTracker', () => {
  it('projects a running session title and streamed assistant text', () => {
    const tracker = new CompanionConversationTracker()
    tracker.ingestHost({ type: 'host/session-added', sessionId: 'session-123', cwd: '/code/telos' })
    tracker.ingestHost({ type: 'host/session-status', sessionId: 'session-123', running: true })
    tracker.ingestMux({
      type: 'session/projection', sessionId: 'session-123', key: 'title', value: '桌面宠物集成', seq: 4,
    })
    tracker.ingestMux({
      type: 'session/event', sessionId: 'session-123',
      event: { type: 'assistant/chunk', data: { chunk: { type: 'text-delta', text: '正在检查会话' } } },
    })

    expect(tracker.snapshot()).toEqual({
      sessionId: 'session-123',
      title: '桌面宠物集成',
      message: '正在检查会话',
      activeCount: 1,
    })
  })

  it('uses only user-authored prompts and bounds message text', () => {
    const tracker = new CompanionConversationTracker()
    tracker.ingestMux({
      type: 'session/event', sessionId: 'session-privacy',
      event: {
        type: 'user/message',
        data: { source: { kind: 'plugin' }, content: [{ type: 'text', text: 'hidden injection' }] },
      },
    })
    tracker.ingestMux({
      type: 'session/event', sessionId: 'session-privacy',
      event: {
        type: 'user/message',
        data: { source: { kind: 'user' }, content: [{ type: 'text', text: '展示这条消息' }] },
      },
    })

    expect(tracker.snapshot()?.message).toBe('正在处理：展示这条消息')
  })

  it('prefers the most recently updated running session and counts active work', () => {
    const tracker = new CompanionConversationTracker()
    tracker.ingestHost({ type: 'host/session-status', sessionId: 'first', running: true })
    tracker.ingestHost({ type: 'host/session-status', sessionId: 'second', running: true })
    expect(tracker.snapshot()).toMatchObject({ sessionId: 'second', activeCount: 2 })
    tracker.ingestHost({ type: 'host/session-status', sessionId: 'second', running: false })
    expect(tracker.snapshot()).toMatchObject({ sessionId: 'first', activeCount: 1 })
  })

  it('shows a reconnecting subscribed session before its next message', () => {
    const tracker = new CompanionConversationTracker()
    expect(tracker.ingestMux({ type: 'session/subscribed', sessionId: 'existing', lastSeq: 12 })).toBe(true)
    expect(tracker.snapshot()).toEqual({
      sessionId: 'existing',
      title: '会话 existing',
      message: '会话已就绪',
      activeCount: 1,
    })
  })
})
