import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type { InputTriggerServiceContract, InputTriggerSource, ReferenceInsert, TokenSpan } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import { EditorContextBridge } from './files/EditorContextBridge'
import {
  EDITOR_CONTEXT_SOURCE,
  editorContextClipboardText,
  editorContextRef,
  editorContextStore,
  serializeEditorContext,
} from './files/editor-context'
import { configureWorkbenchFilesClient, WorkbenchFilesClient, type WorkbenchFilesRpc } from './files/WorkbenchFiles'
import { TelosAppFrame } from './shell/TelosAppFrame'
import { TelosLayoutController } from './shell/layout-controller'
import type { PanelActions } from './shell/layout-controller'
import { createTelosLayoutStore } from './shell/layout-store'
import { installTelosLayoutStyles } from './shell/layout-styles'
import { TelosThemePresenter } from './shell/theme-presenter'

export const inject = ['slots', 'theme', 'connection', 'inputTriggers', 'sessions']

/** DSH Client Plugin entry: replace presentation while preserving Slot contracts. */
export function apply(ctx: ClientContext): void {
  const layout = new TelosLayoutController()
  const connection = ctx.get('connection') as { rpc: WorkbenchFilesRpc } | undefined
  if (connection === undefined) throw new Error('Telos workbench requires the DSH client connection service')
  const workbenchFiles = new WorkbenchFilesClient(connection.rpc)
  configureWorkbenchFilesClient(workbenchFiles)

  const inputTriggers = ctx.get('inputTriggers') as InputTriggerServiceContract
  const source: InputTriggerSource = {
    trigger: '@',
    name: EDITOR_CONTEXT_SOURCE,
    order: -20,
    candidates(session, { query }) {
      const context = editorContextStore.get(session.sessionId)
      if (context === undefined || !context.path.toLowerCase().includes(query.toLowerCase())) return Promise.resolve([])
      return Promise.resolve([{ name: context.path, description: '当前编辑器文件' }])
    },
    onPick({ candidate, session }) {
      const ref = editorContextRef(session.sessionId, candidate.name)
      return {
        insert: {
          source: EDITOR_CONTEXT_SOURCE,
          ref,
          label: candidate.name.split('/').at(-1) ?? candidate.name,
          clipboardText: editorContextClipboardText(ref),
        },
      }
    },
    codec: {
      clipboardText: editorContextClipboardText,
      serialize: ref => Promise.resolve(serializeEditorContext(ref)),
    },
  }
  ctx.effect(() => inputTriggers.registerSource(source), 'telos-ui-layout: editor context reference')

  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock',
    id: 'telos-editor-context',
    order: -20,
    inject: (sessionId) => {
      const actx = ctx.sessions.scope(sessionId)
      if (actx === undefined) throw new Error(`Telos editor context resolved no session scope for ${sessionId}`)
      return {
        insertContext: (reference: ReferenceInsert, span: TokenSpan) =>
          actx.bail(actx, 'slash/input-insert-reference', { reference, span }) === true,
      }
    },
  }, EditorContextBridge))
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
