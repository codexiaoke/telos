import { ipcMain, type WebContents } from 'electron'
import type { WorkbenchPreferencesStore } from '../preferences/workbench-preferences-store.js'
import { IPC_CHANNELS } from './channels.js'

export interface WorkbenchPreferencesHandlerOptions {
  store: WorkbenchPreferencesStore
  isTrustedSender: (sender: WebContents) => boolean
}

export function registerWorkbenchPreferencesHandlers(options: WorkbenchPreferencesHandlerOptions): void {
  const assertTrusted = (sender: WebContents): void => {
    if (!options.isTrustedSender(sender)) {
      throw new Error('Rejected workbench preference request from an untrusted renderer')
    }
  }

  ipcMain.handle(IPC_CHANNELS.workbenchEditorPanelsGet, async (event, workspace: unknown) => {
    assertTrusted(event.sender)
    return options.store.getEditorPanels(workspace)
  })
  ipcMain.handle(IPC_CHANNELS.workbenchEditorPanelsSet, async (event, workspace: unknown, value: unknown) => {
    assertTrusted(event.sender)
    await options.store.setEditorPanels(workspace, value)
  })
}
