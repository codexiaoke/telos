import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { WorkReportClientController } from './controller.js'
import { installWorkReportStyles } from './styles.js'
import { WorkReportSettingsSection, type WorkReportInjected } from './WorkReportSettingsSection.js'
import type { ClientRpc } from './contracts.js'

export { WorkReportClientController } from './controller.js'
export { WorkReportSettingsSection } from './WorkReportSettingsSection.js'
export const inject = ['slots', 'connection']

export function apply(ctx: ClientContext): void {
  const controller = new WorkReportClientController(ctx.connection.rpc as unknown as ClientRpc)
  const injected = (): WorkReportInjected => ({ controller })
  ctx.effect(() => installWorkReportStyles(), 'telos-work-report: client styles')
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'work-report', order: 28, label: '工作报告', inject: injected,
  }, WorkReportSettingsSection))
}
