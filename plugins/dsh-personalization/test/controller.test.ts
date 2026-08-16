import { describe, expect, it, vi } from 'vitest'
import { PersonalizationClientController } from '../src/client/controller.js'
import { PERSONALIZATION_RPC_CHANNEL } from '../src/contracts.js'

describe('PersonalizationClientController', () => {
  it('loads and saves global instructions through the Host RPC', async () => {
    const view = { instructions: '中文回答', configured: true, byteLength: 12, maxBytes: 65_536 }
    const call = vi.fn().mockResolvedValue({ ok: true, value: view })
    const controller = new PersonalizationClientController({ call })
    const listener = vi.fn()
    controller.subscribe(listener)

    await controller.refresh()
    expect(call).toHaveBeenCalledWith(PERSONALIZATION_RPC_CHANNEL, 'get', {})
    expect(controller.getSnapshot()).toEqual({ loading: false, view, error: undefined, notice: undefined })

    await controller.save('先给结论')
    expect(call).toHaveBeenLastCalledWith(PERSONALIZATION_RPC_CHANNEL, 'save', { instructions: '先给结论' })
    expect(controller.getSnapshot().notice).toBe('个性化指令已保存')
    expect(listener).toHaveBeenCalled()
  })

  it('keeps an RPC failure visible', async () => {
    const call = vi.fn().mockResolvedValue({ ok: false, error: { code: 'bad-request', message: 'too long' } })
    const controller = new PersonalizationClientController({ call })
    await controller.save('x')
    expect(controller.getSnapshot()).toEqual(expect.objectContaining({ loading: false, error: 'bad-request: too long' }))
  })
})
