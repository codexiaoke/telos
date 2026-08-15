import { contextBridge, ipcRenderer } from 'electron'
import type {
  RuntimeEvent,
  RuntimePromptRequest,
  RuntimeRunResult,
  RuntimeStatus,
} from '@telos/runtime-contracts'
import type { DshWebSnapshot } from '../shared/dsh-web.js'
import type { EditorPanelPreferences } from '../shared/workbench-preferences.js'

const CHANNELS = {
  appInfo: 'telos:system:get-app-info',
  dshWebStatus: 'telos:dsh-web:get-status',
  dshWebRetry: 'telos:dsh-web:retry',
  dshWebState: 'telos:dsh-web:state',
  runtimeStatus: 'telos:runtime:get-status',
  runtimeRun: 'telos:runtime:run',
  runtimeEvent: 'telos:runtime:event',
  workbenchEditorPanelsGet: 'telos:workbench:get-editor-panels',
  workbenchEditorPanelsSet: 'telos:workbench:set-editor-panels',
} as const

export interface AppInfo {
  name: string
  version: string
  platform: string
}

const api = {
  system: {
    getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(CHANNELS.appInfo),
  },
  dshWeb: {
    getStatus: (): Promise<DshWebSnapshot> => ipcRenderer.invoke(CHANNELS.dshWebStatus),
    retry: (): Promise<void> => ipcRenderer.invoke(CHANNELS.dshWebRetry),
    onStatus: (observer: (snapshot: DshWebSnapshot) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, snapshot: DshWebSnapshot): void => observer(snapshot)
      ipcRenderer.on(CHANNELS.dshWebState, listener)
      return () => ipcRenderer.removeListener(CHANNELS.dshWebState, listener)
    },
  },
  runtime: {
    getStatus: (): Promise<RuntimeStatus> => ipcRenderer.invoke(CHANNELS.runtimeStatus),
    run: (request: RuntimePromptRequest): Promise<RuntimeRunResult> => ipcRenderer.invoke(CHANNELS.runtimeRun, request),
    onEvent: (observer: (event: RuntimeEvent) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, event: RuntimeEvent): void => observer(event)
      ipcRenderer.on(CHANNELS.runtimeEvent, listener)
      return () => ipcRenderer.removeListener(CHANNELS.runtimeEvent, listener)
    },
  },
  workbench: {
    getEditorPanels: (workspace: string): Promise<EditorPanelPreferences | undefined> => (
      ipcRenderer.invoke(CHANNELS.workbenchEditorPanelsGet, workspace)
    ),
    setEditorPanels: (workspace: string, value: EditorPanelPreferences): Promise<void> => (
      ipcRenderer.invoke(CHANNELS.workbenchEditorPanelsSet, workspace, value)
    ),
  },
}

contextBridge.exposeInMainWorld('telos', Object.freeze(api))
