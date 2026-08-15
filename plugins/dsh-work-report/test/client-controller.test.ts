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
    const delivery = {
      deliveryId: 'delivery-1',
      createdAt: '2026-08-15T12:00:00.000Z',
      report: { id: 'daily:2026-08-15:2026-08-15', type: 'daily', periodStart: '2026-08-15', periodEnd: '2026-08-15', title: '日报', updatedAt: '2026-08-15T11:00:00.000Z', size: 10 },
      subject: '8 月 15 日工作日报', recipients: [], status: 'sent', sentCount: 1, failedCount: 0,
      sentFolderSync: { status: 'synced', mailbox: 'Sent' },
    }
    const call = vi.fn(async (_channel: string, endpoint: string) => {
      if (endpoint === 'snapshot') return { ok: true as const, value: settings }
      if (endpoint === 'delivery-records') return { ok: true as const, value: [delivery] }
      return { ok: true as const, value: [{ id: 'daily:2026-08-15:2026-08-15', type: 'daily' }] }
    })
    const controller = new WorkReportClientController({ call })

    await controller.refresh()

    expect(call).toHaveBeenCalledTimes(3)
    expect(controller.getSnapshot()).toMatchObject({
      loading: false,
      settings,
      reports: [{ type: 'daily' }],
      deliveries: [{ deliveryId: 'delivery-1', sentFolderSync: { status: 'synced' } }],
    })
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

  it('sends only explicitly changed SMTP and IMAP credentials', async () => {
    const call = vi.fn(async () => ({ ok: true as const, value: settings }))
    const controller = new WorkReportClientController({ call })
    const config = {
      host: 'smtp.example.com', port: 465, secure: true, username: 'sender@example.com',
      fromName: '小可', fromAddress: 'sender@example.com',
      sentSync: {
        enabled: true as const, host: 'imap.example.com', port: 993, secure: true,
        username: 'sender@example.com', passwordMode: 'imap' as const,
      },
    }

    await controller.saveMail(config, undefined, 'new-imap-password')

    expect(call).toHaveBeenCalledWith('/telos-work-report', 'save-mail', {
      config,
      imapPassword: 'new-imap-password',
    })
  })
})
