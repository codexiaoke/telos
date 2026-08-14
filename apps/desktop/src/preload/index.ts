import { contextBridge, ipcRenderer } from 'electron'

const APP_INFO_CHANNEL = 'telos:system:get-app-info'

export interface AppInfo {
  name: string
  version: string
  platform: string
}

const api = {
  system: {
    getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(APP_INFO_CHANNEL)
  }
}

contextBridge.exposeInMainWorld('telos', api)
