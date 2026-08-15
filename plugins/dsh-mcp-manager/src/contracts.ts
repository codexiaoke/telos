export const MCP_MANAGER_RPC_CHANNEL = '/telos-mcp-manager'

export type McpTransport = 'stdio' | 'streamable-http'

export interface ReconnectPolicy {
  enabled: boolean
  initialDelayMs: number
  maxDelayMs: number
  maxAttempts: number
}

export interface CredentialBinding {
  name: string
  credentialRef: string
}

export interface McpServerConfig {
  serverName: string
  displayName: string
  enabled: boolean
  transport: McpTransport
  command?: string
  args?: string[]
  cwd?: string
  url?: string
  env: CredentialBinding[]
  headers: CredentialBinding[]
  toolCallTimeoutMs: number
  reconnect: ReconnectPolicy
}

export interface McpServerMutation {
  server: McpServerConfig
  credentialValues?: Record<string, string>
  acknowledgeLocalExecution?: boolean
}

export interface CredentialBindingView extends CredentialBinding {
  configured: boolean
  source?: string
  writable: boolean
}

export interface McpServerView extends Omit<McpServerConfig, 'env' | 'headers'> {
  runtime: 'disabled' | 'connecting' | 'loaded' | 'error'
  error?: string
  toolNames: string[]
  env: CredentialBindingView[]
  headers: CredentialBindingView[]
}

export type McpManagerRpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: 'bad-request'; message: string; details: { issues: never[] } } }
  | { ok: false; error: { code: 'internal'; message: string; details: Record<string, never> } }
