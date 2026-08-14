import { describe, expect, it } from 'vitest'
import type { RuntimeEvent } from '@telos/runtime-contracts'
import { DshEventTranslator } from '../src/translator.js'

describe('DshEventTranslator', () => {
  it('normalizes status, phases, deltas and committed output without exposing reasoning text', () => {
    const events: RuntimeEvent[] = []
    const translator = new DshEventTranslator('run-1', 'session-1', (event) => events.push(event), () => 100)

    translator.runStarted({ provider: 'deepseek-official', model: 'deepseek-v4-pro' })
    translator.accept({ method: 'session.status', params: { sessionId: 'session-1', status: 'running' } })
    translator.accept({
      method: 'session.event',
      params: {
        sessionId: 'session-1',
        event: {
          type: 'assistant/chunk',
          seq: 8,
          time: 90,
          data: { chunk: { type: 'block-start', blockType: 'reasoning', index: 0 } },
        },
      },
    })
    translator.accept({
      method: 'session.event',
      params: {
        sessionId: 'session-1',
        event: {
          type: 'assistant/chunk',
          seq: 9,
          time: 91,
          data: { chunk: { type: 'reasoning-delta', text: 'private reasoning', index: 0 } },
        },
      },
    })
    translator.accept({
      method: 'session.event',
      params: {
        sessionId: 'session-1',
        event: {
          type: 'assistant/chunk',
          seq: 10,
          time: 92,
          data: { chunk: { type: 'text-delta', text: '你好', index: 1 } },
        },
      },
    })
    translator.accept({
      method: 'session.event',
      params: {
        sessionId: 'session-1',
        event: {
          type: 'assistant/message',
          seq: 11,
          time: 93,
          data: { message: { content: [{ type: 'text', text: '你好，世界。' }] } },
        },
      },
    })

    expect(events.map((event) => event.type)).toEqual([
      'run.started',
      'session.status',
      'output.phase',
      'output.delta',
      'output.committed',
    ])
    expect(events.map((event) => JSON.stringify(event)).join('\n')).not.toContain('private reasoning')
    expect(events.at(-1)).toMatchObject({
      type: 'output.committed',
      data: { text: '你好，世界。' },
      source: { runtime: 'dsh', eventType: 'assistant/message', sequence: 11 },
    })
  })

  it('normalizes tool lifecycle without forwarding arguments or tool output', () => {
    const events: RuntimeEvent[] = []
    const translator = new DshEventTranslator('run-2', 'session-2', (event) => events.push(event))

    translator.accept({
      method: 'session.event',
      params: {
        event: {
          type: 'tool/call',
          seq: 4,
          data: { callId: 'call-1', name: 'read', arguments: '{"path":"secret"}' },
        },
      },
    })
    translator.accept({
      method: 'session.event',
      params: {
        event: {
          type: 'tool/result',
          seq: 5,
          data: {
            message: {
              source: { kind: 'tool', callId: 'call-1' },
              content: [{ type: 'tool-result', isError: true, content: [{ type: 'text', text: 'secret' }] }],
            },
          },
        },
      },
    })

    expect(events).toMatchObject([
      { type: 'tool.started', data: { callId: 'call-1', toolName: 'read' } },
      { type: 'tool.finished', data: { callId: 'call-1', isError: true } },
    ])
    expect(JSON.stringify(events)).not.toContain('secret')
  })
})
