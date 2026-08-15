import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  ContinuitySettingsSection,
  type ContinuityInjected,
} from './ContinuityViews.js'
import { ContinuityClientController } from './controller.js'
import type { ClientRpc } from './contracts.js'
import { installContinuityStyles } from './styles.js'

export { ContinuityClientController } from './controller.js'
export type * from './contracts.js'

export const inject = ['slots', 'connection']

/** Additive Client Plugin: continuity management lives inside DSH Settings. */
export function apply(ctx: ClientContext): void {
  // Host and Client halves augment the same Cordis Context in this combined
  // source package; the browser runner always provides the Client caller.
  const rpc = ctx.connection.rpc as unknown as ClientRpc
  const controller = new ContinuityClientController(rpc)
  const injected = (): ContinuityInjected => ({ controller })

  ctx.effect(() => installContinuityStyles(), 'telos-continuity: client styles')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'memory',
    order: 30,
    label: '记忆',
    inject: injected,
  }, ContinuitySettingsSection))
}
