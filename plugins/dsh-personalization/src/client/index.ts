import type {} from '@deepseek-ai/dsh-client-connection/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { PersonalizationClientController } from './controller.js'
import {
  PersonalizationSettingsSection,
  type PersonalizationInjected,
} from './PersonalizationSettingsSection.js'
import type { ClientRpc } from './contracts.js'
import { installPersonalizationStyles } from './styles.js'

export const inject = ['slots', 'connection']
export { PersonalizationClientController } from './controller.js'
export { PersonalizationSettingsSection } from './PersonalizationSettingsSection.js'

export function apply(ctx: ClientContext): void {
  const controller = new PersonalizationClientController(ctx.connection.rpc as unknown as ClientRpc)
  const injected = (): PersonalizationInjected => ({ controller })
  ctx.effect(() => installPersonalizationStyles(), 'telos-personalization: client styles')
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'personalization', order: 15, label: '个性化', inject: injected,
  }, PersonalizationSettingsSection))
}
