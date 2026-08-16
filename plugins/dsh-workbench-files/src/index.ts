import type { Context } from '@deepseek-ai/cordis'
import type { PreStepDecision } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-client-connection'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { UserMessage } from '@deepseek-ai/dsh-session'
import type { WorkspaceGroupService } from '@telos/dsh-multi-root-workspace'
import { WORKBENCH_FILES_RPC_CHANNEL, type WorkbenchFilesRpcResult } from './contracts.js'
import { editorContextPaths, renderEditorContext, type TelosEditorContextSource } from './context.js'
import { WorkspaceFileService } from './service.js'

export { WORKBENCH_FILES_RPC_CHANNEL } from './contracts.js'
export type * from './contracts.js'
export { WorkspaceFileService } from './service.js'

export const name = 'telos-workbench-files'
export const inject = ['agents', 'connection', 'telosWorkspaceGroups']

declare module '@deepseek-ai/cordis' {
  interface Context {
    telosWorkspaceGroups: WorkspaceGroupService
  }
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
    rootsForSession: sessionId => ctx.telosWorkspaceGroups.groupForSession(sessionId)?.roots,
  })
  ctx.connection.rpc.handle(
    WORKBENCH_FILES_RPC_CHANNEL,
    (endpoint, payload) => {
      if (endpoint === 'list') return result(() => service.list(payload))
      if (endpoint === 'read') return result(() => service.read(payload))
      if (endpoint === 'write') return result(() => service.write(payload))
      if (endpoint === 'stage-context') return result(() => service.stageContext(payload))
      return result(() => { throw new TypeError(`unknown workbench-files endpoint: ${endpoint}`) })
    },
    { authority: 'loopback' },
  )

  ctx.on('agent/pre-step', async ({ agent, messages, step }, next): Promise<PreStepDecision> => {
    const decision = await next()
    if (decision.kind === 'reject' || step !== 1) return decision
    const sessionId = String(agent.session.header.id)
    const injections: UserMessage[] = []
    for (const path of editorContextPaths(messages)) {
      const context = service.editorContext(sessionId, path)
      if (context === undefined) continue
      const source: TelosEditorContextSource = {
        kind: 'telos-editor-context',
        path: context.toolPath ?? context.path,
        revision: context.revision,
        ...(context.selection === undefined ? {} : {
          selection: { startLine: context.selection.startLine, endLine: context.selection.endLine },
        }),
      }
      injections.push(createUserMessage({ content: [{ type: 'text', text: renderEditorContext(context) }], source }))
    }
    return injections.length === 0 ? decision : { kind: 'enter', messages: [...decision.messages, ...injections] }
  })
}
