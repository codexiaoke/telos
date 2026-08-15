import { describe, expect, it, vi } from 'vitest'
import { defaultMultimodalSettings } from '../src/store.js'
import { MultimodalClientController } from '../src/client/controller.js'

const view = {
  settings: defaultMultimodalSettings(), catalog: [], mainModelStatus: { state: 'automatic', message: 'follow' },
  routeStatuses: {}, runtimePhase: 'configuration-only',
}

describe('MultimodalClientController', () => {
  it('loads, saves, and exposes transport failures', async () => {
    const call = vi.fn().mockResolvedValue({ ok: true, value: view })
    const controller = new MultimodalClientController({ call })
    await controller.refresh()
    expect(call).toHaveBeenCalledWith('/telos-multimodal', 'get', {})
    expect(controller.getSnapshot().view).toBe(view)
    await controller.save(view.settings)
    expect(controller.getSnapshot().notice).toBe('多模态模型配置已保存')

    call.mockResolvedValueOnce({ ok: false, error: { code: 'internal', message: 'offline' } })
    await controller.refresh()
    expect(controller.getSnapshot().error).toContain('offline')
    expect(controller.getSnapshot().loading).toBe(false)
  })
})
