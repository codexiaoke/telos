import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-tools'
import { MCP_MANAGER_RPC_CHANNEL, type McpManagerRpcResult } from './contracts.js'
import { McpManager } from './manager.js'
import { McpServerStore } from './store.js'

export { MCP_MANAGER_RPC_CHANNEL } from './contracts.js'
export type * from './contracts.js'
export { McpManager } from './manager.js'
export { McpServerStore, parseServer } from './store.js'

export const name = 'telos-mcp-manager'
export const inject = ['connection', 'credentials', 'tools']

export interface Config { storePath: string }

function result<T>(operation: () => T | Promise<T>): Promise<McpManagerRpcResult<T>> {
  return Promise.resolve().then(operation).then(
    value => ({ ok: true, value }),
    (error: unknown): McpManagerRpcResult<never> => {
      const message = error instanceof Error ? error.message : String(error)
      return error instanceof TypeError || error instanceof RangeError
        ? { ok: false, error: { code: 'bad-request', message, details: { issues: [] } } }
        : { ok: false, error: { code: 'internal', message, details: {} } }
    },
  )
}

export function apply(ctx: Context, config: Config): void {
  if (typeof config.storePath !== 'string' || config.storePath.trim() === '') throw new TypeError('telos-mcp-manager storePath must be a non-empty string')
  const manager = new McpManager(ctx, new McpServerStore(config.storePath))
  ctx.connection.rpc.handle(
    MCP_MANAGER_RPC_CHANNEL,
    (endpoint, payload) => result(() => manager.handle(endpoint, payload)),
    { authority: 'loopback' },
  )
  ctx.effect(() => () => manager.close(), 'telos-mcp-manager: stop MCP servers')
  manager.start()
}
