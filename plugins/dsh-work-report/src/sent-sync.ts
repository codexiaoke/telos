import { ImapFlow, type AppendResponseObject, type ImapFlowOptions, type ListOptions, type ListResponse } from 'imapflow'
import nodemailer from 'nodemailer'
import type { SentFolderSyncState, SentMailSyncConfig } from './contracts.js'
import type { DeliveryDraft } from './store.js'

export interface ImapClientLike {
  connect(): Promise<void>
  list(options?: ListOptions): Promise<ListResponse[]>
  append(path: string, content: string | Buffer, flags?: string[], idate?: Date | string): Promise<AppendResponseObject | false>
  logout(): Promise<void>
  close(): void
}

export type ImapClientFactory = (options: ImapFlowOptions) => ImapClientLike
export type SentMessageCompiler = (draft: DeliveryDraft) => Promise<Buffer>

export interface SentMailSynchronizerOptions {
  createClient?: ImapClientFactory
  compileMessage?: SentMessageCompiler
}

function canonicalMessageId(deliveryId: string): string {
  return `<telos-work-report-${deliveryId}@telos.local>`
}

export async function compileSentMessage(draft: DeliveryDraft): Promise<Buffer> {
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' })
  const result = await transport.sendMail({
    from: { name: draft.immutable.mail.fromName, address: draft.immutable.mail.fromAddress },
    to: draft.immutable.recipients.map(recipient => ({ name: recipient.name, address: recipient.email })),
    subject: draft.immutable.subject,
    text: draft.immutable.text,
    html: draft.immutable.html,
    messageId: canonicalMessageId(draft.id),
    date: new Date(draft.sentAt ?? draft.createdAt),
    headers: { 'X-Telos-Delivery-Id': draft.id, 'X-Telos-Sent-Sync': 'imap-append' },
  })
  if (!Buffer.isBuffer(result.message)) throw new Error('failed to compile a buffered sent-mail copy')
  return result.message
}

function sentMailbox(config: SentMailSyncConfig, mailboxes: readonly ListResponse[]): string {
  if (config.mailbox !== undefined) {
    const configured = mailboxes.find(mailbox => mailbox.path === config.mailbox)
    if (configured === undefined) throw new Error(`configured IMAP sent mailbox does not exist: ${config.mailbox}`)
    return configured.path
  }
  const detected = mailboxes.find(mailbox => mailbox.specialUse === '\\Sent')
  if (detected === undefined) throw new Error('IMAP server did not expose a Sent mailbox; configure its exact mailbox path')
  return detected.path
}

export class SentMailSynchronizer {
  private readonly createClient: ImapClientFactory
  private readonly compileMessage: SentMessageCompiler

  constructor(options: SentMailSynchronizerOptions = {}) {
    this.createClient = options.createClient ?? (input => new ImapFlow(input))
    this.compileMessage = options.compileMessage ?? compileSentMessage
  }

  async sync(draft: DeliveryDraft, config: SentMailSyncConfig, password: string, signal: AbortSignal): Promise<SentFolderSyncState> {
    if (signal.aborted) throw signal.reason ?? new Error('sent-mail synchronization was cancelled')
    const rawMessage = await this.compileMessage(draft)
    if (rawMessage.length > 2 * 1024 * 1024) throw new RangeError('compiled sent-mail copy exceeds the 2 MiB synchronization limit')
    const client = this.createClient({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.username, pass: password },
      logger: false,
      disableAutoIdle: true,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 45_000,
      maxLineLength: 1024 * 1024,
      maxLiteralSize: 4 * 1024 * 1024,
      maxResponseSize: 8 * 1024 * 1024,
      tls: { rejectUnauthorized: true },
    })
    const close = (): void => client.close()
    signal.addEventListener('abort', close, { once: true })
    let connected = false
    try {
      await client.connect()
      connected = true
      if (signal.aborted) throw signal.reason ?? new Error('sent-mail synchronization was cancelled')
      const mailbox = sentMailbox(config, await client.list(
        config.mailbox === undefined ? undefined : { specialUseHints: { sent: config.mailbox } },
      ))
      const appended = await client.append(mailbox, rawMessage, ['\\Seen'], new Date(draft.sentAt ?? draft.createdAt))
      if (appended === false) throw new Error(`IMAP server rejected the sent-mail append to ${mailbox}`)
      const now = new Date().toISOString()
      return {
        status: 'synced',
        attemptedAt: now,
        syncedAt: now,
        mailbox,
        ...(appended.uid === undefined ? {} : { uid: appended.uid }),
      }
    } finally {
      signal.removeEventListener('abort', close)
      if (connected && !signal.aborted) await client.logout().catch(() => client.close())
      else client.close()
    }
  }
}
