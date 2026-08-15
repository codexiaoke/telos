export const WORK_REPORT_RPC_CHANNEL = '/telos-work-report'
export const SMTP_PASSWORD_REF = 'TELOS_WORK_REPORT_SMTP_PASSWORD'
export const IMAP_PASSWORD_REF = 'TELOS_WORK_REPORT_IMAP_PASSWORD'

export const REPORT_TYPES = ['daily', 'weekly', 'monthly'] as const
export type ReportType = typeof REPORT_TYPES[number]

export interface ReportReference {
  id: string
  type: ReportType
  periodStart: string
  periodEnd: string
  title: string
  updatedAt: string
  size: number
}

export interface ReportDocument extends ReportReference {
  markdown: string
}

export interface ReportContext {
  type: ReportType
  periodStart: string
  periodEnd: string
  standardConfigured: boolean
  standard?: string
  existing?: ReportDocument
  sourceType?: ReportType
  sources: ReportDocument[]
}

export interface Contact {
  id: string
  name: string
  email: string
}

export interface ContactGroup {
  id: string
  name: string
  contactIds: string[]
}

export interface RecipientDirectory {
  version: 1
  contacts: Contact[]
  groups: ContactGroup[]
}

export interface MailConfig {
  host: string
  port: number
  secure: boolean
  username: string
  fromName: string
  fromAddress: string
  sentSync?: SentMailSyncConfig
}

export interface SentMailSyncConfig {
  enabled: true
  host: string
  port: number
  secure: boolean
  username: string
  mailbox?: string
  passwordMode: 'smtp' | 'imap'
}

export interface SentMailSyncSettingsView extends SentMailSyncConfig {
  passwordConfigured: boolean
  passwordSource?: string
  passwordWritable: boolean
}

export interface MailSettingsView extends Omit<MailConfig, 'sentSync'> {
  passwordConfigured: boolean
  passwordSource?: string
  passwordWritable: boolean
  sentSync?: SentMailSyncSettingsView
}

export interface WorkReportSettingsView {
  rootPath: string
  standards: Record<ReportType, string>
  directory: RecipientDirectory
  mail?: MailSettingsView
}

export interface ResolvedRecipient {
  id: string
  name: string
  email: string
}

export interface DeliveryDraftView {
  deliveryId: string
  deliveryHash: string
  report: ReportReference
  subject: string
  recipients: ResolvedRecipient[]
  recipientGroups: string[]
  bodyPreview: string
}

export interface DeliveryResult {
  deliveryId: string
  status: 'sent' | 'partial'
  sent: ResolvedRecipient[]
  failed: Array<ResolvedRecipient & { error: string }>
  sentFolderSync: SentFolderSyncState
}

export interface SentFolderSyncState {
  status: 'not-configured' | 'pending' | 'synced' | 'failed'
  attemptedAt?: string
  syncedAt?: string
  mailbox?: string
  uid?: number
  error?: string
}

export interface DeliveryRecord {
  deliveryId: string
  createdAt: string
  report: ReportReference
  subject: string
  recipients: ResolvedRecipient[]
  status: 'partial' | 'sent'
  sentAt?: string
  sentCount: number
  failedCount: number
  sentFolderSync: SentFolderSyncState
}

export type WorkReportRpcResult<T> =
  | { ok: true; value: T }
  | {
    ok: false
    error: {
      code: 'bad-request'
      message: string
      details: { issues: never[] }
    } | {
      code: 'internal'
      message: string
      details: Record<string, never>
    }
  }
