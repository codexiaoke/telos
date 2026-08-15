import type { MailConfig, RecipientDirectory, ReportType, WorkReportSettingsView } from '../contracts.js'
import { WORK_REPORT_RPC_CHANNEL } from '../contracts.js'
import type { ClientRpc, WorkReportClientSnapshot } from './contracts.js'

const EMPTY: WorkReportClientSnapshot = { loading: false, reports: [], deliveries: [] }

function message(error: unknown): string { return error instanceof Error ? error.message : String(error) }

export class WorkReportClientController {
  private snapshot = EMPTY
  private readonly listeners = new Set<() => void>()

  constructor(private readonly rpc: ClientRpc) {}

  getSnapshot = (): WorkReportClientSnapshot => this.snapshot
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async refresh(): Promise<void> {
    await this.run(async () => {
      const [settings, reports, deliveries] = await Promise.all([
        this.call<WorkReportSettingsView>('snapshot', {}),
        this.call<WorkReportClientSnapshot['reports']>('list-reports', { limit: 50 }),
        this.call<WorkReportClientSnapshot['deliveries']>('delivery-records', { limit: 50 }),
      ])
      this.update({ settings, reports, deliveries, loading: false })
    })
  }

  async saveStandard(type: ReportType, content: string): Promise<void> {
    await this.run(async () => {
      const settings = await this.call<WorkReportSettingsView>('save-standard', { type, content })
      this.update({ settings, loading: false, notice: '报告规范已保存' })
    })
  }

  async saveDirectory(directory: RecipientDirectory): Promise<void> {
    await this.run(async () => {
      const settings = await this.call<WorkReportSettingsView>('save-directory', directory)
      this.update({ settings, loading: false, notice: '联系人和分组已保存' })
    })
  }

  async saveMail(config: MailConfig, password?: string | null, imapPassword?: string | null): Promise<void> {
    await this.run(async () => {
      const settings = await this.call<WorkReportSettingsView>('save-mail', {
        config,
        ...(password === undefined ? {} : { password }),
        ...(imapPassword === undefined ? {} : { imapPassword }),
      })
      const cleared = [password === null ? 'SMTP' : '', imapPassword === null ? 'IMAP' : ''].filter(Boolean).join('、')
      this.update({ settings, loading: false, notice: cleared === '' ? '邮件配置已保存' : `邮件配置已保存，${cleared} 密码已清除` })
    })
  }

  private async call<T>(endpoint: string, payload: unknown): Promise<T> {
    const result = await this.rpc.call(WORK_REPORT_RPC_CHANNEL, endpoint, payload)
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
    return result.value as T
  }

  private async run(operation: () => Promise<void>): Promise<void> {
    this.update({ loading: true, error: undefined, notice: undefined })
    try {
      await operation()
    } catch (error) {
      this.update({ loading: false, error: message(error) })
    }
  }

  private update(patch: Partial<WorkReportClientSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener()
  }
}
