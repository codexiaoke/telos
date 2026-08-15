import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-client-connection'
import { credentialRef, type CredentialProvider } from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { defineTool, type JsonValue, type PreToolDecision, type ToolExecution, type ToolRunContext } from '@deepseek-ai/dsh-tools'
import {
  REPORT_TYPES,
  SMTP_PASSWORD_REF,
  WORK_REPORT_RPC_CHANNEL,
  type MailSettingsView,
  type WorkReportRpcResult,
  type WorkReportSettingsView,
} from './contracts.js'
import { WorkReportMailer, type PrepareEmailInput, type SendEmailInput } from './mailer.js'
import { parseMailConfig, WorkReportStore } from './store.js'

export { WORK_REPORT_RPC_CHANNEL, SMTP_PASSWORD_REF } from './contracts.js'
export type * from './contracts.js'
export { WorkReportMailer } from './mailer.js'
export { renderMarkdownEmail, markdownToPlainText } from './markdown-email.js'
export { WorkReportStore, parseDirectory, parseMailConfig } from './store.js'

export const name = 'telos-work-report'
export const inject = ['agents', 'connection', 'credentials', 'tools']

export interface Config {
  rootPath: string
  smtpPasswordRef?: string
  maxReportBytes?: number
  maxContextBytes?: number
}

const JSON_OUTPUT = {
  schema: { type: 'json' as const },
  render: (_args: unknown, value: JsonValue) => [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
}

function result<T>(operation: () => T | Promise<T>): Promise<WorkReportRpcResult<T>> {
  return Promise.resolve().then(operation).then(
    value => ({ ok: true, value }),
    (error: unknown): WorkReportRpcResult<never> => {
      const message = error instanceof Error ? error.message : String(error)
      return error instanceof TypeError || error instanceof RangeError
        ? { ok: false, error: { code: 'bad-request', message, details: { issues: [] } } }
        : { ok: false, error: { code: 'internal', message, details: {} } }
    },
  )
}

function json(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function sendInput(value: unknown): SendEmailInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError('email send arguments must be an object')
  const input = value as Record<string, unknown>
  if (typeof input.delivery_id !== 'string' || typeof input.delivery_hash !== 'string') throw new TypeError('email send arguments are invalid')
  return { deliveryId: input.delivery_id, deliveryHash: input.delivery_hash }
}

function assertTopLevelAgent(ctx: Context, exec: ToolExecution | ToolRunContext): Agent {
  const agent = exec.agent
  if (agent === undefined || ctx.agents.get(agent.id) !== agent || !ctx.agents.roots().includes(agent)
    || ctx.agents.currentInitiator() !== agent || agent.status !== 'running') {
    throw new Error('email delivery requires the exact live top-level DSH agent')
  }
  return agent
}

async function settingsView(
  store: WorkReportStore,
  credentials: CredentialProvider,
  passwordRef: string,
): Promise<WorkReportSettingsView> {
  const [standards, directory, mail, password] = await Promise.all([
    store.standards(),
    store.directory(),
    store.mailConfig(),
    credentials.describe(credentialRef(passwordRef)),
  ])
  const mailView: MailSettingsView | undefined = mail === undefined ? undefined : {
    ...mail,
    passwordConfigured: password.configured,
    ...(password.source === undefined ? {} : { passwordSource: password.source }),
    passwordWritable: password.writable,
  }
  return { rootPath: store.rootPath, standards, directory, ...(mailView === undefined ? {} : { mail: mailView }) }
}

function installRpc(ctx: Context, store: WorkReportStore, passwordRef: string): void {
  ctx.connection.rpc.handle(
    WORK_REPORT_RPC_CHANNEL,
    (endpoint, payload) => {
      if (endpoint === 'snapshot') return result(() => settingsView(store, ctx.credentials, passwordRef))
      if (endpoint === 'save-standard') {
        return result(async () => {
          if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new TypeError('payload must be an object')
          const input = payload as Record<string, unknown>
          await store.saveStandard(input.type, input.content)
          return settingsView(store, ctx.credentials, passwordRef)
        })
      }
      if (endpoint === 'save-directory') {
        return result(async () => {
          await store.saveDirectory(payload)
          return settingsView(store, ctx.credentials, passwordRef)
        })
      }
      if (endpoint === 'save-mail') {
        return result(async () => {
          if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new TypeError('payload must be an object')
          const input = payload as Record<string, unknown>
          const config = parseMailConfig(input.config)
          const password = input.password
          if (password !== undefined && password !== null && (typeof password !== 'string' || password.length === 0)) {
            throw new TypeError('SMTP password must be a non-empty string or null')
          }
          await store.saveMailConfig(config)
          if (typeof password === 'string') await ctx.credentials.set(credentialRef(passwordRef), password)
          else if (password === null) await ctx.credentials.unset(credentialRef(passwordRef))
          return settingsView(store, ctx.credentials, passwordRef)
        })
      }
      if (endpoint === 'list-reports') return result(() => store.list(typeof payload === 'object' && payload !== null ? payload : {}))
      return result(() => { throw new TypeError(`unknown work-report endpoint: ${endpoint}`) })
    },
    { authority: 'loopback' },
  )
}

function installTools(ctx: Context, store: WorkReportStore, mailer: WorkReportMailer): void {
  ctx.tools.register(defineTool({
    name: 'work_report_context',
    description: 'Read the confirmed writing standard, an existing same-period report, and the local reports that may be summarized for a daily, weekly, or monthly work report. Call this before generating any report. If standard_configured is false, ask the human to confirm the audience, tone, length, and expected content before saving a standard. Weekly reports may use only returned daily sources; monthly reports may use only returned weekly sources, or returned daily sources when no weekly report exists. Never invent missing work.',
    parameters: {
      report_type: { type: 'string', enum: REPORT_TYPES, required: true },
      period_start: { type: 'string', description: 'Inclusive period start using YYYY-MM-DD.', required: true },
      period_end: { type: 'string', description: 'Inclusive period end using YYYY-MM-DD.', required: true },
    },
    output: JSON_OUTPUT,
    isConcurrencySafe: () => true,
    async execute(args) {
      return json(await store.context({ type: args.report_type, periodStart: args.period_start, periodEnd: args.period_end }))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'work_report_list',
    description: 'List locally saved work reports. Use the returned report id with work_report_get or work_report_prepare_email.',
    parameters: {
      report_type: { type: 'string', enum: REPORT_TYPES },
      period_start: { type: 'string' },
      period_end: { type: 'string' },
      limit: { type: 'integer', default: 20 },
    },
    output: JSON_OUTPUT,
    isConcurrencySafe: () => true,
    async execute(args) {
      return json(await store.list({
        ...(args.report_type === undefined ? {} : { type: args.report_type }),
        ...(args.period_start === undefined ? {} : { periodStart: args.period_start }),
        ...(args.period_end === undefined ? {} : { periodEnd: args.period_end }),
        ...(args.limit === undefined ? {} : { limit: args.limit }),
      }))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'work_report_get',
    description: 'Read one locally saved Markdown work report by the exact id returned from work_report_list.',
    parameters: { report_id: { type: 'string', required: true } },
    output: JSON_OUTPUT,
    isConcurrencySafe: () => true,
    async execute(args) { return json(await store.get(args.report_id)) },
  }))

  ctx.tools.register(defineTool({
    name: 'work_report_save_standard',
    description: 'Save the plain-text or Markdown writing standard for one report type. Call only after the human has explicitly confirmed that type\'s audience, tone, length, and expected content. This replaces the previous standard.',
    parameters: {
      report_type: { type: 'string', enum: REPORT_TYPES, required: true },
      standard: { type: 'string', required: true },
    },
    output: JSON_OUTPUT,
    async execute(args) {
      return json({ reportType: args.report_type, standard: await store.saveStandard(args.report_type, args.standard) })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'work_report_save',
    description: 'Save a complete generated work report as one ordinary local Markdown file. The report content is not split into structured fields. Call only after work_report_context. Daily content must come only from the human\'s current work description; weekly/monthly content must come only from context sources. Set overwrite only when the human explicitly asks to revise or regenerate the existing same-period report.',
    parameters: {
      report_type: { type: 'string', enum: REPORT_TYPES, required: true },
      period_start: { type: 'string', required: true },
      period_end: { type: 'string', required: true },
      markdown: { type: 'string', required: true },
      overwrite: { type: 'boolean', default: false },
    },
    output: JSON_OUTPUT,
    async execute(args) {
      return json(await store.saveReport({
        type: args.report_type,
        periodStart: args.period_start,
        periodEnd: args.period_end,
        markdown: args.markdown,
        overwrite: args.overwrite ?? false,
      }))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'work_report_recipients',
    description: 'List the local email contacts and recipient groups. This never returns SMTP credentials. Use exact contact and group ids with work_report_prepare_email.',
    parameters: {},
    output: JSON_OUTPUT,
    isConcurrencySafe: () => true,
    async execute() { return json(await store.directory()) },
  }))

  ctx.tools.register(defineTool({
    name: 'work_report_prepare_email',
    description: 'Prepare but do not send an email for one saved report. It expands local contact groups, snapshots the actual recipients and report, converts Markdown into safe HTML plus plain-text fallback, and returns an immutable delivery id/hash. After the human asks to send, call work_report_send_email with that exact id/hash; the send tool raises the native DSH approval prompt.',
    parameters: {
      report_id: { type: 'string', required: true },
      contact_ids: { type: 'array', items: { type: 'string' } },
      group_ids: { type: 'array', items: { type: 'string' } },
      subject: { type: 'string', required: true },
      additional_message: { type: 'string' },
    },
    output: JSON_OUTPUT,
    async execute(args) {
      const input: PrepareEmailInput = {
        reportId: args.report_id,
        subject: args.subject,
        ...(args.contact_ids === undefined ? {} : { contactIds: args.contact_ids }),
        ...(args.group_ids === undefined ? {} : { groupIds: args.group_ids }),
        ...(args.additional_message === undefined ? {} : { additionalMessage: args.additional_message }),
      }
      return json(await mailer.prepare(input))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'work_report_send_email',
    description: 'Send one immutable email draft prepared by work_report_prepare_email. This is an external action and always raises the native DSH approval prompt. Use the exact delivery id and hash from the preparation result. Never retry after user rejection; a partial SMTP result may be retried only after telling the user another approval will be required.',
    parameters: {
      delivery_id: { type: 'string', required: true },
      delivery_hash: { type: 'string', required: true },
    },
    output: JSON_OUTPUT,
    async execute(args, exec) {
      assertTopLevelAgent(ctx, exec)
      return json(await mailer.send({ deliveryId: args.delivery_id, deliveryHash: args.delivery_hash }, exec.signal))
    },
  }))

  ctx.on('tools/pre-execute', async (exec, next): Promise<PreToolDecision> => {
    if (exec.name !== 'work_report_send_email') return next()
    try {
      assertTopLevelAgent(ctx, exec)
      return { kind: 'ask', reason: await mailer.approvalReason(sendInput(exec.arguments)) }
    } catch (error) {
      return { kind: 'deny', reason: `email approval could not be prepared: ${message(error)}` }
    }
  })
}

function installPrompt(ctx: Context): void {
  ctx.inject(['systemPrompt'], (promptCtx) => {
    promptCtx.systemPrompt.section({
      name: 'tool:telos-work-report',
      order: 116,
      text: 'Telos work reports are ordinary local Markdown documents, not structured work-fact records. For every daily, weekly, or monthly request, call work_report_context first. If its standardConfigured field is false, ask the human to confirm audience, tone, approximate length, and expected sections, then save the confirmed wording with work_report_save_standard before generating. A daily report may use only facts the human supplied in the current report request and its follow-up clarification, never unrelated historical reports. A weekly report may use only returned daily sources. A monthly report may use only returned weekly sources, or returned daily sources when context explicitly falls back. If sources are absent, ask the human for content; never fabricate. Save the complete generated Markdown with work_report_save and also show the readable report in the reply. To send mail, resolve recipients, prepare an immutable draft, then call work_report_send_email so DSH asks for native approval. The email renderer sends HTML and plain text, never raw Markdown. Do not retry a rejected send.',
    })
  })
}

export function apply(ctx: Context, config: Config): void {
  if (typeof config.rootPath !== 'string' || config.rootPath.trim() === '') throw new TypeError('telos-work-report rootPath must be a non-empty string')
  const passwordRef = config.smtpPasswordRef ?? SMTP_PASSWORD_REF
  credentialRef(passwordRef)
  const store = new WorkReportStore(config.rootPath, {
    maxReportBytes: config.maxReportBytes,
    maxContextBytes: config.maxContextBytes,
  })
  const mailer = new WorkReportMailer(store, ctx.credentials, { passwordRef })
  installRpc(ctx, store, passwordRef)
  installTools(ctx, store, mailer)
  installPrompt(ctx)
}
