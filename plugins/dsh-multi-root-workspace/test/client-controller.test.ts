import { describe, expect, it, vi } from 'vitest'
import { MULTI_ROOT_WORKSPACE_RPC_CHANNEL } from '../src/contracts.js'
import { MultiRootWorkspaceController } from '../src/client/controller.js'

describe('MultiRootWorkspaceController', () => {
  it('creates a group through the loopback workspace channel', async () => {
    const group = {
      workspaceId: 'workspace-1', title: 'product', primaryRootId: 'frontend', updatedAt: '',
      roots: [
        { id: 'frontend', label: 'frontend', path: '/product/frontend', primary: true },
        { id: 'backend', label: 'backend', path: '/product/backend', primary: false },
      ],
    }
    const call = vi.fn().mockResolvedValue({ ok: true, value: group })
    const controller = new MultiRootWorkspaceController({ call })

    await expect(controller.create({ title: 'product', paths: ['/product/frontend', '/product/backend'] }))
      .resolves.toEqual(group)
    expect(call).toHaveBeenCalledWith(MULTI_ROOT_WORKSPACE_RPC_CHANNEL, 'create', {
      title: 'product', paths: ['/product/frontend', '/product/backend'],
    })
  })

  it('preserves picker cancellation and exposes host errors', async () => {
    const call = vi.fn()
      .mockResolvedValueOnce({ ok: true, value: null })
      .mockResolvedValueOnce({ ok: false, error: { code: 'internal', message: 'picker unavailable' } })
    const controller = new MultiRootWorkspaceController({ call })
    await expect(controller.pickDirectory()).resolves.toBeNull()
    await expect(controller.pickDirectory()).rejects.toThrow('picker unavailable')
  })
})
