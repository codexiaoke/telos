import { describe, expect, it } from 'vitest'
import type { DeliveryDraft } from '../src/store.js'
import { compileSentMessage, SentMailSynchronizer } from '../src/sent-sync.js'

function draft(): DeliveryDraft {
  return {
    version: 1,
    id: 'delivery-20260815',
    createdAt: '2026-08-15T12:00:00.000Z',
    hash: 'a'.repeat(64),
    status: 'sent',
    immutable: {
      report: {
        id: 'daily:2026-08-15:2026-08-15', type: 'daily',
        periodStart: '2026-08-15', periodEnd: '2026-08-15',
        title: '工作日报', updatedAt: '2026-08-15T11:00:00.000Z', size: 42,
      },
      recipients: [
        { id: 'manager', name: '主管', email: 'manager@example.com' },
        { id: 'reviewer', name: '评审人', email: 'reviewer@example.com' },
      ],
      recipientGroups: ['报告组'],
      subject: '8 月 15 日工作日报',
      html: '<h1>工作日报</h1><ul><li>完成 <strong>Sent 同步</strong></li></ul>',
      text: '工作日报\n\n• 完成 Sent 同步\n',
      mail: {
        host: 'smtp.example.com', port: 465, secure: true,
        username: 'sender@example.com', fromName: '小可', fromAddress: 'sender@example.com',
      },
    },
    sentEmails: ['manager@example.com', 'reviewer@example.com'],
    attempts: [],
    sentAt: '2026-08-15T12:00:02.000Z',
    sentFolderSync: { status: 'pending', attemptedAt: '2026-08-15T12:00:03.000Z' },
  }
}

describe('SentMailSynchronizer', () => {
  it('compiles one RFC822 copy with HTML and plain text instead of Markdown source', async () => {
    const message = (await compileSentMessage(draft())).toString('utf8')

    expect(message).toContain('manager@example.com')
    expect(message).toContain('reviewer@example.com')
    expect(message).toContain('Content-Type: multipart/alternative')
    expect(message).toContain('Content-Type: text/plain')
    expect(message).toContain('Content-Type: text/html')
    expect(message).not.toContain('**Sent')
    expect(message).not.toContain('# 工作日报')
  })

  it('auto-detects the Sent mailbox and appends exactly one seen message', async () => {
    let appendCount = 0
    let logoutCount = 0
    const synchronizer = new SentMailSynchronizer({
      compileMessage: async () => Buffer.from('rendered RFC822'),
      createClient: options => ({
        async connect() { expect(options.auth).toEqual({ user: 'sender@example.com', pass: 'secret' }) },
        async list() { return [{ path: 'Archive' }, { path: 'Sent Items', specialUse: '\\Sent' }] as never },
        async append(path, content, flags) {
          appendCount += 1
          expect(path).toBe('Sent Items')
          expect(content).toEqual(Buffer.from('rendered RFC822'))
          expect(flags).toEqual(['\\Seen'])
          return { destination: path, uid: 123 }
        },
        async logout() { logoutCount += 1 },
        close() {},
      }),
    })

    await expect(synchronizer.sync(draft(), {
      enabled: true, host: 'imap.example.com', port: 993, secure: true,
      username: 'sender@example.com', passwordMode: 'imap',
    }, 'secret', new AbortController().signal)).resolves.toMatchObject({
      status: 'synced', mailbox: 'Sent Items', uid: 123,
    })
    expect(appendCount).toBe(1)
    expect(logoutCount).toBe(1)
  })

  it('rejects an unknown configured mailbox without creating or appending to it', async () => {
    let appendCount = 0
    const synchronizer = new SentMailSynchronizer({
      compileMessage: async () => Buffer.from('rendered RFC822'),
      createClient: () => ({
        async connect() {},
        async list() { return [{ path: 'Sent', specialUse: '\\Sent' }] as never },
        async append() { appendCount += 1; return false },
        async logout() {},
        close() {},
      }),
    })

    await expect(synchronizer.sync(draft(), {
      enabled: true, host: 'imap.example.com', port: 993, secure: true,
      username: 'sender@example.com', passwordMode: 'smtp', mailbox: 'Wrong Sent',
    }, 'secret', new AbortController().signal)).rejects.toThrow(/does not exist/)
    expect(appendCount).toBe(0)
  })
})
