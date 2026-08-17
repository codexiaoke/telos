import { describe, expect, it, vi } from 'vitest'
import type { CompanionDesktopApi, CompanionSettingsView } from '../src/client/contracts.js'
import { CompanionClientController } from '../src/client/controller.js'

const view: CompanionSettingsView = {
  visible: false,
  connected: true,
  locked: false,
  size: 'large',
  pet: 'orb',
  pets: [{ id: 'orb', label: 'Orb', kind: 'orb', removable: false }],
}

describe('CompanionClientController', () => {
  it('reads and updates the Electron-owned companion state', async () => {
    const api: CompanionDesktopApi = {
      getSettings: vi.fn(async () => view),
      updateSettings: vi.fn(async patch => ({ ...view, ...patch })),
      importPet: vi.fn(async () => view),
      removePet: vi.fn(async () => view),
      onSettingsChanged: vi.fn(() => () => undefined),
    }
    const controller = new CompanionClientController(() => api)
    controller.start()
    await controller.refresh()
    expect(controller.getSnapshot().view).toEqual(view)
    await controller.updateSettings({ visible: true })
    expect(api.updateSettings).toHaveBeenCalledWith({ visible: true })
    expect(controller.getSnapshot().view?.visible).toBe(true)
  })

  it('reports a clear desktop-only message when the bridge is absent', async () => {
    const controller = new CompanionClientController(() => undefined)
    await controller.refresh()
    expect(controller.getSnapshot().error).toContain('仅在 Telos 桌面版中可用')
  })
})
