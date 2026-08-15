import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import { configureWorkbenchFilesClient, WorkbenchFilesClient, type WorkbenchFilesRpc } from './files/WorkbenchFiles'
import { TelosAppFrame } from './shell/TelosAppFrame'
import { TelosLayoutController } from './shell/layout-controller'
import type { PanelActions } from './shell/layout-controller'
import { createTelosLayoutStore } from './shell/layout-store'
import { installTelosLayoutStyles } from './shell/layout-styles'
import { TelosThemePresenter } from './shell/theme-presenter'

export const inject = ['slots', 'theme', 'connection']

/** DSH Client Plugin entry: replace presentation while preserving Slot contracts. */
export function apply(ctx: ClientContext): void {
  const layout = new TelosLayoutController()
  const connection = ctx.get('connection') as { rpc: WorkbenchFilesRpc } | undefined
  if (connection === undefined) throw new Error('Telos workbench requires the DSH client connection service')
  const workbenchFiles = new WorkbenchFilesClient(connection.rpc)
  configureWorkbenchFilesClient(workbenchFiles)
  ctx.effect(() => {
    const disposeService = ctx.reflect.provide('layout', layout)
    const disposeRegistration = ctx.slots.register({
      name: 'root',
      children: {
        sidebar: { kind: 'single', scope: 'root' },
        conversation: { kind: 'single', scope: 'session-maybe' },
        details: { kind: 'single', scope: 'session' },
        'shell.overlay': { kind: 'list', scope: 'root' },
      },
      store: createTelosLayoutStore,
      inject: (actions: PanelActions) => {
        layout.attachPanels(actions)
        return {}
      },
    }, TelosAppFrame)
    return () => {
      disposeRegistration()
      void disposeService()
    }
  }, 'telos-ui-layout: service + root registration')

  ctx.effect(() => installTelosLayoutStyles(), 'telos-ui-layout: styles')

  ctx.effect(() => {
    const presenter = new TelosThemePresenter()
    presenter.apply(ctx.theme.getTheme())
    const off = ctx.on('theme/change', snapshot => presenter.apply(snapshot))
    return () => {
      off()
      presenter.dispose()
    }
  }, 'telos-ui-layout: theme presenter')
}
