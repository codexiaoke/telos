import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { DshWebSupervisor } from './application/dsh-web-supervisor.js'
import { prepareTelosDshWebPatch } from './application/dsh-web-overlay.js'
import {
  loadDevelopmentEnvironment,
  resolveDshNodeExecutable,
  resolveDshSourceRoot,
  resolveTelosDshLayoutPackageRoot,
  resolveTelosDshSidebarPackageRoot,
} from './application/dsh-runtime-paths.js'
import { createRuntimeGateway } from './application/runtime-gateway.js'
import { IPC_CHANNELS } from './ipc/channels.js'
import { registerDshWebHandlers } from './ipc/register-dsh-web-handlers.js'
import { registerRuntimeHandlers } from './ipc/register-runtime-handlers.js'
import { registerSystemHandlers } from './ipc/register-system-handlers.js'
import { installApplicationMenu } from './shell/application-menu.js'
import { createMainWindow, loadDshWeb } from './shell/main-window.js'

app.setName('TELOS')

let dshWeb: DshWebSupervisor | undefined
let shutdownStarted = false

function openMainWindow(): BrowserWindow {
  const window = createMainWindow()
  const unsubscribe = dshWeb?.subscribe((snapshot) => {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.dshWebState, snapshot)
    }
  })
  window.once('closed', () => unsubscribe?.())
  const readyUrl = dshWeb?.getSnapshot().url
  if (readyUrl !== undefined) {
    void loadDshWeb(window, readyUrl).catch((error: unknown) => {
      console.error('Failed to load the ready DSH Web application', error)
    })
  }
  return window
}

app.whenReady().then(() => {
  loadDevelopmentEnvironment()
  installApplicationMenu()
  registerSystemHandlers()
  registerRuntimeHandlers(createRuntimeGateway())

  const dshHome = join(app.getPath('userData'), 'runtime/dsh/web-home')
  const telosPatch = prepareTelosDshWebPatch(dshHome, {
    sidebarPackageRoot: resolveTelosDshSidebarPackageRoot(),
    layoutPackageRoot: resolveTelosDshLayoutPackageRoot(),
  })
  dshWeb = new DshWebSupervisor({
    sourceRoot: resolveDshSourceRoot(),
    dshHome,
    executablePath: resolveDshNodeExecutable(),
    patchPaths: [telosPatch],
  })
  registerDshWebHandlers({
    getSnapshot: () => dshWeb?.getSnapshot() ?? {
      state: 'idle',
      recentOutput: [],
    },
    retry: async (sender) => {
      const window = BrowserWindow.fromWebContents(sender)
      if (window === null || window.isDestroyed() || dshWeb === undefined) {
        throw new Error('TELOS startup window is no longer available')
      }
      const url = await dshWeb.restart()
      if (!window.isDestroyed()) await loadDshWeb(window, url)
    },
  })

  const window = openMainWindow()
  void dshWeb.start().then(
    async (url) => {
      if (!window.isDestroyed()) await loadDshWeb(window, url)
    },
    (error: unknown) => {
      if (shutdownStarted) return
      console.error('Failed to start the complete DSH Web runtime', error)
    },
  )

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openMainWindow()
  })
})

app.on('before-quit', (event) => {
  if (dshWeb === undefined || shutdownStarted) return
  event.preventDefault()
  shutdownStarted = true
  void dshWeb.stop().finally(() => app.quit())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
