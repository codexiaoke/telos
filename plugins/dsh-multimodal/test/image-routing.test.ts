import { describe, expect, it, vi } from 'vitest'
import { installImageRouting } from '../src/client/image-routing.js'

function fixture(resolveImageRoute: ReturnType<typeof vi.fn>) {
  const notices: Array<{ level: string; text: string }> = []
  const sendSession = vi.fn().mockResolvedValue(undefined)
  const select = vi.fn().mockResolvedValue(undefined)
  const conversation = {
    sendSession,
    input: { for: () => ({ notify: (level: string, text: string) => notices.push({ level, text }) }) },
  }
  const directory = {
    load: vi.fn().mockResolvedValue({ current: { provider: 'deepseek', model: 'reasoner', reasoningEffort: 'high' } }),
    select,
  }
  const services = new Map<string, unknown>([
    ['conversation', conversation],
    ['modelDirectories', { directoryFor: () => directory }],
    ['sessions', { scope: () => ({}) }],
  ])
  const ctx = { get: (name: string) => services.get(name) }
  const dispose = installImageRouting(ctx as never, { resolveImageRoute } as never)
  return { conversation, directory, dispose, notices, select, sendSession }
}

describe('client image routing', () => {
  it('selects the logical bridge before sending and reports the effective route', async () => {
    const resolveImageRoute = vi.fn().mockResolvedValue({
      kind: 'bridge',
      route: { provider: 'telos-multimodal', model: 'encoded', reasoningEffort: 'high' },
      routeName: 'DeepSeek Reasoner',
      perceptionRoute: { provider: 'vision', model: 'eyes' },
      perceptionName: 'Qwen Vision',
    })
    const state = fixture(resolveImageRoute)
    const session = { sessionId: 'session-1' }
    await state.conversation.sendSession(session, '看图', ['image-1'], 'queue')
    expect(state.select).toHaveBeenCalledWith({ provider: 'telos-multimodal', model: 'encoded', reasoningEffort: 'high' })
    expect(state.select.mock.invocationCallOrder[0]).toBeLessThan(state.sendSession.mock.invocationCallOrder[0] as number)
    expect(state.notices).toContainEqual({ level: 'info', text: '已使用 Qwen Vision 理解图片，仍由 DeepSeek Reasoner 回答。' })
    state.dispose()
  })

  it('preserves the upstream send method for text and surfaces pre-admission routing errors', async () => {
    const resolveImageRoute = vi.fn().mockRejectedValue(new Error('请先配置默认多模态模型'))
    const state = fixture(resolveImageRoute)
    const session = { sessionId: 'session-1' }
    await state.conversation.sendSession(session, '纯文本', [], 'queue')
    expect(resolveImageRoute).not.toHaveBeenCalled()
    await expect(state.conversation.sendSession(session, '看图', ['image-1'], 'queue')).rejects.toThrow(/请先配置/u)
    expect(state.sendSession).toHaveBeenCalledTimes(1)
    expect(state.notices).toContainEqual({ level: 'error', text: '请先配置默认多模态模型' })
    state.dispose()
  })
})
