import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import type { Workspace } from '@deepseek-ai/dsh-workspace'
import { WORKBENCH_FILES_RPC_CHANNEL, type WorkbenchFilesRpcResult } from './contracts.js'
import { WorkspaceFileService } from './service.js'

export { WORKBENCH_FILES_RPC_CHANNEL } from './contracts.js'
export type * from './contracts.js'
export { WorkspaceFileService } from './service.js'

export const name = 'telos-workbench-files'
export const inject = ['connection', 'workspaceRegistry']

function workspaceFor(ctx: Context, sessionId: string): Workspace | undefined {
  return ctx.workspaceRegistry.list().find(workspace => workspace.sessionIds.some(id => String(id) === sessionId))
}

function result<T>(operation: () => T | Promise<T>): Promise<WorkbenchFilesRpcResult<T>> {
  return Promise.resolve().then(operation).then(
    value => ({ ok: true, value }),
    (error: unknown): WorkbenchFilesRpcResult<never> => {
      const message = error instanceof Error ? error.message : String(error)
      return error instanceof TypeError
        ? { ok: false, error: { code: 'bad-request', message, details: { issues: [] } } }
        : { ok: false, error: { code: 'internal', message, details: {} } }
    },
  )
}

export function apply(ctx: Context): void {
  const service = new WorkspaceFileService({
    rootForSession: sessionId => workspaceFor(ctx, sessionId)?.path,
  })
  ctx.connection.rpc.handle(
    WORKBENCH_FILES_RPC_CHANNEL,
    (endpoint, payload) => {
      if (endpoint === 'list') return result(() => service.list(payload))
      if (endpoint === 'read') return result(() => service.read(payload))
      if (endpoint === 'write') return result(() => service.write(payload))
      return result(() => { throw new TypeError(`unknown workbench-files endpoint: ${endpoint}`) })
    },
    { authority: 'loopback' },
  )
}
