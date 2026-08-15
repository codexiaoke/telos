import { rmSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { CredentialProvider } from '@deepseek-ai/dsh-credentials'
import { afterEach, describe, expect, it } from 'vitest'
import { WorkReportMailer, type MailTransportFactory } from '../src/mailer.js'
import { SentMailSynchronizer } from '../src/sent-sync.js'
import { WorkReportStore } from '../src/store.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function credentials(password = 'smtp-super-secret'): CredentialProvider {
  return {
    async describe() { return { configured: true, source: 'test', writable: true } },
    async resolve(ref: string) { return { value: ref.includes('IMAP') ? 'imap-super-secret' : password, source: 'test' } },
  } as unknown as CredentialProvider
}

async function fixture(createTransport: MailTransportFactory, options: {
  sentSync?: {
    enabled: true
    host: string
    port: number
    secure: boolean
    username: string
    passwordMode: 'smtp' | 'imap'
    mailbox?: string
  }
  sentSynchronizer?: SentMailSynchronizer
} = {}) {
  const root = await mkdtemp(join(tmpdir(), 'telos-work-report-mail-'))
  roots.push(root)
  const store = new WorkReportStore(root)
  await store.saveReport({
    type: 'daily', periodStart: '2026-08-15', periodEnd: '2026-08-15',
    markdown: '# 工作日报\n\n- 完成 **本地报告插件**\n',
  })
  await store.saveDirectory({
    version: 1,
    contacts: [
      { id: 'manager', name: '主管', email: 'manager@example.com' },
      { id: 'reviewer', name: '评审人', email: 'reviewer@example.com' },
    ],
    groups: [{ id: 'review', name: '报告评审组', contactIds: ['manager', 'reviewer'] }],
  })
  await store.saveMailConfig({
    host: 'smtp.example.com', port: 465, secure: true, username: 'sender@example.com',
    fromName: '小可', fromAddress: 'sender@example.com',
    ...(options.sentSync === undefined ? {} : { sentSync: options.sentSync }),
  })
  return {
    store,
    mailer: new WorkReportMailer(store, credentials(), {
      passwordRef: 'TELOS_WORK_REPORT_SMTP_PASSWORD',
      imapPasswordRef: 'TELOS_WORK_REPORT_IMAP_PASSWORD',
      createTransport,
      ...(options.sentSynchronizer === undefined ? {} : { sentSynchronizer: options.sentSynchronizer }),
    }),
  }
}

describe('WorkReportMailer', () => {
  it('snapshots actual group recipients and sends individual HTML plus plain-text messages', async () => {
    const messages: Array<Record<string, unknown>> = []
    const options: Array<Record<string, unknown>> = []
    let closed = 0
    const { mailer } = await fixture((input) => {
      options.push(input)
      return {
        async sendMail(message) { messages.push(message); return { messageId: String(message.messageId) } },
        close() { closed += 1 },
      }
    })
    const prepared = await mailer.prepare({
      reportId: 'daily:2026-08-15:2026-08-15', groupIds: ['review'], subject: '8 月 15 日工作日报',
    })

    expect(prepared.recipients.map(recipient => recipient.email)).toEqual(['manager@example.com', 'reviewer@example.com'])
    await expect(mailer.approvalReason({ deliveryId: prepared.deliveryId, deliveryHash: prepared.deliveryHash }))
      .resolves.toContain('实际收件人（2）')
    await expect(mailer.send(
      { deliveryId: prepared.deliveryId, deliveryHash: prepared.deliveryHash },
      new AbortController().signal,
    )).resolves.toMatchObject({ status: 'sent', sent: [{ id: 'manager' }, { id: 'reviewer' }], failed: [] })

    expect(options[0]).toMatchObject({ auth: { user: 'sender@example.com', pass: 'smtp-super-secret' } })
    expect(messages).toHaveLength(2)
    expect(messages[0]?.to).toEqual({ name: '主管', address: 'manager@example.com' })
    expect(messages[1]?.to).toEqual({ name: '评审人', address: 'reviewer@example.com' })
    expect(String(messages[0]?.html)).toContain('<strong>本地报告插件</strong>')
    expect(String(messages[0]?.text)).toContain('• 完成 本地报告插件')
    expect(String(messages[0]?.text)).not.toContain('**')
    expect(closed).toBe(1)
    await expect(mailer.send(
      { deliveryId: prepared.deliveryId, deliveryHash: prepared.deliveryHash },
      new AbortController().signal,
    )).rejects.toThrow(/already been sent/)
  })

  it('retries only failed recipients after another explicit send operation', async () => {
    const attempts = new Map<string, number>()
    const { mailer } = await fixture(() => ({
      async sendMail(message) {
        const email = (message.to as { address: string }).address
        const count = (attempts.get(email) ?? 0) + 1
        attempts.set(email, count)
        if (email === 'reviewer@example.com' && count === 1) throw new Error('temporary SMTP failure')
        return { messageId: String(message.messageId) }
      },
      close() {},
    }))
    const prepared = await mailer.prepare({
      reportId: 'daily:2026-08-15:2026-08-15', groupIds: ['review'], subject: '日报',
    })
    const input = { deliveryId: prepared.deliveryId, deliveryHash: prepared.deliveryHash }

    await expect(mailer.send(input, new AbortController().signal)).resolves.toMatchObject({
      status: 'partial', sent: [{ id: 'manager' }], failed: [{ id: 'reviewer', error: 'temporary SMTP failure' }],
    })
    await expect(mailer.send(input, new AbortController().signal)).resolves.toMatchObject({
      status: 'sent', sent: [{ id: 'manager' }, { id: 'reviewer' }], failed: [],
    })
    expect(attempts.get('manager@example.com')).toBe(1)
    expect(attempts.get('reviewer@example.com')).toBe(2)
  })

  it('refuses a mutated draft or mismatched approval hash', async () => {
    const { store, mailer } = await fixture(() => ({ async sendMail() { return {} }, close() {} }))
    const prepared = await mailer.prepare({
      reportId: 'daily:2026-08-15:2026-08-15', contactIds: ['manager'], subject: '日报',
    })
    await expect(mailer.send(
      { deliveryId: prepared.deliveryId, deliveryHash: '0'.repeat(64) }, new AbortController().signal,
    )).rejects.toThrow(/approved hash/)

    const draft = await store.deliveryDraft(prepared.deliveryId)
    draft.immutable.subject = '被篡改的主题'
    await store.saveDeliveryDraft(draft)
    await expect(mailer.approvalReason({
      deliveryId: prepared.deliveryId, deliveryHash: prepared.deliveryHash,
    })).rejects.toThrow(/approved hash/)
  })

  it('synchronizes one sent copy after complete SMTP delivery and exposes a local record', async () => {
    let appended = 0
    const sentSynchronizer = new SentMailSynchronizer({
      compileMessage: async () => Buffer.from('From: sender@example.com\r\n\r\nRendered report'),
      createClient: options => ({
        async connect() { expect(options.auth).toEqual({ user: 'sender@example.com', pass: 'smtp-super-secret' }) },
        async list() { return [{ path: 'Sent Messages', specialUse: '\\Sent' }] as never },
        async append(path, content, flags) {
          appended += 1
          expect(path).toBe('Sent Messages')
          expect(content).toBeInstanceOf(Buffer)
          expect(flags).toEqual(['\\Seen'])
          return { destination: path, uid: 42 }
        },
        async logout() {},
        close() {},
      }),
    })
    const { store, mailer } = await fixture(() => ({ async sendMail(message) { return { messageId: String(message.messageId) } }, close() {} }), {
      sentSync: {
        enabled: true, host: 'imap.example.com', port: 993, secure: true,
        username: 'sender@example.com', passwordMode: 'smtp',
      },
      sentSynchronizer,
    })
    const prepared = await mailer.prepare({
      reportId: 'daily:2026-08-15:2026-08-15', groupIds: ['review'], subject: '同步日报',
    })

    await expect(mailer.send(prepared, new AbortController().signal)).resolves.toMatchObject({
      status: 'sent', sentFolderSync: { status: 'synced', mailbox: 'Sent Messages', uid: 42 },
    })
    expect(appended).toBe(1)
    await expect(store.deliveryRecords()).resolves.toMatchObject([{
      deliveryId: prepared.deliveryId,
      subject: '同步日报',
      sentCount: 2,
      failedCount: 0,
      sentFolderSync: { status: 'synced', mailbox: 'Sent Messages' },
    }])
  })

  it('records IMAP failure and retries only Sent synchronization without resending SMTP', async () => {
    let smtpCalls = 0
    let imapCalls = 0
    const sentSynchronizer = new SentMailSynchronizer({
      compileMessage: async () => Buffer.from('Rendered report'),
      createClient: () => ({
        async connect() {},
        async list() { return [{ path: 'Sent', specialUse: '\\Sent' }] as never },
        async append(path) {
          imapCalls += 1
          if (imapCalls === 1) throw new Error('temporary IMAP failure')
          return { destination: path, uid: 7 }
        },
        async logout() {},
        close() {},
      }),
    })
    const { mailer } = await fixture(() => ({
      async sendMail(message) { smtpCalls += 1; return { messageId: String(message.messageId) } }, close() {},
    }), {
      sentSync: {
        enabled: true, host: 'imap.example.com', port: 993, secure: true,
        username: 'sender@example.com', passwordMode: 'imap',
      },
      sentSynchronizer,
    })
    const prepared = await mailer.prepare({
      reportId: 'daily:2026-08-15:2026-08-15', groupIds: ['review'], subject: '重试同步日报',
    })

    await expect(mailer.send(prepared, new AbortController().signal)).resolves.toMatchObject({
      status: 'sent', sentFolderSync: { status: 'failed', error: 'temporary IMAP failure' },
    })
    expect(smtpCalls).toBe(2)
    await expect(mailer.sentSyncApprovalReason(prepared)).resolves.toContain('不会再次向收件人发送邮件')
    await expect(mailer.syncSentEmail(prepared, new AbortController().signal)).resolves.toMatchObject({
      status: 'synced', mailbox: 'Sent', uid: 7,
    })
    expect(smtpCalls).toBe(2)
    expect(imapCalls).toBe(2)
  })
})
