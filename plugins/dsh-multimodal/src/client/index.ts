import type {} from '@deepseek-ai/dsh-client-connection/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { MultimodalClientController } from './controller.js'
import { installImageRouting } from './image-routing.js'
import { MultimodalSettingsSection, type MultimodalInjected } from './MultimodalSettingsSection.js'
import type { ClientRpc } from './contracts.js'
import { installMultimodalStyles } from './styles.js'

export const inject = ['slots', 'connection', 'conversation', 'modelDirectories', 'sessions']
export { MultimodalClientController } from './controller.js'
export { MultimodalSettingsSection } from './MultimodalSettingsSection.js'

export function apply(ctx: ClientContext): void {
  const controller = new MultimodalClientController(ctx.connection.rpc as unknown as ClientRpc)
  const injected = (): MultimodalInjected => ({ controller })
  ctx.effect(() => installMultimodalStyles(), 'telos-multimodal: client styles')
  ctx.effect(() => installImageRouting(ctx, controller), 'telos-multimodal: image routing')
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'multimodal', order: 20, label: '多模态', inject: injected,
  }, MultimodalSettingsSection))
}
