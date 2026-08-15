import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import {
  ContinuityFooterAction,
  ContinuityHeaderAction,
  ContinuityOverlay,
  type ContinuityInjected,
} from './ContinuityViews.js'
import { ContinuityClientController } from './controller.js'
import type { ClientRpc } from './contracts.js'
import { installContinuityStyles } from './styles.js'

export { ContinuityClientController } from './controller.js'
export type * from './contracts.js'

export const inject = ['slots', 'connection']

/** Additive Client Plugin: all DSH conversation and workspace seats remain owned upstream. */
export function apply(ctx: ClientContext): void {
  // Host and Client halves augment the same Cordis Context in this combined
  // source package; the browser runner always provides the Client caller.
  const rpc = ctx.connection.rpc as unknown as ClientRpc
  const controller = new ContinuityClientController(rpc)
  const injected = (): ContinuityInjected => ({ controller })

  ctx.effect(() => installContinuityStyles(), 'telos-continuity: client styles')

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'telos-continuity',
    order: 50,
    inject: injected,
  }, ContinuityOverlay))

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'telos-continuity',
    order: -10,
    inject: injected,
  }, ContinuityFooterAction))

  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities',
    id: 'telos-continuity',
    order: 10,
    inject: injected,
  }, ContinuityHeaderAction))
}
