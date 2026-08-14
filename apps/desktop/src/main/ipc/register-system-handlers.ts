import { app, ipcMain } from 'electron'
import { IPC_CHANNELS } from './channels.js'
import { isTrustedRenderer } from '../security/trusted-renderer.js'

export function registerSystemHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.appInfo, (event) => {
    const rendererUrl = event.senderFrame?.url
    if (!rendererUrl || !isTrustedRenderer(rendererUrl)) {
      throw new Error('Rejected IPC request from an untrusted renderer')
    }

    return {
      name: app.getName(),
      version: app.getVersion(),
      platform: process.platform,
    }
  })
}
