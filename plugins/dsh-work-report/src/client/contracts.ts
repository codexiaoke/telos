import type { MailConfig, ReportReference, WorkReportSettingsView } from '../contracts.js'

export interface ClientRpc {
  call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<
    | { ok: true; value: unknown }
    | { ok: false; error: { code: string; message: string } }
  >
}

export interface WorkReportClientSnapshot {
  loading: boolean
  settings?: WorkReportSettingsView
  reports: ReportReference[]
  error?: string
  notice?: string
}

export interface SaveMailInput {
  config: MailConfig
  password?: string | null
}
