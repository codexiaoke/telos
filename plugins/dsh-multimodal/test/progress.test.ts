import { describe, expect, it } from 'vitest'
import { MediaProgressRegistry } from '../src/progress.js'

describe('MediaProgressRegistry', () => {
  it('tracks queued, running, completed, token, and cache facts without media payloads', () => {
    let now = 1_000
    const registry = new MediaProgressRegistry(() => now, () => 'op-1')
    const queued = registry.enqueue({
      sessionId: 'session-1', kind: 'image', count: 1,
      perceptionRoute: { provider: 'vision', model: 'eyes' }, perceptionName: 'Eyes',
    })
    expect(queued).toMatchObject({ operationId: 'op-1', state: 'queued', elapsedMs: 0 })
    now = 1_120
    expect(registry.startNext('session-1', 2)).toBe('op-1')
    now = 1_800
    expect(registry.get('op-1')).toMatchObject({ state: 'running', count: 1, processedCount: 2, elapsedMs: 680 })
    registry.complete('op-1', { usage: { inputTokens: 30, outputTokens: 12 }, cacheHits: 1 })
    expect(registry.get('op-1')).toMatchObject({
      state: 'completed', count: 1, processedCount: 2, elapsedMs: 680, cacheHits: 1,
      usage: { inputTokens: 30, outputTokens: 12 },
    })
    expect(JSON.stringify(registry.get('op-1'))).not.toMatch(/api.?key|base64|bytes/u)
  })

  it('keeps stable failure code and message', () => {
    const registry = new MediaProgressRegistry(() => 1_000, () => 'op-2')
    registry.enqueue({
      sessionId: 'session-1', kind: 'image', count: 1,
      perceptionRoute: { provider: 'vision', model: 'eyes' }, perceptionName: 'Eyes',
    })
    registry.fail('op-2', { code: 'QUOTA', message: '余额不足' })
    expect(registry.get('op-2')).toMatchObject({ state: 'failed', failure: { code: 'QUOTA', message: '余额不足' } })
  })

  it('claims queued operations in session order and skips a cancelled send', () => {
    let id = 0
    const registry = new MediaProgressRegistry(() => 1_000, () => `op-${++id}`)
    const first = registry.enqueue({
      sessionId: 'session-1', kind: 'image', count: 1,
      perceptionRoute: { provider: 'vision', model: 'eyes' }, perceptionName: 'Eyes',
    })
    const second = registry.enqueue({
      sessionId: 'session-1', kind: 'image', count: 1,
      perceptionRoute: { provider: 'vision', model: 'eyes' }, perceptionName: 'Eyes',
    })
    registry.cancel(first.operationId)
    expect(registry.startNext('session-1', 3)).toBe(second.operationId)
    expect(registry.get(second.operationId)).toMatchObject({ state: 'running', processedCount: 3 })
  })
})
