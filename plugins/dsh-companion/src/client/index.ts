import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { CompanionSettingsSection, type CompanionInjected } from './CompanionSettingsSection.js'
import { CompanionClientController } from './controller.js'
import { installCompanionStyles } from './styles.js'

export const inject = ['slots']
export { CompanionSettingsSection } from './CompanionSettingsSection.js'
export { CompanionClientController } from './controller.js'

export function apply(ctx: ClientContext): void {
  const controller = new CompanionClientController(() => window.telos?.companion)
  const injected = (): CompanionInjected => ({ controller })
  ctx.effect(() => controller.start(), 'telos-companion: desktop state bridge')
  ctx.effect(() => installCompanionStyles(), 'telos-companion: client styles')
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'companion', order: 12, label: '桌面宠物', inject: injected,
  }, CompanionSettingsSection))
}
