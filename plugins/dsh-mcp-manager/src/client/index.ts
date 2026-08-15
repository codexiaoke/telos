import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { McpClientController } from './controller.js'
import { McpSettingsSection, type McpInjected } from './McpSettingsSection.js'
import type { ClientRpc } from './contracts.js'
import { installMcpManagerStyles } from './styles.js'

export { McpClientController } from './controller.js'
export { McpSettingsSection } from './McpSettingsSection.js'
export const inject = ['slots', 'connection']

export function apply(ctx: ClientContext): void {
  const controller = new McpClientController(ctx.connection.rpc as unknown as ClientRpc)
  const injected = (): McpInjected => ({ controller })
  ctx.effect(() => installMcpManagerStyles(), 'telos-mcp-manager: client styles')
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'mcp', order: 25, label: 'MCP', inject: injected,
  }, McpSettingsSection))
}
