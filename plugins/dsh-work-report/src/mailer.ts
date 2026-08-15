import { createHash, randomUUID } from 'node:crypto'
import type { CredentialProvider } from '@deepseek-ai/dsh-credentials'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import nodemailer from 'nodemailer'
import { IMAP_PASSWORD_REF } from './contracts.js'
import type { DeliveryDraftView, DeliveryResult, ResolvedRecipient, SentFolderSyncState } from './contracts.js'
import { renderMarkdownEmail } from './markdown-email.js'
import { SentMailSynchronizer } from './sent-sync.js'
import type { DeliveryDraft, DeliveryDraftImmutable } from './store.js'
import { WorkReportStore } from './store.js'

export interface PrepareEmailInput {
  reportId: string
  contactIds?: string[]
  groupIds?: string[]
  subject: string
  additionalMessage?: string
}

export interface SendEmailInput {
  deliveryId: string
  deliveryHash: string
}

interface TransporterLike {
  sendMail(message: Record<string, unknown>): Promise<{ messageId?: string }>
  close(): void
}

export type MailTransportFactory = (options: Record<string, unknown>) => TransporterLike

export interface WorkReportMailerOptions {
  passwordRef: string
  imapPasswordRef?: string
  createTransport?: MailTransportFactory
  sentSynchronizer?: SentMailSynchronizer
}

function requiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`)
  const normalized = value.trim()
  if (normalized.length > maxLength) throw new RangeError(`${field} is too long`)
  return normalized
}

function idArray(value: unknown, field: string): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new TypeError(`${field} must be an array`)
  const ids = value.map((item, index) => requiredString(item, `${field}[${String(index)}]`, 64))
  if (new Set(ids).size !== ids.length) throw new TypeError(`${field} must not contain duplicates`)
  return ids
}

function immutableHash(value: DeliveryDraftImmutable): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function safeMessage(error: unknown, secrets: readonly string[] = []): string {
  let message = error instanceof Error ? error.message : String(error)
  for (const secret of secrets) {
    if (secret !== '') message = message.replaceAll(secret, '[redacted]')
  }
  return message.replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, 'sk-[redacted]').slice(0, 1_000)
}

function deterministicMessageId(deliveryId: string, email: string): string {
  const recipient = createHash('sha256').update(email).digest('hex').slice(0, 20)
  return `<telos-work-report-${deliveryId}-${recipient}@telos.local>`
}

function referenceOf<T extends { markdown: string }>(report: T): Omit<T, 'markdown'> {
  const { markdown: _markdown, ...reference } = report
  return reference
}

export class WorkReportMailer {
  private readonly passwordRef
  private readonly imapPasswordRef
  private readonly createTransport: MailTransportFactory
  private readonly sentSynchronizer: SentMailSynchronizer

  constructor(
    private readonly store: WorkReportStore,
    private readonly credentials: CredentialProvider,
    options: WorkReportMailerOptions,
  ) {
    this.passwordRef = credentialRef(requiredString(options.passwordRef, 'SMTP password credential reference', 128))
    this.imapPasswordRef = credentialRef(requiredString(options.imapPasswordRef ?? IMAP_PASSWORD_REF, 'IMAP password credential reference', 128))
    this.createTransport = options.createTransport ?? (input => nodemailer.createTransport(input) as unknown as TransporterLike)
    this.sentSynchronizer = options.sentSynchronizer ?? new SentMailSynchronizer()
  }

  async prepare(input: PrepareEmailInput): Promise<DeliveryDraftView> {
    const reportId = requiredString(input.reportId, 'reportId', 64)
    const subject = requiredString(input.subject, 'subject', 300)
    const contactIds = idArray(input.contactIds, 'contactIds')
    const groupIds = idArray(input.groupIds, 'groupIds')
    if (contactIds.length === 0 && groupIds.length === 0) throw new TypeError('at least one contact or group is required')
    const additionalMessage = input.additionalMessage === undefined
      ? undefined
      : requiredString(input.additionalMessage, 'additionalMessage', 5_000)

    const [report, directory, mail, credentialInfo] = await Promise.all([
      this.store.get(reportId),
      this.store.directory(),
      this.store.mailConfig(),
      this.credentials.describe(this.passwordRef),
    ])
    if (mail === undefined) throw new Error('SMTP settings are not configured')
    if (!credentialInfo.configured) throw new Error('SMTP password is not configured')
    const contactById = new Map(directory.contacts.map(contact => [contact.id, contact]))
    const groupById = new Map(directory.groups.map(group => [group.id, group]))
    const selectedIds = new Set(contactIds)
    const groupNames: string[] = []
    for (const id of groupIds) {
      const group = groupById.get(id)
      if (group === undefined) throw new Error(`recipient group does not exist: ${id}`)
      groupNames.push(group.name)
      for (const contactId of group.contactIds) selectedIds.add(contactId)
    }
    const recipients: ResolvedRecipient[] = []
    const emails = new Set<string>()
    for (const id of selectedIds) {
      const contact = contactById.get(id)
      if (contact === undefined) throw new Error(`recipient contact does not exist: ${id}`)
      if (emails.has(contact.email)) continue
      emails.add(contact.email)
      recipients.push(contact)
    }
    if (recipients.length === 0) throw new Error('selected contacts and groups contain no recipients')
    if (recipients.length > 100) throw new RangeError('one delivery may contain at most 100 recipients')

    const source = additionalMessage === undefined
      ? report.markdown
      : `${additionalMessage}\n\n---\n\n${report.markdown}`
    const bodies = renderMarkdownEmail(source)
    const immutable: DeliveryDraftImmutable = {
      report: referenceOf(report),
      recipients,
      recipientGroups: groupNames,
      subject,
      html: bodies.html,
      text: bodies.text,
      mail,
    }
    const draft: DeliveryDraft = {
      version: 1,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      hash: immutableHash(immutable),
      status: 'prepared',
      immutable,
      sentEmails: [],
      attempts: [],
      sentFolderSync: mail.sentSync === undefined ? { status: 'not-configured' } : { status: 'pending' },
    }
    await this.store.saveDeliveryDraft(draft)
    return {
      deliveryId: draft.id,
      deliveryHash: draft.hash,
      report: draft.immutable.report,
      subject: draft.immutable.subject,
      recipients: draft.immutable.recipients,
      recipientGroups: draft.immutable.recipientGroups,
      bodyPreview: draft.immutable.text.slice(0, 500),
    }
  }

  async approvalReason(input: SendEmailInput): Promise<string> {
    const draft = await this.checkedDraft(input)
    const recipients = draft.immutable.recipients.map(recipient => `${recipient.name} <${recipient.email}>`).join('、')
    const groups = draft.immutable.recipientGroups.length === 0 ? '' : `；分组：${draft.immutable.recipientGroups.join('、')}`
    const sync = draft.immutable.mail.sentSync === undefined
      ? ''
      : `；发送成功后同步到 IMAP 已发送邮箱（${draft.immutable.mail.sentSync.host}）`
    return `发送《${draft.immutable.report.title}》；主题：${draft.immutable.subject}；发件箱：${draft.immutable.mail.fromAddress}${groups}；实际收件人（${String(draft.immutable.recipients.length)}）：${recipients}${sync}`
  }

  async send(input: SendEmailInput, signal: AbortSignal): Promise<DeliveryResult> {
    const draft = await this.checkedDraft(input)
    if (draft.status === 'sent') throw new Error('this delivery draft has already been sent')
    const password = await this.credentials.resolve(this.passwordRef)
    if (password === undefined) throw new Error('SMTP password is not configured')
    if (signal.aborted) throw signal.reason ?? new Error('email delivery was cancelled')

    const transporter = this.createTransport({
      host: draft.immutable.mail.host,
      port: draft.immutable.mail.port,
      secure: draft.immutable.mail.secure,
      auth: { user: draft.immutable.mail.username, pass: password.value },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 45_000,
      tls: { rejectUnauthorized: true },
    })
    const close = (): void => transporter.close()
    signal.addEventListener('abort', close, { once: true })
    draft.status = 'sending'
    await this.store.saveDeliveryDraft(draft)

    try {
      for (const recipient of draft.immutable.recipients) {
        if (draft.sentEmails.includes(recipient.email)) continue
        if (signal.aborted) throw signal.reason ?? new Error('email delivery was cancelled')
        const at = new Date().toISOString()
        try {
          const result = await transporter.sendMail({
            from: { name: draft.immutable.mail.fromName, address: draft.immutable.mail.fromAddress },
            to: { name: recipient.name, address: recipient.email },
            subject: draft.immutable.subject,
            text: draft.immutable.text,
            html: draft.immutable.html,
            messageId: deterministicMessageId(draft.id, recipient.email),
            headers: { 'X-Telos-Delivery-Id': draft.id },
          })
          draft.sentEmails.push(recipient.email)
          draft.attempts.push({ at, email: recipient.email, status: 'sent', ...(result.messageId === undefined ? {} : { messageId: result.messageId }) })
          await this.store.appendDeliveryHistory({ deliveryId: draft.id, reportId: draft.immutable.report.id, at, email: recipient.email, status: 'sent', messageId: result.messageId ?? null })
        } catch (error) {
          const message = safeMessage(error, [password.value])
          draft.attempts.push({ at, email: recipient.email, status: 'failed', error: message })
          await this.store.appendDeliveryHistory({ deliveryId: draft.id, reportId: draft.immutable.report.id, at, email: recipient.email, status: 'failed', error: message })
        }
        await this.store.saveDeliveryDraft(draft)
      }
    } finally {
      signal.removeEventListener('abort', close)
      transporter.close()
    }

    const sentEmails = new Set(draft.sentEmails)
    const sent = draft.immutable.recipients.filter(recipient => sentEmails.has(recipient.email))
    const failed = draft.immutable.recipients
      .filter(recipient => !sentEmails.has(recipient.email))
      .map((recipient) => {
        const attempt = draft.attempts.findLast(item => item.email === recipient.email && item.status === 'failed')
        return { ...recipient, error: attempt?.error ?? 'SMTP delivery did not complete' }
      })
    draft.status = failed.length === 0 ? 'sent' : 'partial'
    if (draft.status === 'sent') draft.sentAt = new Date().toISOString()
    await this.store.saveDeliveryDraft(draft)
    if (draft.status === 'sent' && draft.immutable.mail.sentSync !== undefined && draft.sentFolderSync.status !== 'synced') {
      await this.syncDraft(draft, signal)
    }
    return { deliveryId: draft.id, status: draft.status, sent, failed, sentFolderSync: draft.sentFolderSync }
  }

  async sentSyncApprovalReason(input: SendEmailInput): Promise<string> {
    const draft = await this.checkedDraft(input)
    const config = draft.immutable.mail.sentSync
    if (draft.status !== 'sent') throw new Error('only a fully sent work report can be synchronized to Sent')
    if (config === undefined) throw new Error('sent-mail synchronization is not configured for this delivery')
    const mailbox = config.mailbox ?? '服务器自动识别的已发送邮箱'
    return `把已发送的《${draft.immutable.report.title}》同步到 IMAP：${config.username}@${config.host} / ${mailbox}；不会再次向收件人发送邮件`
  }

  async syncSentEmail(input: SendEmailInput, signal: AbortSignal): Promise<SentFolderSyncState> {
    const draft = await this.checkedDraft(input)
    if (draft.status !== 'sent') throw new Error('only a fully sent work report can be synchronized to Sent')
    if (draft.immutable.mail.sentSync === undefined) throw new Error('sent-mail synchronization is not configured for this delivery')
    if (draft.sentFolderSync.status === 'synced') return draft.sentFolderSync
    return this.syncDraft(draft, signal)
  }

  private async syncDraft(draft: DeliveryDraft, signal: AbortSignal): Promise<SentFolderSyncState> {
    const config = draft.immutable.mail.sentSync
    if (config === undefined) return { status: 'not-configured' }
    const attemptedAt = new Date().toISOString()
    draft.sentFolderSync = { status: 'pending', attemptedAt }
    await this.store.saveDeliveryDraft(draft)
    let passwordValue = ''
    try {
      const credential = await this.credentials.resolve(config.passwordMode === 'smtp' ? this.passwordRef : this.imapPasswordRef)
      if (credential === undefined) throw new Error('IMAP password is not configured')
      passwordValue = credential.value
      draft.sentFolderSync = await this.sentSynchronizer.sync(draft, config, credential.value, signal)
      await this.store.appendDeliveryHistory({
        kind: 'sent-folder-sync', deliveryId: draft.id, reportId: draft.immutable.report.id,
        at: draft.sentFolderSync.syncedAt, status: 'synced', mailbox: draft.sentFolderSync.mailbox,
        uid: draft.sentFolderSync.uid ?? null,
      })
    } catch (error) {
      const failure = safeMessage(error, [passwordValue])
      draft.sentFolderSync = { status: 'failed', attemptedAt, error: failure }
      await this.store.appendDeliveryHistory({
        kind: 'sent-folder-sync', deliveryId: draft.id, reportId: draft.immutable.report.id,
        at: attemptedAt, status: 'failed', error: failure,
      })
    }
    await this.store.saveDeliveryDraft(draft)
    return draft.sentFolderSync
  }

  private async checkedDraft(input: SendEmailInput): Promise<DeliveryDraft> {
    const deliveryId = requiredString(input.deliveryId, 'deliveryId', 64)
    const deliveryHash = requiredString(input.deliveryHash, 'deliveryHash', 64)
    const draft = await this.store.deliveryDraft(deliveryId)
    const computed = immutableHash(draft.immutable)
    if (computed !== draft.hash || deliveryHash !== draft.hash) throw new Error('delivery draft content no longer matches the approved hash')
    return draft
  }
}
