import { describe, expect, it, vi } from 'vitest'
import { defaultMultimodalSettings } from '../src/store.js'
import { MultimodalClientController } from '../src/client/controller.js'

const view = {
  settings: defaultMultimodalSettings(), catalog: [],
  defaultModelStatus: { state: 'unconfigured', message: 'missing' }, runtimePhase: 'image-routing',
}

describe('MultimodalClientController', () => {
  it('loads, saves, resolves image routes, and exposes transport failures', async () => {
    const call = vi.fn().mockResolvedValue({ ok: true, value: view })
    const controller = new MultimodalClientController({ call })
    await controller.refresh()
    expect(call).toHaveBeenCalledWith('/telos-multimodal', 'get', {})
    expect(controller.getSnapshot().view).toBe(view)
    await controller.save(view.settings)
    expect(controller.getSnapshot().notice).toBe('多模态模型配置已保存')

    const route = { kind: 'native' as const, route: { provider: 'vision', model: 'eyes' } }
    call.mockResolvedValueOnce({ ok: true, value: route })
    await expect(controller.resolveImageRoute({ provider: 'vision', model: 'eyes' })).resolves.toBe(route)

    call.mockResolvedValueOnce({ ok: false, error: { code: 'model-unavailable', message: 'not configured' } })
    await expect(controller.resolveImageRoute({ provider: 'deepseek', model: 'reasoner' })).rejects.toThrow('not configured')
  })
})
