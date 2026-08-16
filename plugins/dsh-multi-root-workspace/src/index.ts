import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-host-directory-picker'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-workspace'
import { MULTI_ROOT_WORKSPACE_RPC_CHANNEL, type MultiRootWorkspaceRpcResult } from './contracts.js'
import { WorkspaceGroupService } from './service.js'
import { WorkspaceGroupStore } from './store.js'
import { applyWorkspaceGroupTools } from './tools.js'

export const name = 'telos-multi-root-workspace'
export const inject = ['connection', 'directoryPicker', 'systemPrompt', 'tools', 'workspaceRegistry']
export type * from './contracts.js'
export { MULTI_ROOT_WORKSPACE_RPC_CHANNEL } from './contracts.js'
export { WorkspaceGroupService } from './service.js'
export { WorkspaceGroupStore, parseWorkspaceGroupRecord } from './store.js'

declare module '@deepseek-ai/cordis' {
  interface Context {
    telosWorkspaceGroups: WorkspaceGroupService
  }
}

export interface Config {
  storePath: string
}

function result<T>(operation: () => T | Promise<T>): Promise<MultiRootWorkspaceRpcResult<T>> {
  return Promise.resolve().then(operation).then(
    value => ({ ok: true, value }),
    (error: unknown): MultiRootWorkspaceRpcResult<never> => {
      const message = error instanceof Error ? error.message : String(error)
      return error instanceof TypeError || error instanceof RangeError
        ? { ok: false, error: { code: 'bad-request', message, details: { issues: [] } } }
        : { ok: false, error: { code: 'internal', message, details: {} } }
    },
  )
}

export function apply(ctx: Context, config: Config): void {
  if (typeof config.storePath !== 'string' || config.storePath.trim() === '') {
    throw new TypeError('telos-multi-root-workspace storePath must be a non-empty string')
  }
  const service = new WorkspaceGroupService({
    registry: ctx.workspaceRegistry,
    directoryPicker: ctx.directoryPicker,
    store: new WorkspaceGroupStore(config.storePath),
  })
  ctx.provide('telosWorkspaceGroups', service)
  ctx.connection.rpc.handle(
    MULTI_ROOT_WORKSPACE_RPC_CHANNEL,
    (endpoint, payload, signal) => result(() => service.handle(endpoint, payload, signal)),
    { authority: 'loopback' },
  )
  applyWorkspaceGroupTools(ctx, service)
}
