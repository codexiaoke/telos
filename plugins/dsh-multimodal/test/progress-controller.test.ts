import { describe, expect, it, vi } from 'vitest'
import { MediaProgressController } from '../src/client/progress-controller.js'

describe('MediaProgressController', () => {
  it('shows an immediate queued snapshot and adopts terminal host statistics', async () => {
    const terminal = {
      operationId: 'op-1', sessionId: 'session-1', kind: 'image' as const, count: 1,
      state: 'completed' as const,
      perceptionRoute: { provider: 'vision', model: 'eyes' }, perceptionName: 'Eyes',
      createdAt: 1, startedAt: 2, finishedAt: 12, elapsedMs: 10, cacheHits: 0,
      usage: { inputTokens: 20, outputTokens: 8 },
    }
    const call = vi.fn().mockResolvedValue({ ok: true, value: terminal })
    const controller = new MediaProgressController({ call })
    controller.track('session-1', {
      kind: 'bridge', route: { provider: 'telos-multimodal', model: 'encoded' }, routeName: 'Main',
      perceptionRoute: { provider: 'vision', model: 'eyes' }, perceptionName: 'Eyes', operationId: 'op-1',
    }, 1)
    expect(controller.snapshot('session-1')).toMatchObject({ state: 'queued', operationId: 'op-1' })
    await vi.waitFor(() => expect(controller.snapshot('session-1')).toEqual(terminal))
    expect(call).toHaveBeenCalledWith('/telos-multimodal', 'media-progress', { operationId: 'op-1' })
    controller.dispose()
  })
})
