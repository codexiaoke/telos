import type { WebContents } from 'electron'
import { ipcMain } from 'electron'
import type { DshWebSnapshot } from '../../shared/dsh-web.js'
import { isTrustedRenderer } from '../security/trusted-renderer.js'
import { IPC_CHANNELS } from './channels.js'

interface DshWebHandlerOptions {
  getSnapshot: () => DshWebSnapshot
  retry: (sender: WebContents) => Promise<void>
}

function assertTrustedRenderer(urlValue: string | undefined): void {
  if (urlValue === undefined || !isTrustedRenderer(urlValue)) {
    throw new Error('Rejected DSH Web IPC request from an untrusted renderer')
  }
}

/** IPC boundary used only by the local startup/recovery renderer. */
export function registerDshWebHandlers(options: DshWebHandlerOptions): void {
  ipcMain.handle(IPC_CHANNELS.dshWebStatus, (event) => {
    assertTrustedRenderer(event.senderFrame?.url)
    return options.getSnapshot()
  })

  ipcMain.handle(IPC_CHANNELS.dshWebRetry, async (event) => {
    assertTrustedRenderer(event.senderFrame?.url)
    await options.retry(event.sender)
  })
}
