import type {} from '@deepseek-ai/dsh-client-connection/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { MultiRootWorkspaceController } from './controller.js'
import { MultiRootDirectoryFlow, type MultiRootDirectoryFlowInjected } from './MultiRootDirectoryFlow.js'
import type { ClientRpc } from './contracts.js'
import { installMultiRootWorkspaceStyles } from './styles.js'

export const inject = ['slots', 'connection']
export { MultiRootWorkspaceController } from './controller.js'
export { MultiRootDirectoryFlow } from './MultiRootDirectoryFlow.js'

export function apply(ctx: ClientContext): void {
  const controller = new MultiRootWorkspaceController(ctx.connection.rpc as unknown as ClientRpc)
  const injected = (): MultiRootDirectoryFlowInjected => ({ controller })
  ctx.effect(() => installMultiRootWorkspaceStyles(), 'telos-multi-root-workspace: client styles')
  ctx.slots.inject('conversation.hero.workspace.directoryFlow', () =>
    ctx.slots.inject('sidebar.workspaces.directoryFlow', function* () {
      yield ctx.slots.register({ name: 'conversation.hero.workspace.directoryFlow', inject: injected }, MultiRootDirectoryFlow as never)
      yield ctx.slots.register({ name: 'sidebar.workspaces.directoryFlow', inject: injected }, MultiRootDirectoryFlow as never)
    }))
}
