import type { McpServerConfig, McpServerView } from '../contracts.js'

export interface ClientRpc {
  call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<
    | { ok: true; value: unknown }
    | { ok: false; error: { code: string; message: string } }
  >
}

export interface McpClientSnapshot {
  loading: boolean
  servers: McpServerView[]
  error?: string
  notice?: string
}

export interface ServerDraft {
  server: McpServerConfig
  credentialValues: Record<string, string>
  acknowledgeLocalExecution: boolean
}
