import { randomUUID } from 'node:crypto'
import {
  appendFile,
  chmod,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  REPORT_TYPES,
  type Contact,
  type ContactGroup,
  type MailConfig,
  type RecipientDirectory,
  type ReportContext,
  type ReportDocument,
  type ReportReference,
  type ReportType,
  type ResolvedRecipient,
} from './contracts.js'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMPTY_DIRECTORY: RecipientDirectory = { version: 1, contacts: [], groups: [] }

export interface DeliveryDraftImmutable {
  report: ReportReference
  recipients: ResolvedRecipient[]
  recipientGroups: string[]
  subject: string
  html: string
  text: string
  mail: MailConfig
}

export interface DeliveryAttempt {
  at: string
  email: string
  status: 'sent' | 'failed'
  messageId?: string
  error?: string
}

export interface DeliveryDraft {
  version: 1
  id: string
  createdAt: string
  hash: string
  status: 'prepared' | 'sending' | 'partial' | 'sent'
  immutable: DeliveryDraftImmutable
  sentEmails: string[]
  attempts: DeliveryAttempt[]
  sentAt?: string
}

export interface ReportListInput {
  type?: ReportType
  periodStart?: string
  periodEnd?: string
  limit?: number
}

export interface ReportPeriodInput {
  type: ReportType
  periodStart: string
  periodEnd: string
}

export interface SaveReportInput extends ReportPeriodInput {
  markdown: string
  overwrite?: boolean
}

export interface WorkReportStoreOptions {
  maxReportBytes?: number
  maxContextBytes?: number
}

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined
}

function requiredString(value: unknown, field: string, maxLength = 10_000): string {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`)
  const normalized = value.trim()
  if (normalized.length > maxLength) throw new RangeError(`${field} is too long`)
  return normalized
}

function parseDate(value: unknown, field: string): string {
  const date = requiredString(value, field, 10)
  if (!DATE_PATTERN.test(date)) throw new TypeError(`${field} must use YYYY-MM-DD`)
  const parsed = new Date(`${date}T00:00:00.000Z`)
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new TypeError(`${field} must be a real calendar date`)
  }
  return date
}

function parseReportType(value: unknown): ReportType {
  if (typeof value !== 'string' || !REPORT_TYPES.includes(value as ReportType)) {
    throw new TypeError(`report type must be one of ${REPORT_TYPES.join(', ')}`)
  }
  return value as ReportType
}

function normalizePeriod(input: ReportPeriodInput): ReportPeriodInput {
  const type = parseReportType(input.type)
  const periodStart = parseDate(input.periodStart, 'periodStart')
  const periodEnd = parseDate(input.periodEnd, 'periodEnd')
  if (periodStart > periodEnd) throw new RangeError('periodStart must not be later than periodEnd')
  if (type === 'daily' && periodStart !== periodEnd) throw new RangeError('daily reports must use one date')
  return { type, periodStart, periodEnd }
}

function reportId(period: ReportPeriodInput): string {
  return `${period.type}:${period.periodStart}:${period.periodEnd}`
}

function reportFilename(period: ReportPeriodInput): string {
  return period.type === 'daily'
    ? `${period.periodStart}.md`
    : `${period.periodStart}_${period.periodEnd}.md`
}

function parseReportFilename(type: ReportType, filename: string): ReportPeriodInput | undefined {
  const match = type === 'daily'
    ? /^(\d{4}-\d{2}-\d{2})\.md$/.exec(filename)
    : /^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})\.md$/.exec(filename)
  if (match?.[1] === undefined) return undefined
  try {
    return normalizePeriod({ type, periodStart: match[1], periodEnd: match[2] ?? match[1] })
  } catch {
    return undefined
  }
}

function parseReportId(value: unknown): ReportPeriodInput {
  const id = requiredString(value, 'reportId', 64)
  const [type, periodStart, periodEnd, extra] = id.split(':')
  if (extra !== undefined || type === undefined || periodStart === undefined || periodEnd === undefined) {
    throw new TypeError('reportId is invalid')
  }
  return normalizePeriod({ type: parseReportType(type), periodStart, periodEnd })
}

function reportTitle(markdown: string, period: ReportPeriodInput): string {
  for (const line of markdown.split('\n')) {
    const match = /^#\s+(.+?)\s*$/.exec(line)
    if (match?.[1] !== undefined) return match[1].trim().slice(0, 300)
  }
  const labels: Record<ReportType, string> = { daily: '工作日报', weekly: '工作周报', monthly: '工作月报' }
  return period.periodStart === period.periodEnd
    ? `${labels[period.type]}｜${period.periodStart}`
    : `${labels[period.type]}｜${period.periodStart} 至 ${period.periodEnd}`
}

function normalizeMarkdown(value: unknown, maxBytes: number): string {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError('markdown must be a non-empty string')
  const normalized = `${value.replace(/\r\n?/g, '\n').trim()}\n`
  if (Buffer.byteLength(normalized) > maxBytes) throw new RangeError('report exceeds the local size limit')
  return normalized
}

function assertId(value: unknown, field: string): string {
  const id = requiredString(value, field, 64)
  if (!ID_PATTERN.test(id)) throw new TypeError(`${field} must use letters, numbers, dot, underscore, or dash`)
  return id
}

function parseContact(value: unknown, index: number): Contact {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError(`contacts[${String(index)}] must be an object`)
  const input = value as Record<string, unknown>
  const email = requiredString(input.email, `contacts[${String(index)}].email`, 320).toLowerCase()
  if (!EMAIL_PATTERN.test(email)) throw new TypeError(`contacts[${String(index)}].email is invalid`)
  return {
    id: assertId(input.id, `contacts[${String(index)}].id`),
    name: requiredString(input.name, `contacts[${String(index)}].name`, 120),
    email,
  }
}

function parseGroup(value: unknown, index: number): ContactGroup {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError(`groups[${String(index)}] must be an object`)
  const input = value as Record<string, unknown>
  if (!Array.isArray(input.contactIds)) throw new TypeError(`groups[${String(index)}].contactIds must be an array`)
  return {
    id: assertId(input.id, `groups[${String(index)}].id`),
    name: requiredString(input.name, `groups[${String(index)}].name`, 120),
    contactIds: input.contactIds.map((id, contactIndex) => assertId(id, `groups[${String(index)}].contactIds[${String(contactIndex)}]`)),
  }
}

export function parseDirectory(value: unknown): RecipientDirectory {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError('recipient directory must be an object')
  const input = value as Record<string, unknown>
  if (!Array.isArray(input.contacts) || !Array.isArray(input.groups)) throw new TypeError('recipient directory must contain contacts and groups arrays')
  const contacts = input.contacts.map(parseContact)
  const groups = input.groups.map(parseGroup)
  const contactIds = new Set<string>()
  const emails = new Set<string>()
  for (const contact of contacts) {
    if (contactIds.has(contact.id)) throw new TypeError(`duplicate contact id: ${contact.id}`)
    if (emails.has(contact.email)) throw new TypeError(`duplicate contact email: ${contact.email}`)
    contactIds.add(contact.id)
    emails.add(contact.email)
  }
  const groupIds = new Set<string>()
  for (const group of groups) {
    if (groupIds.has(group.id)) throw new TypeError(`duplicate group id: ${group.id}`)
    groupIds.add(group.id)
    const members = new Set<string>()
    for (const id of group.contactIds) {
      if (!contactIds.has(id)) throw new TypeError(`group ${group.id} references unknown contact ${id}`)
      if (members.has(id)) throw new TypeError(`group ${group.id} repeats contact ${id}`)
      members.add(id)
    }
  }
  return { version: 1, contacts, groups }
}

export function parseMailConfig(value: unknown): MailConfig {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError('mail config must be an object')
  const input = value as Record<string, unknown>
  const port = input.port
  if (!Number.isSafeInteger(port) || (port as number) < 1 || (port as number) > 65_535) throw new RangeError('mail port must be an integer between 1 and 65535')
  if (typeof input.secure !== 'boolean') throw new TypeError('mail secure must be a boolean')
  const host = requiredString(input.host, 'mail host', 253)
  if (/\s/.test(host)) throw new TypeError('mail host must not contain whitespace')
  const fromAddress = requiredString(input.fromAddress, 'mail fromAddress', 320).toLowerCase()
  if (!EMAIL_PATTERN.test(fromAddress)) throw new TypeError('mail fromAddress is invalid')
  return {
    host,
    port: port as number,
    secure: input.secure,
    username: requiredString(input.username, 'mail username', 320),
    fromName: typeof input.fromName === 'string' ? input.fromName.trim().slice(0, 120) : '',
    fromAddress,
  }
}

function overlaps(report: ReportReference, start?: string, end?: string): boolean {
  if (start !== undefined && report.periodEnd < start) return false
  if (end !== undefined && report.periodStart > end) return false
  return true
}

export class WorkReportStore {
  readonly rootPath: string
  private readonly maxReportBytes: number
  private readonly maxContextBytes: number

  constructor(rootPath: string, options: WorkReportStoreOptions = {}) {
    if (typeof rootPath !== 'string' || rootPath.trim() === '') throw new TypeError('work report rootPath must be a non-empty string')
    this.rootPath = resolve(rootPath)
    this.maxReportBytes = options.maxReportBytes ?? 128 * 1024
    this.maxContextBytes = options.maxContextBytes ?? 512 * 1024
  }

  async initialize(): Promise<void> {
    await mkdir(this.rootPath, { recursive: true, mode: 0o700 })
    await chmod(this.rootPath, 0o700)
    await Promise.all([
      ...REPORT_TYPES.map(type => mkdir(this.reportDirectory(type), { recursive: true, mode: 0o700 })),
      mkdir(this.standardDirectory(), { recursive: true, mode: 0o700 }),
      mkdir(this.deliveryDirectory(), { recursive: true, mode: 0o700 }),
    ])
  }

  async list(input: ReportListInput = {}): Promise<ReportReference[]> {
    await this.initialize()
    const type = input.type === undefined ? undefined : parseReportType(input.type)
    const periodStart = input.periodStart === undefined ? undefined : parseDate(input.periodStart, 'periodStart')
    const periodEnd = input.periodEnd === undefined ? undefined : parseDate(input.periodEnd, 'periodEnd')
    if (periodStart !== undefined && periodEnd !== undefined && periodStart > periodEnd) throw new RangeError('periodStart must not be later than periodEnd')
    const limit = input.limit ?? 100
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new RangeError('limit must be an integer between 1 and 500')
    const types = type === undefined ? REPORT_TYPES : [type]
    const reports: ReportReference[] = []
    for (const currentType of types) {
      const filenames = await readdir(this.reportDirectory(currentType))
      for (const filename of filenames) {
        const period = parseReportFilename(currentType, filename)
        if (period === undefined) continue
        const document = await this.readPeriod(period)
        if (document !== undefined && overlaps(document, periodStart, periodEnd)) reports.push(documentWithoutBody(document))
      }
    }
    reports.sort((left, right) => right.periodEnd.localeCompare(left.periodEnd) || right.type.localeCompare(left.type))
    return reports.slice(0, limit)
  }

  async get(reportIdValue: unknown): Promise<ReportDocument> {
    const period = parseReportId(reportIdValue)
    const report = await this.readPeriod(period)
    if (report === undefined) throw new Error('report does not exist')
    return report
  }

  async context(input: ReportPeriodInput): Promise<ReportContext> {
    const period = normalizePeriod(input)
    const [standard, existing] = await Promise.all([
      this.readStandard(period.type),
      this.readPeriod(period),
    ])
    const sourceType: ReportType | undefined = period.type === 'weekly'
      ? 'daily'
      : period.type === 'monthly' ? 'weekly' : undefined
    let sources: ReportDocument[] = []
    let resolvedSourceType = sourceType
    if (sourceType !== undefined) {
      sources = await this.documentsWithin(sourceType, period.periodStart, period.periodEnd)
      if (period.type === 'monthly' && sources.length === 0) {
        resolvedSourceType = 'daily'
        sources = await this.documentsWithin('daily', period.periodStart, period.periodEnd)
      }
    }
    let bytes = 0
    const bounded: ReportDocument[] = []
    for (const source of sources) {
      const next = Buffer.byteLength(source.markdown)
      if (bytes + next > this.maxContextBytes) break
      bytes += next
      bounded.push(source)
    }
    return {
      ...period,
      standardConfigured: standard !== undefined,
      ...(standard === undefined ? {} : { standard }),
      ...(existing === undefined ? {} : { existing }),
      ...(resolvedSourceType === undefined ? {} : { sourceType: resolvedSourceType }),
      sources: bounded,
    }
  }

  async saveReport(input: SaveReportInput): Promise<ReportDocument> {
    const period = normalizePeriod(input)
    const markdown = normalizeMarkdown(input.markdown, this.maxReportBytes)
    await this.initialize()
    const path = this.reportPath(period)
    if (!input.overwrite && await this.pathExists(path)) throw new Error('a report for this type and period already exists; explicit overwrite is required')
    await this.writeAtomic(path, markdown)
    return (await this.readPeriod(period))!
  }

  async readStandard(typeValue: unknown): Promise<string | undefined> {
    const type = parseReportType(typeValue)
    await this.initialize()
    return this.readOptionalText(this.standardPath(type))
  }

  async standards(): Promise<Record<ReportType, string>> {
    const entries = await Promise.all(REPORT_TYPES.map(async type => [type, await this.readStandard(type) ?? ''] as const))
    return Object.fromEntries(entries) as Record<ReportType, string>
  }

  async saveStandard(typeValue: unknown, contentValue: unknown): Promise<string> {
    const type = parseReportType(typeValue)
    const content = normalizeMarkdown(contentValue, 32 * 1024)
    await this.initialize()
    await this.writeAtomic(this.standardPath(type), content)
    return content
  }

  async directory(): Promise<RecipientDirectory> {
    await this.initialize()
    const value = await this.readOptionalJson(this.directoryPath())
    return value === undefined ? structuredClone(EMPTY_DIRECTORY) : parseDirectory(value)
  }

  async saveDirectory(value: unknown): Promise<RecipientDirectory> {
    const directory = parseDirectory(value)
    await this.initialize()
    await this.writeJsonAtomic(this.directoryPath(), directory)
    return directory
  }

  async mailConfig(): Promise<MailConfig | undefined> {
    await this.initialize()
    const value = await this.readOptionalJson(this.mailPath())
    return value === undefined ? undefined : parseMailConfig(value)
  }

  async saveMailConfig(value: unknown): Promise<MailConfig> {
    const config = parseMailConfig(value)
    await this.initialize()
    await this.writeJsonAtomic(this.mailPath(), config)
    return config
  }

  async saveDeliveryDraft(draft: DeliveryDraft): Promise<void> {
    await this.initialize()
    await this.writeJsonAtomic(this.deliveryPath(assertId(draft.id, 'delivery id')), draft)
  }

  async deliveryDraft(idValue: unknown): Promise<DeliveryDraft> {
    const id = assertId(idValue, 'delivery id')
    await this.initialize()
    const value = await this.readOptionalJson(this.deliveryPath(id))
    if (value === undefined) throw new Error('delivery draft does not exist')
    return parseDeliveryDraft(value)
  }

  async appendDeliveryHistory(value: unknown): Promise<void> {
    await this.initialize()
    const line = `${JSON.stringify(value)}\n`
    await appendFile(this.historyPath(), line, { encoding: 'utf8', mode: 0o600 })
  }

  private async documentsWithin(type: ReportType, periodStart: string, periodEnd: string): Promise<ReportDocument[]> {
    const references = (await this.list({ type, periodStart, periodEnd, limit: 500 }))
      .filter(report => report.periodStart >= periodStart && report.periodEnd <= periodEnd)
      .sort((left, right) => left.periodStart.localeCompare(right.periodStart))
    return Promise.all(references.map(report => this.get(report.id)))
  }

  private async readPeriod(period: ReportPeriodInput): Promise<ReportDocument | undefined> {
    await this.initialize()
    const path = this.reportPath(period)
    const metadata = await this.safeFileMetadata(path)
    if (metadata === undefined) return undefined
    if (metadata.size > this.maxReportBytes) throw new RangeError(`report ${reportId(period)} exceeds the local size limit`)
    const markdown = await readFile(path, 'utf8')
    return {
      id: reportId(period),
      ...period,
      title: reportTitle(markdown, period),
      updatedAt: metadata.mtime.toISOString(),
      size: metadata.size,
      markdown,
    }
  }

  private async readOptionalText(path: string): Promise<string | undefined> {
    const metadata = await this.safeFileMetadata(path)
    if (metadata === undefined) return undefined
    if (metadata.size > 32 * 1024) throw new RangeError('local text file exceeds the size limit')
    return readFile(path, 'utf8')
  }

  private async readOptionalJson(path: string): Promise<unknown | undefined> {
    const metadata = await this.safeFileMetadata(path)
    if (metadata === undefined) return undefined
    if (metadata.size > 2 * 1024 * 1024) throw new RangeError('local JSON file exceeds the size limit')
    const text = await readFile(path, 'utf8')
    try {
      return JSON.parse(text) as unknown
    } catch {
      throw new TypeError(`invalid local JSON document at ${path}`)
    }
  }

  private async safeFileMetadata(path: string) {
    try {
      const metadata = await lstat(path)
      if (metadata.isSymbolicLink() || !metadata.isFile()) throw new Error(`refusing non-regular local file at ${path}`)
      return metadata
    } catch (error) {
      if (errorCode(error) === 'ENOENT') return undefined
      throw error
    }
  }

  private async pathExists(path: string): Promise<boolean> {
    return (await this.safeFileMetadata(path)) !== undefined
  }

  private async writeJsonAtomic(path: string, value: unknown): Promise<void> {
    await this.writeAtomic(path, `${JSON.stringify(value, null, 2)}\n`)
  }

  private async writeAtomic(path: string, content: string): Promise<void> {
    const temporary = `${path}.${randomUUID()}.tmp`
    await writeFile(temporary, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    try {
      await rename(temporary, path)
    } catch (error) {
      if (errorCode(error) !== 'EEXIST' && errorCode(error) !== 'EPERM') {
        await unlink(temporary).catch(() => undefined)
        throw error
      }
      await unlink(path).catch((unlinkError: unknown) => {
        if (errorCode(unlinkError) !== 'ENOENT') throw unlinkError
      })
      await rename(temporary, path)
    }
  }

  private reportDirectory(type: ReportType): string { return resolve(this.rootPath, 'reports', type) }
  private reportPath(period: ReportPeriodInput): string { return resolve(this.reportDirectory(period.type), reportFilename(period)) }
  private standardDirectory(): string { return resolve(this.rootPath, 'standards') }
  private standardPath(type: ReportType): string { return resolve(this.standardDirectory(), `${type}.md`) }
  private deliveryDirectory(): string { return resolve(this.rootPath, 'delivery-drafts') }
  private deliveryPath(id: string): string { return resolve(this.deliveryDirectory(), `${id}.json`) }
  private directoryPath(): string { return resolve(this.rootPath, 'contacts.json') }
  private mailPath(): string { return resolve(this.rootPath, 'mail.json') }
  private historyPath(): string { return resolve(this.rootPath, 'send-history.jsonl') }
}

function documentWithoutBody(report: ReportDocument): ReportReference {
  const { markdown: _markdown, ...reference } = report
  return reference
}

function parseDeliveryDraft(value: unknown): DeliveryDraft {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError('delivery draft is invalid')
  const draft = value as Partial<DeliveryDraft>
  if (draft.version !== 1 || typeof draft.id !== 'string' || typeof draft.createdAt !== 'string'
    || typeof draft.hash !== 'string' || !['prepared', 'sending', 'partial', 'sent'].includes(String(draft.status))
    || typeof draft.immutable !== 'object' || draft.immutable === null || !Array.isArray(draft.sentEmails)
    || !Array.isArray(draft.attempts)) {
    throw new TypeError('delivery draft is invalid')
  }
  return draft as DeliveryDraft
}
