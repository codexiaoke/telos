import { describe, expect, it, vi } from 'vitest'
import type { WorkReportSettingsView } from '../src/contracts.js'
import { WorkReportClientController } from '../src/client/controller.js'

const settings: WorkReportSettingsView = {
  rootPath: '/local/work-report',
  standards: { daily: '', weekly: '', monthly: '' },
  directory: { version: 1, contacts: [], groups: [] },
}

describe('WorkReportClientController', () => {
  it('loads settings and report summaries from the loopback RPC', async () => {
    const call = vi.fn(async (_channel: string, endpoint: string) => ({
      ok: true as const,
      value: endpoint === 'snapshot' ? settings : [{ id: 'daily:2026-08-15:2026-08-15', type: 'daily' }],
    }))
    const controller = new WorkReportClientController({ call })

    await controller.refresh()

    expect(call).toHaveBeenCalledTimes(2)
    expect(controller.getSnapshot()).toMatchObject({ loading: false, settings, reports: [{ type: 'daily' }] })
  })

  it('never adds an unchanged SMTP password to the save payload', async () => {
    const call = vi.fn(async () => ({ ok: true as const, value: settings }))
    const controller = new WorkReportClientController({ call })
    await controller.saveMail({
      host: 'smtp.example.com', port: 465, secure: true, username: 'sender@example.com',
      fromName: '小可', fromAddress: 'sender@example.com',
    })
    expect(call).toHaveBeenCalledWith('/telos-work-report', 'save-mail', {
      config: expect.any(Object),
    })
  })
})
