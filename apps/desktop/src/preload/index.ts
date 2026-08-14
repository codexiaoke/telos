import { contextBridge, ipcRenderer } from 'electron'
import type {
  RuntimeEvent,
  RuntimePromptRequest,
  RuntimeRunResult,
  RuntimeStatus,
} from '@telos/runtime-contracts'

const CHANNELS = {
  appInfo: 'telos:system:get-app-info',
  runtimeStatus: 'telos:runtime:get-status',
  runtimeRun: 'telos:runtime:run',
  runtimeEvent: 'telos:runtime:event',
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
  runtime: {
    getStatus: (): Promise<RuntimeStatus> => ipcRenderer.invoke(CHANNELS.runtimeStatus),
    run: (request: RuntimePromptRequest): Promise<RuntimeRunResult> => ipcRenderer.invoke(CHANNELS.runtimeRun, request),
    onEvent: (observer: (event: RuntimeEvent) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, event: RuntimeEvent): void => observer(event)
      ipcRenderer.on(CHANNELS.runtimeEvent, listener)
      return () => ipcRenderer.removeListener(CHANNELS.runtimeEvent, listener)
    },
  },
}

contextBridge.exposeInMainWorld('telos', Object.freeze(api))
