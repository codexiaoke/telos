import { MCP_MANAGER_RPC_CHANNEL } from '../contracts.js'
import type { McpServerView } from '../contracts.js'
import type { ClientRpc, McpClientSnapshot, ServerDraft } from './contracts.js'

const EMPTY: McpClientSnapshot = { loading: false, servers: [] }

function message(error: unknown): string { return error instanceof Error ? error.message : String(error) }

export class McpClientController {
  private snapshot = EMPTY
  private readonly listeners = new Set<() => void>()

  constructor(private readonly rpc: ClientRpc) {}

  getSnapshot = (): McpClientSnapshot => this.snapshot
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async refresh(): Promise<void> { await this.run('list', {}, undefined) }
  async save(draft: ServerDraft): Promise<void> { await this.run('save', draft, 'MCP 服务已保存') }
  async toggle(serverName: string, acknowledgeLocalExecution = false): Promise<void> {
    await this.run('toggle', { serverName, acknowledgeLocalExecution }, undefined)
  }
  async reconnect(serverName: string): Promise<void> { await this.run('reconnect', { serverName }, '已重新加载 MCP 服务') }
  async delete(serverName: string): Promise<void> { await this.run('delete', { serverName }, 'MCP 服务及其可写凭据已删除') }

  private async run(endpoint: string, payload: unknown, notice: string | undefined): Promise<void> {
    this.update({ loading: true, error: undefined, notice: undefined })
    try {
      const result = await this.rpc.call(MCP_MANAGER_RPC_CHANNEL, endpoint, payload)
      if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
      this.update({ servers: result.value as McpServerView[], loading: false, notice })
    } catch (error) {
      this.update({ loading: false, error: message(error) })
    }
  }

  private update(patch: Partial<McpClientSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener()
  }
}
